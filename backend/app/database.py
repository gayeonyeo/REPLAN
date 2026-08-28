from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import DATABASE_URL


class Base(DeclarativeBase):
    pass


connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate_runtime_schema() -> None:
    """Keep existing local demo databases usable after additive MVP upgrades."""
    inspector = inspect(engine)
    with engine.begin() as connection:
        if "exams" in inspector.get_table_names():
            exam_columns = {column["name"] for column in inspector.get_columns("exams")}
            if "ai_summary" not in exam_columns:
                connection.execute(text("ALTER TABLE exams ADD COLUMN ai_summary VARCHAR(500) NOT NULL DEFAULT ''"))
        if "study_tasks" in inspector.get_table_names():
            task_columns = {column["name"] for column in inspector.get_columns("study_tasks")}
            if "suggested_start_time" not in task_columns:
                connection.execute(text("ALTER TABLE study_tasks ADD COLUMN suggested_start_time VARCHAR(5) NOT NULL DEFAULT '19:00'"))
            if "suggested_end_time" not in task_columns:
                connection.execute(text("ALTER TABLE study_tasks ADD COLUMN suggested_end_time VARCHAR(5) NOT NULL DEFAULT '20:00'"))
