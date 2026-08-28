from fastapi import FastAPI

from app.config import settings


app = FastAPI(title="Nexus Study Planner API", version="0.1.0")


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "nexus-api",
        "timezone": settings.app_timezone,
    }

