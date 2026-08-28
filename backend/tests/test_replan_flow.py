from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.main import app


def test_partial_check_in_creates_new_plan_version() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    TestingSession = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)

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
    finally:
        app.dependency_overrides.clear()
