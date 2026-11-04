"""Database engine and session."""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


_engine: Engine | None = None
_factory: sessionmaker | None = None


def init_engine(url: str) -> Engine:
    global _engine, _factory
    kwargs = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {"pool_pre_ping": True}
    _engine = create_engine(url, **kwargs)
    if url.startswith("sqlite"):
        @event.listens_for(_engine, "connect")
        def _fk_on(dbapi_conn, _):  # SQLite ignores foreign keys unless asked
            dbapi_conn.execute("PRAGMA foreign_keys=ON")
    _factory = sessionmaker(bind=_engine, expire_on_commit=False)
    return _engine


def engine() -> Engine:
    assert _engine is not None, "init_engine() first"
    return _engine


def get_db() -> Iterator[Session]:
    assert _factory is not None, "init_engine() first"
    s = _factory()
    try:
        yield s
    finally:
        s.close()
