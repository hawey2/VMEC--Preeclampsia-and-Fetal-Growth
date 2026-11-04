"""Sign-in, sessions and roles.

Three ways to sign in (PE_AUTH_MODE): "ldap" = Vinmec accounts (hospital server), "local" = accounts
kept by the app itself with hashed passwords (cloud server, see passwords.py and users.py), "dev" =
fixed test accounts (local use and tests only).

Roles: sonographer (screen, save, print, enter outcomes), doctor (all of that and
sign), admin (audit log, research export, users). In LDAP mode the role comes from
group membership; doctor wins over sonographer when a person is in both.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import Settings, get_settings
from .db import get_db
from .models import SessionToken, User
from .passwords import verify_password

COOKIE = "pe_session"
ROLES = ("sonographer", "doctor", "admin")


class AuthError(Exception):
    pass


def _dev_directory(s: Settings) -> dict[str, tuple[str, str]]:
    out = {}
    for item in filter(None, (x.strip() for x in s.dev_users.split(","))):
        user, password, role = item.split(":")
        out[user] = (password, role)
    return out


def check_password(s: Settings, username: str, password: str) -> tuple[str, str]:
    """Return (display name, role) or raise AuthError."""
    if not username or not password:
        raise AuthError("missing credentials")
    if s.auth_mode == "dev":
        entry = _dev_directory(s).get(username)
        if entry is None or not hmac.compare_digest(entry[0], password):
            raise AuthError("wrong username or password")
        return username, entry[1]
    if s.auth_mode == "ldap":
        return _ldap_check(s, username, password)
    if s.auth_mode == "local":
        raise AuthError("local accounts are checked with check_local")
    raise AuthError(f"unknown auth mode {s.auth_mode!r}")


def _ldap_check(s: Settings, username: str, password: str) -> tuple[str, str]:
    from ldap3 import ALL, Connection, Server
    from ldap3.utils.conv import escape_filter_chars

    server = Server(s.ldap_url, get_info=ALL)
    with Connection(server, s.ldap_bind_dn, s.ldap_bind_password, auto_bind=True) as svc:
        svc.search(s.ldap_base_dn, s.ldap_user_filter.format(username=escape_filter_chars(username)),
                   attributes=["displayName", "memberOf"])
        if len(svc.entries) != 1:
            raise AuthError("wrong username or password")
        entry = svc.entries[0]
        dn = entry.entry_dn
        groups = {g.lower() for g in (entry.memberOf.values if "memberOf" in entry else [])}
        display = str(entry.displayName) if "displayName" in entry else username
    try:
        Connection(server, dn, password, auto_bind=True).unbind()
    except Exception as e:  # wrong password, locked account
        raise AuthError("wrong username or password") from e
    for role, group in (("admin", s.ldap_group_admin), ("doctor", s.ldap_group_doctor),
                        ("sonographer", s.ldap_group_sonographer)):
        if group and group.lower() in groups:
            return display, role
    raise AuthError("account is not in an allowed group")


MAX_FAILED = 5
LOCK_MINUTES = 15


def _aware(t: datetime) -> datetime:
    return t if t.tzinfo else t.replace(tzinfo=timezone.utc)


def check_local(db: Session, username: str, password: str) -> User:
    """App-owned account: the password hash is in the users table. Five wrong passwords in a row
    lock the account for 15 minutes."""
    if not username or not password:
        raise AuthError("missing credentials")
    user = db.scalar(select(User).where(User.username == username))
    now = datetime.now(timezone.utc)
    if user is not None and user.locked_until and _aware(user.locked_until) > now:
        verify_password(password, None)
        raise AuthError("account locked")
    if user is None or not user.active or not verify_password(password, user.password_hash):
        if user is not None:
            user.failed_logins = (user.failed_logins or 0) + 1
            if user.failed_logins >= MAX_FAILED:
                user.locked_until, user.failed_logins = now + timedelta(minutes=LOCK_MINUTES), 0
        raise AuthError("wrong username or password" if user is None or user.active else "account disabled")
    user.failed_logins, user.locked_until, user.last_login = 0, None, now
    db.flush()
    return user


def end_all_sessions(db: Session, user: User) -> None:
    for row in db.scalars(select(SessionToken).where(SessionToken.user_id == user.id)).all():
        db.delete(row)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def start_session(db: Session, response: Response, user: User, s: Settings) -> None:
    token = secrets.token_urlsafe(32)
    db.add(SessionToken(token_hash=_hash(token), user_id=user.id))
    response.set_cookie(COOKIE, token, httponly=True, samesite="strict", secure=s.cookie_secure, path="/")


def end_session(db: Session, request: Request, response: Response) -> None:
    token = request.cookies.get(COOKIE)
    if token:
        row = db.get(SessionToken, _hash(token))
        if row:
            db.delete(row)
    response.delete_cookie(COOKIE, path="/")


def current_user(request: Request, db: Session = Depends(get_db),
                 s: Settings = Depends(get_settings)) -> User:
    token = request.cookies.get(COOKIE)
    row = db.get(SessionToken, _hash(token)) if token else None
    if row is None or not row.user.active:
        raise HTTPException(401, "not signed in")
    now = datetime.now(timezone.utc)
    last = row.last_seen if row.last_seen.tzinfo else row.last_seen.replace(tzinfo=timezone.utc)
    if now - last > timedelta(minutes=s.session_idle_minutes):
        db.delete(row)
        db.commit()
        raise HTTPException(401, "session expired")
    row.last_seen = now
    db.commit()
    return row.user


def require(*roles: str):
    def dep(user: User = Depends(current_user), s: Settings = Depends(get_settings)) -> User:
        if s.auth_mode == "local" and user.must_change_password:
            raise HTTPException(403, "change your password first")
        if user.role not in roles:
            raise HTTPException(403, "your role cannot do this")
        return user
    return dep


def upsert_user(db: Session, username: str, display: str, role: str) -> User:
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        user = User(username=username, display_name=display, role=role)
        db.add(user)
    else:
        user.display_name, user.role = display, role
    user.last_login = datetime.now(timezone.utc)
    db.flush()
    return user
