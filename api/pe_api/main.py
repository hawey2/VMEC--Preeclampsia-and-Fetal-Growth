"""HTTP API: risk calculation, sign-in, saved screenings, audit log.

Run: uvicorn pe_api.main:app   (settings come from PE_* environment variables)
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

from . import audit, db, migrate
from .assessment import COEF, CUTOFF_ONE_IN, compute
from .auth import AuthError, check_local, check_password, current_user, end_session, require, start_session, upsert_user
from .config import Settings, get_settings
from .models import User
from .passwords import WeakPassword, check_strength, hash_password, verify_password
from .records import CLINICAL, router as records_router
from .schemas import AssessmentIn, AssessmentOut


class LoginIn(BaseModel):
    username: str
    password: str


class PasswordIn(BaseModel):
    current: str
    new: str


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        db.init_engine(settings.database_url)
        migrate.upgrade(settings.database_url)
        yield

    app = FastAPI(title="Vinmec preeclampsia risk API", version="0.4.0", lifespan=lifespan)
    app.dependency_overrides[get_settings] = lambda: settings

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/model")
    def model_info():
        return {
            "label": COEF.label,
            "checksum": COEF.checksum,
            "cutoff_one_in": CUTOFF_ONE_IN,
            "verification": {k: COEF.verification(k) for k in ("prior", "mom", "likelihood")},
            "combined_available": COEF.has_likelihood(),
        }

    @app.get("/api/auth/config")
    def auth_config():
        """How people sign in, so the sign-in screen can say which account to use."""
        return {"auth_mode": settings.auth_mode}

    @app.post("/api/auth/login")
    def login(body: LoginIn, request: Request, response: Response, s: Session = Depends(db.get_db)):
        username = body.username.strip()
        try:
            if settings.auth_mode == "local":
                user = check_local(s, username, body.password)
            else:
                display, role = check_password(settings, username, body.password)
                user = upsert_user(s, username, display, role)
        except AuthError as e:
            audit.log(s, request, None, "login_failed", username=username[:128], reason=str(e))
            s.commit()
            raise HTTPException(401, "account locked" if str(e) == "account locked" else "wrong username or password") from e
        start_session(s, response, user, settings)
        audit.log(s, request, user, "login")
        s.commit()
        return _me(user)

    @app.post("/api/auth/logout")
    def logout(request: Request, response: Response, s: Session = Depends(db.get_db)):
        end_session(s, request, response)
        s.commit()
        return {"ok": True}

    def _me(user: User) -> dict:
        return {"username": user.username, "display_name": user.display_name, "role": user.role,
                "idle_minutes": settings.session_idle_minutes, "auth_mode": settings.auth_mode,
                "must_change_password": bool(settings.auth_mode == "local" and user.must_change_password)}

    @app.get("/api/auth/me")
    def me(user: User = Depends(current_user)):
        return _me(user)

    @app.post("/api/auth/password")
    def change_password(body: PasswordIn, request: Request, user: User = Depends(current_user),
                        s: Session = Depends(db.get_db)):
        """Change your own password (local accounts). Required after an admin sets a temporary one."""
        if settings.auth_mode != "local":
            raise HTTPException(409, "passwords are managed by Vinmec accounts")
        user = s.merge(user)
        if not verify_password(body.current, user.password_hash):
            audit.log(s, request, user, "password_change_failed")
            s.commit()
            raise HTTPException(422, "current password is wrong")
        if body.new == body.current:
            raise HTTPException(422, "new password must be different")
        try:
            check_strength(body.new, user.username)
        except WeakPassword as e:
            raise HTTPException(422, str(e)) from e
        user.password_hash, user.must_change_password = hash_password(body.new), False
        audit.log(s, request, user, "password_change")
        s.commit()
        return _me(user)

    @app.post("/api/assess", response_model=AssessmentOut)
    def run_assessment(a: AssessmentIn, user: User = Depends(require(*CLINICAL))) -> AssessmentOut:
        """Live calculation while the form is filled in; nothing is stored."""
        return compute(a)

    app.include_router(records_router)

    web = Path(os.environ.get("PE_WEB_DIST", Path(__file__).resolve().parents[2] / "web" / "dist"))
    if web.is_dir():
        app.mount("/assets", StaticFiles(directory=web / "assets"), name="assets")

        @app.get("/")
        def index():
            return FileResponse(web / "index.html")

    return app


app = create_app()
