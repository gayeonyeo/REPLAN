from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.main import app
from app.models import StudyTask


def fake_openai_tasks(db, exam, start_date):
    size = exam.scope_end - exam.scope_start + 1
    completed = sum(log.completed_units for task in exam.tasks for log in task.logs)
    remaining = max(0, int(size * exam.target_passes) - completed)
    if remaining:
        task = StudyTask(
            exam_id=exam.id,
            study_date=start_date,
            pass_number=completed // size + 1,
            scope_start=exam.scope_start + completed % size,
            scope_end=exam.scope_start + completed % size + remaining - 1 if remaining <= size - completed % size else exam.scope_end,
            planned_units=min(remaining, size - completed % size),
            status="PLANNED",
            plan_version=exam.plan_version,
            suggested_start_time="19:00",
            suggested_end_time="20:00",
        )
        db.add(task)
        exam.ai_summary = "테스트용 OpenAI 계획"
        db.flush()
        return 1
    return 0


def test_partial_check_in_creates_new_plan_version(monkeypatch) -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    TestingSession = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)
    monkeypatch.setattr("app.main.create_openai_tasks", fake_openai_tasks)

    def override_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    try:
        with TestClient(app) as client:
            overview = client.post("/api/demo/reset").json()
            exam = overview["exams"][0]
            task = next(item for item in exam["tasks"] if item["scope_end"] > item["scope_start"])
            actual_end = task["scope_start"]
            response = client.post(
                f"/api/tasks/{task['id']}/check-in",
                json={"result": "PARTIAL", "actual_scope_end": actual_end},
            )
        assert response.status_code == 200
        result = response.json()
        assert result["new_version"] == result["previous_version"] + 1
        assert result["changed_tasks"] > 0
        assert result["exam"]["current_passes"] > 0
        assert any(item["plan_version"] == result["new_version"] for item in result["exam"]["tasks"])
        assert "replan_explanation" in result
        assert "recommendation" in result
    finally:
        app.dependency_overrides.clear()


def test_exam_can_be_deleted(monkeypatch) -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    TestingSession = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)
    monkeypatch.setattr("app.main.create_openai_tasks", fake_openai_tasks)

    def override_db():
        with TestingSession() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    try:
        with TestClient(app) as client:
            exam = client.post("/api/demo/reset").json()["exams"][0]
            response = client.delete(f"/api/exams/{exam['id']}")
            overview = client.get("/api/overview").json()
        assert response.status_code == 204
        assert overview["exams"] == []
    finally:
        app.dependency_overrides.clear()


def test_weekly_recurring_event_creates_each_occurrence() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    TestingSession = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)

    def override_db():
        with TestingSession() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    try:
        with TestClient(app) as client:
            response = client.post("/api/events/recurring", json={
                "title": "매주 수업", "event_type": "CLASS",
                "start_date": "2026-09-01", "end_date": "2026-09-22",
                "start_time": "10:00", "end_time": "11:30",
            })
            overview = client.get("/api/overview").json()
        assert response.status_code == 201
        assert [event["starts_at"][:10] for event in response.json()] == ["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22"]
        assert len(overview["events"]) == 4
    finally:
        app.dependency_overrides.clear()
