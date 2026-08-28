import json
import math
from datetime import date, datetime

from openai import OpenAI
from pydantic import BaseModel, Field, ValidationError

from app.config import OPENAI_API_KEY, OPENAI_MODEL


class AIPlanTask(BaseModel):
    study_date: date
    pass_number: int = Field(ge=1)
    scope_start: int = Field(ge=0)
    scope_end: int = Field(ge=0)
    suggested_start_time: str
    suggested_end_time: str


class AIStudyPlan(BaseModel):
    summary: str
    tasks: list[AIPlanTask]


PLAN_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "summary": {"type": "string"},
        "tasks": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "study_date": {"type": "string", "format": "date"},
                    "pass_number": {"type": "integer", "minimum": 1},
                    "scope_start": {"type": "integer", "minimum": 0},
                    "scope_end": {"type": "integer", "minimum": 0},
                    "suggested_start_time": {"type": "string", "pattern": "^([01]\\d|2[0-3]):[0-5]\\d$"},
                    "suggested_end_time": {"type": "string", "pattern": "^([01]\\d|2[0-3]):[0-5]\\d$"},
                },
                "required": ["study_date", "pass_number", "scope_start", "scope_end", "suggested_start_time", "suggested_end_time"],
            },
        },
    },
    "required": ["summary", "tasks"],
}


class OpenAIPlannerError(RuntimeError):
    pass


def generate_study_plan(
    *,
    subject: str,
    exam_date: date,
    scope_start: int,
    scope_end: int,
    scope_unit: str,
    target_passes: float,
    completed_units: int,
    start_date: date,
    events: list[dict[str, str]],
    priority_chapters: str = "",
) -> AIStudyPlan:
    if not OPENAI_API_KEY:
        raise OpenAIPlannerError("OPENAI_API_KEY가 설정되지 않았습니다. backend/.env에 API 키를 입력해 주세요.")

    scope_size = scope_end - scope_start + 1
    target_units = math.ceil(scope_size * target_passes)
    remaining_units = max(0, target_units - completed_units)
    if remaining_units == 0:
        return AIStudyPlan(summary="목표 회독을 완료했습니다.", tasks=[])

    payload = {
        "today": start_date.isoformat(),
        "exam": {
            "subject": subject,
            "exam_date": exam_date.isoformat(),
            "scope_start": scope_start,
            "scope_end": scope_end,
            "scope_unit": scope_unit,
            "target_passes": target_passes,
            "priority_chapters": priority_chapters,
        },
        "progress": {
            "completed_units_across_passes": completed_units,
            "remaining_units_across_passes": remaining_units,
        },
        "blocking_events": events,
    }
    instructions = (
        "당신은 대학생 시험 계획을 만드는 일정 최적화 엔진이다. "
        "시험 당일에는 공부를 배정하지 말고, 고정 일정과 시간이 겹치지 않게 하라. "
        "blocking_events에는 다른 시험의 공부 계획도 포함된다. 어떤 시간도 겹치게 배정하지 마라. "
        "priority_chapters가 있으면 강조된 범위를 앞쪽 날짜와 집중하기 좋은 시간에 우선 배치하라. "
        "범위를 회독 순서대로 빠짐없이 배정하고 같은 회독 안에서 중복시키지 마라. "
        "고정 일정이 많은 날은 학습량을 줄이고 가능한 시간대를 suggested time으로 제시하라. "
        "출력은 제공된 JSON schema를 정확히 따라야 한다."
    )
    try:
        response = OpenAI(api_key=OPENAI_API_KEY).responses.create(
            model=OPENAI_MODEL,
            instructions=instructions,
            input=json.dumps(payload, ensure_ascii=False),
            text={
                "format": {
                    "type": "json_schema",
                    "name": "study_plan",
                    "strict": True,
                    "schema": PLAN_SCHEMA,
                }
            },
        )
        plan = AIStudyPlan.model_validate_json(response.output_text)
    except (ValidationError, ValueError, json.JSONDecodeError) as exc:
        raise OpenAIPlannerError("OpenAI가 유효한 계획 형식을 반환하지 않았습니다.") from exc
    except Exception as exc:
        raise OpenAIPlannerError(f"OpenAI API 호출에 실패했습니다: {exc}") from exc

    plan.tasks.sort(key=lambda task: (task.study_date, task.suggested_start_time, task.pass_number, task.scope_start))
    _validate_plan(plan, start_date, exam_date, scope_start, scope_end, completed_units, remaining_units)
    return plan


def _validate_plan(plan: AIStudyPlan, start_date: date, exam_date: date, scope_start: int, scope_end: int, completed_units: int, expected_units: int) -> None:
    planned_units = 0
    scope_length = scope_end - scope_start + 1
    offset = completed_units
    for task in plan.tasks:
        if not start_date <= task.study_date < exam_date:
            raise OpenAIPlannerError("OpenAI 계획에 시험 기간 밖의 날짜가 포함됐습니다.")
        if not scope_start <= task.scope_start <= task.scope_end <= scope_end:
            raise OpenAIPlannerError("OpenAI 계획에 시험 범위 밖의 학습량이 포함됐습니다.")
        expected_pass = offset // scope_length + 1
        expected_start = scope_start + offset % scope_length
        if task.pass_number != expected_pass or task.scope_start != expected_start:
            raise OpenAIPlannerError("OpenAI 계획의 회독 또는 범위 순서에 누락·중복이 있습니다.")
        start_time = datetime.strptime(task.suggested_start_time, "%H:%M")
        end_time = datetime.strptime(task.suggested_end_time, "%H:%M")
        if end_time <= start_time:
            raise OpenAIPlannerError("OpenAI 계획의 종료 시간이 시작 시간보다 빠릅니다.")
        units = task.scope_end - task.scope_start + 1
        planned_units += units
        offset += units
    if planned_units != expected_units:
        raise OpenAIPlannerError(f"OpenAI 계획량({planned_units})이 남은 목표량({expected_units})과 일치하지 않습니다.")
