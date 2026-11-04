"""Run database migrations (Alembic) to the latest version."""

from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config

from . import db

HERE = Path(__file__).resolve().parent


def alembic_config(url: str) -> Config:
    cfg = Config()
    cfg.set_main_option("script_location", str(HERE / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url)
    return cfg


def upgrade(url: str) -> None:
    cfg = alembic_config(url)
    with db.engine().begin() as conn:
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, "head")


if __name__ == "__main__":  # python -m pe_api.migrate
    from .config import get_settings
    s = get_settings()
    db.init_engine(s.database_url)
    upgrade(s.database_url)
    print("database at latest version")
