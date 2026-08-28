import json
from datetime import date, timedelta

from app.ai_planner import generate_study_plan


class FakeResponses:
    def create(self, **kwargs):
        assert kwargs["text"]["format"]["type"] == "json_schema"
        assert kwargs["reasoning"] == {"effort": "none"}
        payload = {
            "summary": "수업을 피해 저녁에 10페이지를 학습합니다.",
            "tasks": [{
                "study_date": date.today().isoformat(),
                "pass_number": 1,
                "scope_start": 1,
                "scope_end": 10,
                "suggested_start_time": "19:00",
                "suggested_end_time": "20:00",
            }],
        }
        return type("Response", (), {"output_text": json.dumps(payload)})()


class FakeOpenAI:
    def __init__(self, **kwargs):
        assert kwargs["api_key"] == "test-key"
        self.responses = FakeResponses()


def test_openai_structured_plan(monkeypatch) -> None:
    monkeypatch.setattr("app.ai_planner.OPENAI_API_KEY", "test-key")
    monkeypatch.setattr("app.ai_planner.OpenAI", FakeOpenAI)
    plan = generate_study_plan(
        subject="생화학",
        exam_date=date.today() + timedelta(days=2),
        scope_start=1,
        scope_end=10,
        scope_unit="페이지",
        target_passes=1,
        completed_units=0,
        start_date=date.today(),
        events=[],
    )
    assert plan.tasks[0].suggested_start_time == "19:00"
    assert plan.tasks[0].scope_end == 10
