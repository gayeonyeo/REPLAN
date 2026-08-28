from datetime import date, datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import CalendarEvent, Exam
from app.planner import generate_initial_plan


def test_busy_day_gets_less_work() -> None:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    today = date.today()
    db.add(CalendarEvent(title="긴 수업", event_type="CLASS", starts_at=datetime.combine(today, datetime.min.time()).replace(hour=9), ends_at=datetime.combine(today, datetime.min.time()).replace(hour=18)))
    exam = Exam(subject="생화학", exam_date=today + timedelta(days=2), scope_start=1, scope_end=100, scope_unit="페이지", target_passes=1)
    db.add(exam); db.flush(); generate_initial_plan(db, exam, today); db.flush()
    amounts = {task.study_date: task.planned_units for task in exam.tasks}
    assert amounts[today] < amounts[today + timedelta(days=1)]
