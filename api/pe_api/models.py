"""Tables. Every screening keeps its full request, its full result and the
coefficient set used, so a printed report can always be reproduced."""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(128), unique=True)
    display_name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20))  # sonographer | doctor | admin
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SessionToken(Base):
    __tablename__ = "sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    user: Mapped[User] = relationship()


class Patient(Base):
    __tablename__ = "patients"
    id: Mapped[int] = mapped_column(primary_key=True)
    pid: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(200), default="")
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CoefficientSet(Base):
    __tablename__ = "coefficient_sets"
    id: Mapped[int] = mapped_column(primary_key=True)
    label: Mapped[str] = mapped_column(String(100))
    checksum: Mapped[str] = mapped_column(String(64), unique=True)
    content: Mapped[str] = mapped_column(Text)
    verification: Mapped[dict] = mapped_column(JSON)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Screening(Base):
    __tablename__ = "screenings"
    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    replaces_id: Mapped[int | None] = mapped_column(ForeignKey("screenings.id"))
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft | signed | superseded
    exam_date: Mapped[date] = mapped_column(Date)
    ga_days: Mapped[float] = mapped_column(Float)
    request: Mapped[dict] = mapped_column(JSON)
    form_state: Mapped[dict | None] = mapped_column(JSON)
    result: Mapped[dict] = mapped_column(JSON)
    risk37_one_in: Mapped[int | None] = mapped_column(Integer)
    high_risk: Mapped[bool] = mapped_column(Boolean)
    coefficient_set_id: Mapped[int] = mapped_column(ForeignKey("coefficient_sets.id"))
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    signed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    patient: Mapped[Patient] = relationship()
    creator: Mapped[User] = relationship(foreign_keys=[created_by])
    signer: Mapped[User | None] = relationship(foreign_keys=[signed_by])
    outcome: Mapped["Outcome | None"] = relationship(back_populates="screening", uselist=False)


class Outcome(Base):
    __tablename__ = "outcomes"
    id: Mapped[int] = mapped_column(primary_key=True)
    screening_id: Mapped[int] = mapped_column(ForeignKey("screenings.id"), unique=True)
    delivery_date: Mapped[date | None] = mapped_column(Date)
    ga_at_delivery_days: Mapped[int | None] = mapped_column(Integer)
    preeclampsia: Mapped[bool] = mapped_column(Boolean)
    pe_ga_days: Mapped[int | None] = mapped_column(Integer)
    aspirin: Mapped[bool | None] = mapped_column(Boolean)
    notes: Mapped[str] = mapped_column(Text, default="")
    entered_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    entered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    screening: Mapped[Screening] = relationship(back_populates="outcome")
    enterer: Mapped[User] = relationship()


class AuditLog(Base):
    """Append-only. On PostgreSQL a trigger refuses UPDATE and DELETE."""

    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    username: Mapped[str] = mapped_column(String(128))
    action: Mapped[str] = mapped_column(String(40), index=True)
    target_type: Mapped[str] = mapped_column(String(40), default="")
    target_id: Mapped[str] = mapped_column(String(64), default="")
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    ip: Mapped[str] = mapped_column(String(64), default="")
