import os
import sys

# Ensure project root is on sys.path for Vercel Serverless Python runtime
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.database import init_db
from backend.main import app  # noqa: E402

# Ensure schema & env-configured admin are initialized safely on cold starts
init_db()

