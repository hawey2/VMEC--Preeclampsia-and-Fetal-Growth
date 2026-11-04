"""HTTP API around the risk engine.

Phase 2 is stateless: it calculates and returns the report data. Storage,
sign-in and audit arrive in phase 3.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from pe_risk import (
    Assessment,
    Biomarkers,
    MaternalFactors,
    PreviousPregnancy,
    assess,
    coefficients,
    dating,
    mom,
)
from pe_risk.dating import DatingMethod

from .schemas import AssessmentIn, AssessmentOut, Risk, ScreenResult

CUTOFF_ONE_IN = int(os.environ.get("PE_CUTOFF_ONE_IN", "100"))
"""Department policy: high risk if risk of PE <37 weeks is 1 in N or higher."""

VN_TZ = timezone(timedelta(hours=7))

app = FastAPI(title="Vinmec preeclampsia risk API", version="0.2.0")
_coef = coefficients.load()


def _ga_days(a: AssessmentIn) -> float:
    d = a.dating
    if d.method is DatingMethod.CRL:
        return dating.ga_days_from_crl(d.crl_mm)
    if d.method is DatingMethod.LMP:
        return dating.ga_days_from_lmp(d.lmp, a.exam_date)
    if d.method is DatingMethod.EDD:
        return dating.ga_days_from_edd(d.edd, a.exam_date)
    if d.method is DatingMethod.IVF:
        return dating.ga_days_from_ivf(d.transfer_date, d.embryo_age_days, a.exam_date)
    return dating.ga_days_manual(d.weeks, d.days)


def _age_years(dob, on) -> float:
    return (on - dob).days / 365.25


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/model")
def model_info():
    return {
        "label": _coef.label,
        "checksum": _coef.checksum,
        "cutoff_one_in": CUTOFF_ONE_IN,
        "verification": {k: _coef.verification(k) for k in ("prior", "mom", "likelihood")},
        "combined_available": _coef.has_likelihood(),
    }


@app.post("/api/assess", response_model=AssessmentOut)
def run_assessment(a: AssessmentIn) -> AssessmentOut:
    try:
        ga = _ga_days(a)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e

    warnings: list[str] = []
    interval = None
    previous = None
    if a.previous is not None:
        conception = a.exam_date - timedelta(days=round(ga) - 14)
        interval = (conception - a.previous.delivery_date).days / 365.25
        if interval <= 0:
            raise HTTPException(422, "previous delivery date must be before this conception")
        previous = PreviousPregnancy(a.previous.had_pe, a.previous.ga_at_delivery_weeks, interval)
    if a.vanishing_twin:
        warnings.append("Vanishing twin recorded: the model does not adjust for it; PlGF may be affected.")

    mf = MaternalFactors(
        age_years=_age_years(a.date_of_birth, a.exam_date),
        weight_kg=a.weight_kg,
        height_cm=a.height_cm,
        ethnicity=a.ethnicity,
        smoker=a.smoker,
        conception=a.conception,
        chronic_hypertension=a.chronic_hypertension,
        diabetes=a.diabetes,
        sle_or_aps=a.sle_or_aps,
        family_history_pe=a.family_history_pe,
        previous=previous,
    )

    b = a.biomarkers
    map_mmhg = b.map_mmhg
    if b.map_readings:
        map_mmhg = mom.mean_arterial_pressure(b.map_readings)
    utpi_mean = (b.utpi_left + b.utpi_right) / 2 if b.utpi_left and b.utpi_right else None

    try:
        r = assess(Assessment(
            ga_days=ga,
            maternal=mf,
            biomarkers=Biomarkers(
                map_mmhg=map_mmhg, map_mom=b.map_mom,
                utpi_left=b.utpi_left, utpi_right=b.utpi_right, utpi_mom=b.utpi_mom,
                plgf_pg_ml=b.plgf_pg_ml, plgf_analyser=b.plgf_analyser, plgf_mom=b.plgf_mom,
            ),
        ), _coef)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e

    def risks(lst):
        return [Risk(cutoff_weeks=e.cutoff_weeks, probability=e.probability, one_in=e.one_in) for e in lst]

    basis = r.combined if r.combined is not None else r.maternal_factors_only
    preterm = next(e for e in basis if e.cutoff_weeks == 37.0)
    screen = ScreenResult(
        basis="combined" if r.combined is not None else "maternal_factors_only",
        cutoff_one_in=CUTOFF_ONE_IN,
        high_risk=preterm.probability >= 1 / CUTOFF_ONE_IN,
    )

    return AssessmentOut(
        patient=a.patient,
        exam_date=a.exam_date,
        ga_days=ga,
        ga_label=dating.format_ga(ga),
        edd=dating.edd_from_ga(ga, a.exam_date),
        dating_method=a.dating.method,
        age_years=round(mf.age_years, 1),
        interval_years=round(interval, 2) if interval is not None else None,
        map_mmhg=round(map_mmhg, 1) if map_mmhg is not None else None,
        utpi_mean=round(utpi_mean, 2) if utpi_mean is not None else None,
        plgf_pg_ml=b.plgf_pg_ml,
        plgf_analyser=b.plgf_analyser if b.plgf_pg_ml is not None else None,
        moms={k: round(v, 3) for k, v in r.moms.items()},
        maternal_factors_only=risks(r.maternal_factors_only),
        combined=risks(r.combined) if r.combined is not None else None,
        markers_used=r.markers_used,
        screen=screen,
        model_label=r.model_label,
        model_checksum=r.model_checksum,
        warnings=warnings + r.warnings,
        generated_at=datetime.now(VN_TZ).isoformat(timespec="seconds"),
    )


_web = Path(os.environ.get("PE_WEB_DIST", Path(__file__).resolve().parents[2] / "web" / "dist"))
if _web.is_dir():
    app.mount("/assets", StaticFiles(directory=_web / "assets"), name="assets")

    @app.get("/")
    def index():
        return FileResponse(_web / "index.html")
