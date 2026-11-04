"""Write one audit row per action. Nothing in the app updates or deletes them."""

from __future__ import annotations

from fastapi import Request
from sqlalchemy.orm import Session

from .models import AuditLog, User


def log(db: Session, request: Request | None, user: User | None, action: str,
        target_type: str = "", target_id: object = "", username: str | None = None, **detail) -> None:
    db.add(AuditLog(
        user_id=user.id if user else None,
        username=username or (user.username if user else ""),
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        detail=detail,
        ip=(request.client.host if request and request.client else ""),
    ))
