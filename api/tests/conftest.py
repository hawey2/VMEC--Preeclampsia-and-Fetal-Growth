import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from pe_api.config import Settings
from pe_api.main import create_app


@pytest.fixture
def make_client(tmp_path):
    """make_client(user) -> a TestClient signed in as that dev account, on a fresh database per test."""
    url = os.environ.get("PE_TEST_DATABASE_URL") or f"sqlite:///{tmp_path / 'pe.db'}"
    if url.startswith("postgresql"):  # CI also runs these tests on a real PostgreSQL 16
        eng = create_engine(url)
        with eng.begin() as conn:
            conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public"))
        eng.dispose()
    app = create_app(Settings(database_url=url, auth_mode="dev", session_idle_minutes=15))
    opened = []

    def make(user: str | None = "sono"):
        c = TestClient(app)
        c.__enter__()
        opened.append(c)
        if user:
            r = c.post("/api/auth/login", json={"username": user, "password": user})
            assert r.status_code == 200, r.text
        return c

    yield make
    for c in opened:
        c.__exit__(None, None, None)
