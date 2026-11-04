"""Saved screenings, doctor sign-off, outcomes, audit log and research export."""

from __future__ import annotations

import csv
import hashlib
import hmac
import io
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import audit
from .assessment import COEF, compute
from .auth import require
from .config import Settings, get_settings
from .db import get_db
from .models import AuditLog, CoefficientSet, Outcome, Patient, Screening, User
from .schemas import AssessmentIn

router = APIRouter(prefix="/api")
CLINICAL = ("sonographer", "doctor")


class SaveIn(BaseModel):
    assessment: AssessmentIn
    form_state: dict | None = None  # the web form as filled in, so the record can be reopened


class OutcomeIn(BaseModel):
    delivery_date: date | None = None
    ga_at_delivery_days: int | None = Field(None, ge=140, le=315)
    preeclampsia: bool
    pe_ga_days: int | None = Field(None, ge=140, le=315)
    aspirin: bool | None = None
    notes: str = ""


def coefficient_set_id(db: Session) -> int:
    """The bundled coefficient file, registered once by its checksum."""
    row = db.scalar(select(CoefficientSet).where(CoefficientSet.checksum == COEF.checksum))
    if row is None:
        import json
        row = CoefficientSet(label=COEF.label, checksum=COEF.checksum,
                             content=json.dumps(COEF.data, ensure_ascii=False),
                             verification={k: COEF.verification(k) for k in ("prior", "mom", "likelihood", "truncation")})
        db.add(row)
        db.flush()
    return row.id


def _summary(s: Screening) -> dict:
    r = s.result
    return {
        "id": s.id, "version": s.version, "replaces_id": s.replaces_id, "status": s.status,
        "pid": s.patient.pid, "name": s.patient.name,
        "exam_date": s.exam_date.isoformat(), "ga_label": r.get("ga_label"),
        "risk37_one_in": s.risk37_one_in, "high_risk": s.high_risk,
        "created_by": s.creator.display_name, "created_at": s.created_at.isoformat(),
        "signed_by": s.signer.display_name if s.signer else None,
        "signed_at": s.signed_at.isoformat() if s.signed_at else None,
        "outcome": _outcome(s.outcome),
    }


def _outcome(o: Outcome | None) -> dict | None:
    if o is None:
        return None
    return {"delivery_date": o.delivery_date.isoformat() if o.delivery_date else None,
            "ga_at_delivery_days": o.ga_at_delivery_days, "preeclampsia": o.preeclampsia,
            "pe_ga_days": o.pe_ga_days, "aspirin": o.aspirin, "notes": o.notes,
            "entered_by": o.enterer.display_name, "entered_at": o.entered_at.isoformat()}


def _get(db: Session, sid: int) -> Screening:
    s = db.get(Screening, sid)
    if s is None:
        raise HTTPException(404, "screening not found")
    return s


def _store(db: Session, body: SaveIn, user: User, replaces: Screening | None = None) -> Screening:
    a = body.assessment
    pid = a.patient.pid.strip()
    if not pid:
        raise HTTPException(422, "PID is required to save")
    out = compute(a)
    patient = db.scalar(select(Patient).where(Patient.pid == pid))
    if patient is None:
        patient = Patient(pid=pid, name=a.patient.name, date_of_birth=a.date_of_birth)
        db.add(patient)
        db.flush()
    else:
        patient.name, patient.date_of_birth = a.patient.name or patient.name, a.date_of_birth
    basis = out.combined if out.combined is not None else out.maternal_factors_only
    r37 = next(e for e in basis if e.cutoff_weeks == 37.0)
    s = Screening(
        patient_id=patient.id, version=(replaces.version + 1) if replaces else 1,
        replaces_id=replaces.id if replaces else None, status="draft",
        exam_date=a.exam_date, ga_days=out.ga_days,
        request=a.model_dump(mode="json"), form_state=body.form_state, result=out.model_dump(mode="json"),
        risk37_one_in=r37.one_in, high_risk=out.screen.high_risk,
        coefficient_set_id=coefficient_set_id(db), created_by=user.id,
    )
    db.add(s)
    if replaces:
        replaces.status = "superseded"
    db.flush()
    return s


@router.post("/screenings", status_code=201)
def save(body: SaveIn, request: Request, db: Session = Depends(get_db), user: User = Depends(require(*CLINICAL))):
    s = _store(db, body, user)
    audit.log(db, request, user, "create", "screening", s.id, pid=s.patient.pid)
    db.commit()
    return {**_summary(s), "result": s.result}


@router.get("/patients/{pid}/screenings")
def history(pid: str, request: Request, db: Session = Depends(get_db),
            user: User = Depends(require(*CLINICAL, "admin"))):
    patient = db.scalar(select(Patient).where(Patient.pid == pid))
    rows = [] if patient is None else db.scalars(
        select(Screening).where(Screening.patient_id == patient.id).order_by(Screening.id.desc())).all()
    audit.log(db, request, user, "view", "patient", pid, count=len(rows))
    db.commit()
    return [_summary(s) for s in rows]


@router.get("/screenings/{sid}")
def read(sid: int, request: Request, db: Session = Depends(get_db),
         user: User = Depends(require(*CLINICAL, "admin"))):
    s = _get(db, sid)
    audit.log(db, request, user, "view", "screening", sid)
    db.commit()
    return {**_summary(s), "request": s.request, "form_state": s.form_state, "result": s.result}


@router.post("/screenings/{sid}/sign")
def sign(sid: int, request: Request, db: Session = Depends(get_db), user: User = Depends(require("doctor"))):
    s = _get(db, sid)
    if s.status != "draft":
        raise HTTPException(409, f"screening is {s.status}; only a draft can be signed")
    s.status, s.signed_by, s.signed_at = "signed", user.id, datetime.now(timezone.utc)
    audit.log(db, request, user, "sign", "screening", sid)
    db.commit()
    return _summary(s)


@router.post("/screenings/{sid}/amend", status_code=201)
def amend(sid: int, body: SaveIn, request: Request, db: Session = Depends(get_db),
          user: User = Depends(require(*CLINICAL))):
    """A saved screening is never edited: a correction is a new version that replaces it."""
    old = _get(db, sid)
    if old.status == "superseded":
        raise HTTPException(409, "this version was already replaced; amend the latest one")
    if body.assessment.patient.pid.strip() != old.patient.pid:
        raise HTTPException(422, "an amendment must keep the same PID")
    s = _store(db, body, user, replaces=old)
    audit.log(db, request, user, "amend", "screening", s.id, replaces=old.id)
    db.commit()
    return {**_summary(s), "result": s.result}


@router.post("/screenings/{sid}/printed")
def printed(sid: int, request: Request, lang: str = "vi", db: Session = Depends(get_db),
            user: User = Depends(require(*CLINICAL))):
    _get(db, sid)
    audit.log(db, request, user, "print", "screening", sid, lang=lang)
    db.commit()
    return {"ok": True}


@router.put("/screenings/{sid}/outcome")
def set_outcome(sid: int, body: OutcomeIn, request: Request, db: Session = Depends(get_db),
                user: User = Depends(require(*CLINICAL))):
    s = _get(db, sid)
    if body.preeclampsia and body.pe_ga_days is None:
        raise HTTPException(422, "gestational age at PE is required when PE is yes")
    o = s.outcome or Outcome(screening_id=s.id, entered_by=user.id)
    for k, v in body.model_dump().items():
        setattr(o, k, v)
    o.entered_by, o.entered_at = user.id, datetime.now(timezone.utc)
    db.add(o)
    audit.log(db, request, user, "outcome", "screening", sid, preeclampsia=body.preeclampsia)
    db.commit()
    db.refresh(s)
    return _summary(s)


@router.get("/audit")
def audit_log(request: Request, username: str = "", action: str = "", limit: int = 200,
              db: Session = Depends(get_db), user: User = Depends(require("admin"))):
    q = select(AuditLog).order_by(AuditLog.id.desc()).limit(min(limit, 1000))
    if username:
        q = q.where(AuditLog.username == username)
    if action:
        q = q.where(AuditLog.action == action)
    rows = db.scalars(q).all()
    return [{"id": r.id, "at": r.at.isoformat(), "username": r.username, "action": r.action,
             "target_type": r.target_type, "target_id": r.target_id, "detail": r.detail, "ip": r.ip}
            for r in rows]


@router.get("/users")
def users(db: Session = Depends(get_db), user: User = Depends(require("admin"))):
    return [{"username": u.username, "display_name": u.display_name, "role": u.role, "active": u.active,
             "last_login": u.last_login.isoformat() if u.last_login else None}
            for u in db.scalars(select(User).order_by(User.username)).all()]


EXPORT_COLUMNS = [
    "screening_id", "patient_key", "exam_date", "ga_days", "age_years", "height_cm", "weight_kg", "ethnicity",
    "parity", "chronic_hypertension", "map_mom", "utpi_mom", "plgf_mom", "risk37_maternal_one_in",
    "risk37_combined_one_in", "risk32_combined_one_in", "high_risk", "status", "model_checksum",
    "delivery_date", "ga_at_delivery_days", "preeclampsia", "pe_ga_days", "aspirin",
]


@router.get("/export.csv")
def export(request: Request, db: Session = Depends(get_db), user: User = Depends(require("admin")),
           s: Settings = Depends(get_settings)):
    """De-identified research export: no name, PID or date of birth; one row per current screening."""
    rows = db.scalars(select(Screening).where(Screening.status != "superseded").order_by(Screening.id)).all()
    buf = io.StringIO()
    w = csv.DictWriter(buf, EXPORT_COLUMNS)
    w.writeheader()
    for sc in rows:
        req, res, o = sc.request, sc.result, sc.outcome
        mf = {e["cutoff_weeks"]: e["one_in"] for e in res["maternal_factors_only"]}
        cb = {e["cutoff_weeks"]: e["one_in"] for e in (res.get("combined") or [])}
        w.writerow({
            "screening_id": sc.id,
            "patient_key": hmac.new(s.export_salt.encode(), sc.patient.pid.encode(), hashlib.sha256).hexdigest()[:16],
            "exam_date": sc.exam_date.isoformat(), "ga_days": round(sc.ga_days, 1), "age_years": res["age_years"],
            "height_cm": req["height_cm"], "weight_kg": req["weight_kg"], "ethnicity": req["ethnicity"],
            "parity": "parous" if req.get("previous") else "nulliparous",
            "chronic_hypertension": req.get("chronic_hypertension"),
            "map_mom": res["moms"].get("map"), "utpi_mom": res["moms"].get("utpi"), "plgf_mom": res["moms"].get("plgf"),
            "risk37_maternal_one_in": mf.get(37.0), "risk37_combined_one_in": cb.get(37.0),
            "risk32_combined_one_in": cb.get(32.0), "high_risk": sc.high_risk, "status": sc.status,
            "model_checksum": res["model_checksum"],
            "delivery_date": o.delivery_date.isoformat() if o and o.delivery_date else "",
            "ga_at_delivery_days": o.ga_at_delivery_days if o else "", "preeclampsia": o.preeclampsia if o else "",
            "pe_ga_days": o.pe_ga_days if o else "", "aspirin": o.aspirin if o else "",
        })
    audit.log(db, request, user, "export", "screenings", "", rows=len(rows))
    db.commit()
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=pe_screenings.csv"})
