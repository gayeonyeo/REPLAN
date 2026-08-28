from pathlib import Path
import os

from dotenv import load_dotenv


load_dotenv()
BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'nexus.db'}")
TIMEZONE = os.getenv("TIMEZONE", "Asia/Seoul")
