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
    Analyser,
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
from pe_risk.prior import prior_terms

from .schemas import (
    AssessmentIn,
    AssessmentOut,
    Bpd,
    Combination,
    PriorTerm,
    Risk,
    ScreenResult,
)

CUTOFF_ONE_IN = int(os.environ.get("PE_CUTOFF_ONE_IN", "100"))
"""Department policy: high risk if risk of PE <37 weeks is 1 in N or higher."""

VN_TZ = timezone(timedelta(hours=7))
CURVE_DAYS = range(77, 99)  # 11+0 to 14+0

app = FastAPI(title="Vinmec preeclampsia risk API", version="0.3.0")
_coef = coefficients.load()


def _ga_days(a: AssessmentIn) -> float:
    d = a.dating
    if d.method is DatingMethod.CRL:
        return dating.ga_days_from_crl(d.crl_mm)
    if d.method is DatingMethod.BPD:
        return dating.ga_days_from_bpd(d.bpd_mm)
    if d.method is DatingMethod.LMP:
        return dating.ga_days_from_lmp(d.lmp, a.exam_date)
    if d.method is DatingMethod.EDD:
        return dating.ga_days_from_edd(d.edd, a.exam_date)
    if d.method is DatingMethod.IVF:
        return dating.ga_days_from_ivf(d.transfer_date, d.embryo_age_days, a.exam_date)
    return dating.ga_days_manual(d.weeks, d.days)


def _age_years(dob, on) -> float:
    return (on - dob).days / 365.25


def _oa_ratio(a: AssessmentIn) -> float | None:
    """FMF protocol: PSV2/PSV1 per eye, then the mean of the two eyes."""
    o = a.biomarkers.oa_psv
    if o is None:
        return None
    ratios = [p2 / p1 for p1, p2 in ((o.right_psv1, o.right_psv2), (o.left_psv1, o.left_psv2)) if p1 and p2]
    return sum(ratios) / len(ratios) if ratios else None


def _risk(e) -> Risk:
    return Risk(cutoff_weeks=e.cutoff_weeks, probability=e.probability, one_in=e.one_in)


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
    if not a.fetal_heart_activity:
        raise HTTPException(422, "fetal heart activity is absent: risk assessment does not apply")
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

    plgf_ga = None
    if b.plgf_sample_date is not None and (b.plgf_pg_ml is not None or b.plgf_mom is not None):
        plgf_ga = ga - (a.exam_date - b.plgf_sample_date).days
        if not 77 <= plgf_ga <= 97:
            raise HTTPException(422, "PlGF sample must be taken at 11+0 to 13+6 weeks")

    oa_ratio = _oa_ratio(a)
    if oa_ratio is not None:
        warnings.append("Ophthalmic artery PSV ratio is recorded but not used in the risk: no published model is loaded.")

    def run(markers: set[str]):
        return assess(Assessment(
            ga_days=ga,
            maternal=mf,
            biomarkers=Biomarkers(
                map_mmhg=map_mmhg if "map" in markers else None,
                map_mom=b.map_mom if "map" in markers else None,
                utpi_left=b.utpi_left if "utpi" in markers else None,
                utpi_right=b.utpi_right if "utpi" in markers else None,
                utpi_mom=b.utpi_mom if "utpi" in markers else None,
                plgf_pg_ml=b.plgf_pg_ml if "plgf" in markers else None,
                plgf_analyser=b.plgf_analyser,
                plgf_mom=b.plgf_mom if "plgf" in markers else None,
                plgf_ga_days=plgf_ga,
            ),
        ), _coef)

    try:
        r = run({"map", "utpi", "plgf"})
    except ValueError as e:
        raise HTTPException(422, str(e)) from e

    # Risk lines as the FMF app lists them: history alone, then each marker added.
    present = [m for m in ("map", "utpi", "plgf") if m in r.moms]
    combos = [Combination(markers=[], risk32=_risk(r.maternal_factors_only[0]),
                          risk37=_risk(r.maternal_factors_only[1]))]
    sets = [[m] for m in present]
    if len(present) > 1:
        sets.append(present)
    for s in sets:
        sub = run(set(s)) if r.combined is not None else None
        combos.append(Combination(
            markers=s,
            risk32=_risk(sub.combined[0]) if sub and sub.combined else None,
            risk37=_risk(sub.combined[1]) if sub and sub.combined else None,
        ))

    basis = r.combined if r.combined is not None else r.maternal_factors_only
    preterm = next(e for e in basis if e.cutoff_weeks == 37.0)
    screen = ScreenResult(
        basis="combined" if r.combined is not None else "maternal_factors_only",
        cutoff_one_in=CUTOFF_ONE_IN,
        high_risk=preterm.probability >= 1 / CUTOFF_ONE_IN,
    )

    analyser = b.plgf_analyser or Analyser.COBAS_E411
    expected = {
        "map": 10 ** mom.expected_log10_map(ga, mf, _coef),
        "utpi": 10 ** mom.expected_log10_utpi(ga, mf, _coef),
        "plgf": 10 ** mom.expected_log10_plgf(plgf_ga or ga, mf, analyser, _coef),
    }
    curves = {
        "map": [(d, 10 ** mom.expected_log10_map(d, mf, _coef)) for d in CURVE_DAYS],
        "utpi": [(d, 10 ** mom.expected_log10_utpi(d, mf, _coef)) for d in CURVE_DAYS],
        "plgf": [(d, 10 ** mom.expected_log10_plgf(d, mf, analyser, _coef)) for d in CURVE_DAYS],
    }

    bpd = None
    if a.dating.bpd_mm is not None and 15 <= a.dating.bpd_mm <= 28:
        bpd = Bpd(measured_mm=a.dating.bpd_mm, median_mm=round(dating.bpd_median_mm(ga), 2),
                  ga_days_from_bpd=round(dating.ga_days_from_bpd(a.dating.bpd_mm), 1))

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
        maternal_factors_only=[_risk(e) for e in r.maternal_factors_only],
        combined=[_risk(e) for e in r.combined] if r.combined is not None else None,
        markers_used=r.markers_used,
        screen=screen,
        model_label=r.model_label,
        model_checksum=r.model_checksum,
        warnings=warnings + r.warnings,
        generated_at=datetime.now(VN_TZ).isoformat(timespec="seconds"),
        prior_terms=[PriorTerm(name=n, weeks=round(v, 4)) for n, v in prior_terms(mf, _coef)],
        prior_mean_weeks=round(r.prior_mean_weeks, 3),
        prior_sd_weeks=r.prior_sd_weeks,
        expected_medians={k: round(v, 3) for k, v in expected.items()},
        curves={k: [(d, round(v, 4)) for d, v in pts] for k, pts in curves.items()},
        plgf_sample_ga_days=plgf_ga,
        bpd=bpd,
        oa_psv_ratio=round(oa_ratio, 3) if oa_ratio is not None else None,
        map_operator=b.map_operator,
        utpi_operator=b.utpi_operator,
        combinations=combos,
    )


_web = Path(os.environ.get("PE_WEB_DIST", Path(__file__).resolve().parents[2] / "web" / "dist"))
if _web.is_dir():
    app.mount("/assets", StaticFiles(directory=_web / "assets"), name="assets")

    @app.get("/")
    def index():
        return FileResponse(_web / "index.html")
