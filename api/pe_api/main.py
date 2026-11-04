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
from .auth import AuthError, check_password, current_user, end_session, start_session, upsert_user
from .config import Settings, get_settings
from .models import User
from .records import CLINICAL, router as records_router
from .schemas import AssessmentIn, AssessmentOut


class LoginIn(BaseModel):
    username: str
    password: str


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

    @app.post("/api/auth/login")
    def login(body: LoginIn, request: Request, response: Response, s: Session = Depends(db.get_db)):
        try:
            display, role = check_password(settings, body.username.strip(), body.password)
        except AuthError as e:
            audit.log(s, request, None, "login_failed", username=body.username.strip()[:128], reason=str(e))
            s.commit()
            raise HTTPException(401, "wrong username or password") from e
        user = upsert_user(s, body.username.strip(), display, role)
        start_session(s, response, user, settings)
        audit.log(s, request, user, "login")
        s.commit()
        return {"username": user.username, "display_name": user.display_name, "role": user.role}

    @app.post("/api/auth/logout")
    def logout(request: Request, response: Response, s: Session = Depends(db.get_db)):
        end_session(s, request, response)
        s.commit()
        return {"ok": True}

    @app.get("/api/auth/me")
    def me(user: User = Depends(current_user)):
        return {"username": user.username, "display_name": user.display_name, "role": user.role,
                "idle_minutes": settings.session_idle_minutes}

    @app.post("/api/assess", response_model=AssessmentOut)
    def run_assessment(a: AssessmentIn, user: User = Depends(current_user)) -> AssessmentOut:
        """Live calculation while the form is filled in; nothing is stored."""
        if user.role not in CLINICAL:
            raise HTTPException(403, "your role cannot do this")
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
