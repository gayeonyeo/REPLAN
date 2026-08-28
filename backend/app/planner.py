from collections import defaultdict
from datetime import date, datetime, timedelta
import math

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CalendarEvent, Exam, StudyLog, StudyTask


DAILY_STUDY_MINUTES = 240


def scope_size(exam: Exam) -> int:
    return exam.scope_end - exam.scope_start + 1


def total_target_units(exam: Exam) -> int:
    return math.ceil(scope_size(exam) * exam.target_passes)


def completed_units(db: Session, exam_id: int) -> int:
    logs = db.scalars(select(StudyLog).join(StudyTask).where(StudyTask.exam_id == exam_id)).all()
    return sum(log.completed_units for log in logs)


def day_weights(db: Session, start: date, end: date) -> list[tuple[date, float]]:
    days: list[date] = []
    cursor = start
    while cursor < end:
        days.append(cursor)
        cursor += timedelta(days=1)
    if not days:
        return []

    range_start = datetime.combine(start, datetime.min.time())
    range_end = datetime.combine(end, datetime.min.time())
    events = db.scalars(select(CalendarEvent).where(CalendarEvent.starts_at < range_end, CalendarEvent.ends_at > range_start)).all()
    busy_minutes: dict[date, float] = defaultdict(float)
    for event in events:
        busy_minutes[event.starts_at.date()] += max(0, (event.ends_at - event.starts_at).total_seconds() / 60)
    return [(day, max(0.2, 1 - busy_minutes[day] / (DAILY_STUDY_MINUTES + 480))) for day in days]


def allocate_counts(total: int, weights: list[tuple[date, float]]) -> list[int]:
    if total <= 0 or not weights:
        return [0] * len(weights)
    weight_sum = sum(weight for _, weight in weights)
    raw = [total * weight / weight_sum for _, weight in weights]
    counts = [math.floor(value) for value in raw]
    for index in sorted(range(len(raw)), key=lambda item: raw[item] - counts[item], reverse=True)[: total - sum(counts)]:
        counts[index] += 1
    return counts


def build_tasks(db: Session, exam: Exam, start_date: date, offset: int) -> list[StudyTask]:
    remaining = max(0, total_target_units(exam) - offset)
    weights = day_weights(db, start_date, exam.exam_date)
    counts = allocate_counts(remaining, weights)
    size = scope_size(exam)
    tasks: list[StudyTask] = []
    current_offset = offset
    for (study_date, _), daily_count in zip(weights, counts, strict=True):
        units_left = daily_count
        while units_left > 0:
            pass_number = current_offset // size + 1
            position = current_offset % size
            chunk = min(units_left, size - position)
            task = StudyTask(
                exam_id=exam.id,
                study_date=study_date,
                pass_number=pass_number,
                scope_start=exam.scope_start + position,
                scope_end=exam.scope_start + position + chunk - 1,
                planned_units=chunk,
                status="PLANNED",
                plan_version=exam.plan_version,
            )
            db.add(task)
            tasks.append(task)
            current_offset += chunk
            units_left -= chunk
    return tasks


def generate_initial_plan(db: Session, exam: Exam, today: date | None = None) -> int:
    start = today or date.today()
    tasks = [] if exam.exam_date <= start else build_tasks(db, exam, start, 0)
    db.flush()
    return len(tasks)


def forecast_passes(db: Session, exam: Exam, today: date | None = None) -> float:
    done = completed_units(db, exam.id)
    future = sum(task.planned_units for task in exam.tasks if task.status == "PLANNED" and task.study_date >= (today or date.today()))
    return round(min(exam.target_passes, (done + future) / scope_size(exam)), 2)
