"""Write parity_cases.json: random requests and what the Python API returns for them.

web/tests/parity.test.ts runs the same requests through the browser engine (src/engine/) and
checks the results match. Re-run this whenever the Python engine or the coefficients change:

    python web/tests/make_parity_cases.py
"""

from __future__ import annotations

import json
import random
from datetime import date, timedelta
from pathlib import Path

from fastapi import HTTPException

from pe_api.assessment import compute
from pe_api.schemas import AssessmentIn

N = 300
rng = random.Random(20261104)


def d(x: date) -> str:
    return x.isoformat()


def maybe(p: float) -> bool:
    return rng.random() < p


def request() -> dict:
    exam = date(2026, 1, 1) + timedelta(days=rng.randint(0, 600))
    method = rng.choice(["crl", "crl", "crl", "bpd", "lmp", "edd", "ivf", "manual"])
    ga = rng.randint(78, 96)
    dating: dict = {"method": method}
    if method == "crl":
        dating["crl_mm"] = round(rng.uniform(45, 84), 1)
    elif method == "bpd":
        dating["bpd_mm"] = round(rng.uniform(16, 27), 1)
    elif method == "lmp":
        dating["lmp"] = d(exam - timedelta(days=ga))
    elif method == "edd":
        dating["edd"] = d(exam + timedelta(days=280 - ga))
    elif method == "ivf":
        age = rng.choice([3, 5])
        dating["transfer_date"] = d(exam - timedelta(days=ga - age - 14))
        dating["embryo_age_days"] = age
    else:
        dating.update(weeks=ga // 7, days=ga % 7)

    previous = None
    if maybe(0.5):
        gap_days = rng.choice([rng.randint(200, 400), rng.randint(400, 5000)])
        previous = {
            "had_pe": maybe(0.3),
            "ga_at_delivery_weeks": round(rng.uniform(26, 42), 1),
            "delivery_date": d(exam - timedelta(days=ga - 14 + gap_days)),
        }

    bm: dict = {}
    if maybe(0.8):
        if maybe(0.7):
            bm["map_readings"] = [[rng.randint(95, 150), rng.randint(55, 100)] for _ in range(rng.choice([1, 2, 4]))]
        else:
            bm["map_mmhg"] = round(rng.uniform(65, 115), 1)
    elif maybe(0.3):
        bm["map_mom"] = round(rng.uniform(0.7, 1.4), 3)
    if maybe(0.8):
        bm["utpi_left"] = round(rng.uniform(0.6, 3.5), 2)
        bm["utpi_right"] = round(rng.uniform(0.6, 3.5), 2)
    elif maybe(0.2):
        bm["utpi_left"] = round(rng.uniform(0.6, 3.5), 2)  # one side only: a warning
    if maybe(0.6):
        if maybe(0.85):
            bm["plgf_pg_ml"] = round(rng.uniform(8, 150), 1)
            bm["plgf_analyser"] = rng.choice(["delfia_xpress", "cobas_e411", "kryptor"])
            if maybe(0.3):
                bm["plgf_sample_date"] = d(exam - timedelta(days=rng.randint(0, 3)))
        else:
            bm["plgf_mom"] = round(rng.uniform(0.2, 3.0), 3)
    if maybe(0.2):
        bm["oa_psv"] = {"right_psv1": 30.0, "right_psv2": 25.0, "left_psv1": 32.0, "left_psv2": 24.0}

    dob = exam - timedelta(days=rng.randint(18 * 365, 47 * 365))
    return {
        "patient": {"name": "", "pid": ""},
        "exam_date": d(exam),
        "date_of_birth": d(dob),
        "height_cm": round(rng.uniform(140, 185), 1),
        "weight_kg": round(rng.uniform(40, 120), 1),
        "ethnicity": rng.choice(["white", "afro_caribbean", "south_asian", "east_asian", "mixed"]),
        "smoker": maybe(0.1),
        "dating": dating,
        "fetal_heart_activity": not maybe(0.02),
        "conception": rng.choice(["spontaneous", "spontaneous", "ovulation_drugs", "ivf"]),
        "vanishing_twin": maybe(0.05),
        "chronic_hypertension": maybe(0.15),
        "diabetes": rng.choice(["none"] * 6 + ["type1", "type2_insulin", "type2_no_insulin"]),
        "sle_or_aps": maybe(0.08),
        "family_history_pe": maybe(0.15),
        "previous": previous,
        "biomarkers": bm,
    }


cases = []
while len(cases) < N:
    req = request()
    try:
        out = compute(AssessmentIn.model_validate(req)).model_dump(mode="json")
        del out["generated_at"]  # the clock: keeps this file the same on every run
        cases.append({"request": req, "response": out})
    except HTTPException as e:
        cases.append({"request": req, "error": e.detail})

Path(__file__).with_name("parity_cases.json").write_text(json.dumps(cases, separators=(",", ":")) + "\n")
print(f"{len(cases)} cases, {sum('error' in c for c in cases)} with errors")
