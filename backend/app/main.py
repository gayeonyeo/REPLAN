from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.ai_planner import OpenAIPlannerError, generate_study_plan
from app.config import OPENAI_API_KEY, OPENAI_MODEL, TIMEZONE
from app.database import Base, engine, get_db, migrate_runtime_schema
from app.models import CalendarEvent, Exam, StudyLog, StudyTask
from app.schemas import CheckInCreate, CheckInResponse, EventCreate, EventRead, ExamCreate, ExamRead, OverviewRead, TaskRead

@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    migrate_runtime_schema()
    yield


app = FastAPI(title="Nexus Study Planner API", version="0.2.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health_check() -> dict[str, str | bool]:
    return {"status": "ok", "timezone": TIMEZONE, "openai_configured": bool(OPENAI_API_KEY), "openai_model": OPENAI_MODEL}


def scope_size(exam: Exam) -> int:
    return exam.scope_end - exam.scope_start + 1


def completed_units(db: Session, exam_id: int) -> int:
    logs = db.scalars(select(StudyLog).join(StudyTask).where(StudyTask.exam_id == exam_id)).all()
    return sum(log.completed_units for log in logs)


def forecast_passes(db: Session, exam: Exam) -> float:
    done = completed_units(db, exam.id)
    future = sum(task.planned_units for task in exam.tasks if task.status == "PLANNED")
    return round(min(exam.target_passes, (done + future) / scope_size(exam)), 2)


def create_openai_tasks(db: Session, exam: Exam, start_date: date) -> int:
    events = db.scalars(select(CalendarEvent).where(CalendarEvent.starts_at < datetime.combine(exam.exam_date, datetime.min.time()))).all()
    plan = generate_study_plan(
        subject=exam.subject,
        exam_date=exam.exam_date,
        scope_start=exam.scope_start,
        scope_end=exam.scope_end,
        scope_unit=exam.scope_unit,
        target_passes=exam.target_passes,
        completed_units=completed_units(db, exam.id),
        start_date=start_date,
        events=[{"title": event.title, "starts_at": event.starts_at.isoformat(), "ends_at": event.ends_at.isoformat()} for event in events],
    )
    exam.ai_summary = plan.summary
    for item in plan.tasks:
        db.add(StudyTask(
            exam_id=exam.id,
            study_date=item.study_date,
            pass_number=item.pass_number,
            scope_start=item.scope_start,
            scope_end=item.scope_end,
            planned_units=item.scope_end - item.scope_start + 1,
            status="PLANNED",
            plan_version=exam.plan_version,
            suggested_start_time=item.suggested_start_time,
            suggested_end_time=item.suggested_end_time,
        ))
    db.flush()
    return len(plan.tasks)


def serialize_exam(db: Session, exam: Exam) -> ExamRead:
    done = completed_units(db, exam.id)
    return ExamRead(id=exam.id, subject=exam.subject, exam_date=exam.exam_date, scope_start=exam.scope_start, scope_end=exam.scope_end, scope_unit=exam.scope_unit, target_passes=exam.target_passes, current_passes=round(done / scope_size(exam), 2), forecast_passes=forecast_passes(db, exam), plan_version=exam.plan_version, ai_summary=exam.ai_summary, tasks=[TaskRead.model_validate(task) for task in sorted(exam.tasks, key=lambda item: (item.study_date, item.suggested_start_time, item.id))])


@app.get("/api/overview", response_model=OverviewRead)
def get_overview(db: Session = Depends(get_db)) -> OverviewRead:
    events = db.scalars(select(CalendarEvent).order_by(CalendarEvent.starts_at)).all()
    exams = db.scalars(select(Exam).options(selectinload(Exam.tasks)).order_by(Exam.exam_date)).all()
    return OverviewRead(events=[EventRead.model_validate(event) for event in events], exams=[serialize_exam(db, exam) for exam in exams])


@app.post("/api/events", response_model=EventRead, status_code=201)
def create_event(payload: EventCreate, db: Session = Depends(get_db)) -> EventRead:
    event = CalendarEvent(**payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return EventRead.model_validate(event)


@app.post("/api/exams", response_model=ExamRead, status_code=201)
def create_exam(payload: ExamCreate, db: Session = Depends(get_db)) -> ExamRead:
    if payload.exam_date <= date.today():
        raise HTTPException(status_code=422, detail="시험일은 오늘 이후여야 합니다.")
    exam = Exam(**payload.model_dump())
    db.add(exam)
    db.flush()
    try:
        create_openai_tasks(db, exam, date.today())
    except OpenAIPlannerError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    db.commit()
    exam = db.scalar(select(Exam).where(Exam.id == exam.id).options(selectinload(Exam.tasks)))
    assert exam is not None
    return serialize_exam(db, exam)


@app.post("/api/tasks/{task_id}/check-in", response_model=CheckInResponse)
def check_in(task_id: int, payload: CheckInCreate, db: Session = Depends(get_db)) -> CheckInResponse:
    task = db.scalar(select(StudyTask).where(StudyTask.id == task_id).options(selectinload(StudyTask.exam)))
    if task is None:
        raise HTTPException(status_code=404, detail="공부 계획을 찾을 수 없습니다.")
    if task.status != "PLANNED":
        raise HTTPException(status_code=409, detail="이미 체크인한 계획입니다.")
    if payload.result == "COMPLETED":
        units, actual_end = task.planned_units, task.scope_end
    elif payload.result == "MISSED":
        units, actual_end = 0, None
    else:
        if payload.actual_scope_end is None or not task.scope_start <= payload.actual_scope_end < task.scope_end:
            raise HTTPException(status_code=422, detail="일부 완료 지점은 계획 범위 안에 있어야 합니다.")
        units, actual_end = payload.actual_scope_end - task.scope_start + 1, payload.actual_scope_end
    task.status = payload.result
    db.add(StudyLog(task_id=task.id, result=payload.result, completed_units=units, actual_scope_end=actual_end))
    db.flush()
    exam, previous_version = task.exam, task.exam.plan_version
    future_ids = db.scalars(select(StudyTask.id).where(StudyTask.exam_id == exam.id, StudyTask.status == "PLANNED", StudyTask.id != task.id)).all()
    if future_ids:
        db.execute(delete(StudyTask).where(StudyTask.id.in_(future_ids)))
    exam.plan_version += 1
    try:
        changed = create_openai_tasks(db, exam, max(date.today(), task.study_date) + timedelta(days=1))
    except OpenAIPlannerError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    db.commit()
    refreshed = db.scalar(select(Exam).where(Exam.id == exam.id).options(selectinload(Exam.tasks)))
    assert refreshed is not None
    return CheckInResponse(message="실제 수행량을 반영해 남은 계획을 다시 배분했습니다.", previous_version=previous_version, new_version=refreshed.plan_version, changed_tasks=changed, exam=serialize_exam(db, refreshed))


@app.post("/api/demo/reset", response_model=OverviewRead)
def reset_demo(db: Session = Depends(get_db)) -> OverviewRead:
    db.execute(delete(StudyLog)); db.execute(delete(StudyTask)); db.execute(delete(Exam)); db.execute(delete(CalendarEvent))
    today = date.today()
    db.add_all([
        CalendarEvent(title="전공 수업", event_type="CLASS", starts_at=datetime.combine(today + timedelta(days=1), datetime.min.time()).replace(hour=10), ends_at=datetime.combine(today + timedelta(days=1), datetime.min.time()).replace(hour=15)),
        CalendarEvent(title="카페 아르바이트", event_type="WORK", starts_at=datetime.combine(today + timedelta(days=3), datetime.min.time()).replace(hour=14), ends_at=datetime.combine(today + timedelta(days=3), datetime.min.time()).replace(hour=20)),
    ])
    exam = Exam(subject="생화학", exam_date=today + timedelta(days=8), scope_start=1, scope_end=160, scope_unit="페이지", target_passes=2)
    db.add(exam); db.flush()
    try:
        create_openai_tasks(db, exam, today)
    except OpenAIPlannerError as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    db.commit()
    return get_overview(db)
