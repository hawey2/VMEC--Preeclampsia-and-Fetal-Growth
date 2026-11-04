import copy

import pytest
from fastapi.testclient import TestClient

from pe_api.main import app

client = TestClient(app)

BASE = {
    "patient": {"name": "Nguyen Thi A", "pid": "TEST-0001"},
    "exam_date": "2026-11-04",
    "date_of_birth": "1994-05-20",
    "height_cm": 156,
    "weight_kg": 55,
    "ethnicity": "east_asian",
    "dating": {"method": "crl", "crl_mm": 62},
    "biomarkers": {
        "map_readings": [[110, 70], [112, 72], [108, 70], [110, 71]],
        "utpi_left": 1.6, "utpi_right": 1.9,
        "plgf_pg_ml": 32, "plgf_analyser": "cobas_e411",
    },
}


def post(body):
    return client.post("/api/assess", json=body)


def test_health_and_model():
    assert client.get("/api/health").json() == {"status": "ok"}
    m = client.get("/api/model").json()
    assert m["label"] == "fmf-11-13-v1"
    assert m["combined_available"] is False
    assert m["cutoff_one_in"] == 100


def test_full_assessment():
    r = post(BASE)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["ga_label"] == "12+3"
    assert out["age_years"] == 32.5
    assert set(out["moms"]) == {"map", "utpi", "plgf"}
    assert out["map_mmhg"] == pytest.approx(83.83, abs=0.05)
    assert out["utpi_mean"] == 1.75
    assert out["combined"] is None
    assert out["screen"]["basis"] == "maternal_factors_only"
    assert out["screen"]["high_risk"] is False
    assert [x["cutoff_weeks"] for x in out["maternal_factors_only"]] == [32, 37]
    assert any("not for clinical use" in w for w in out["warnings"])
    assert len(out["model_checksum"]) == 64


def test_high_risk_history_screens_positive():
    body = copy.deepcopy(BASE)
    body["chronic_hypertension"] = True
    body["previous"] = {"had_pe": True, "ga_at_delivery_weeks": 33, "delivery_date": "2023-03-01"}
    out = post(body).json()
    assert out["screen"]["high_risk"] is True
    assert out["interval_years"] == pytest.approx(3.4, abs=0.1)


@pytest.mark.parametrize("dating, label", [
    ({"method": "lmp", "lmp": "2026-08-12"}, "12+0"),
    ({"method": "edd", "edd": "2027-05-19"}, "12+0"),
    ({"method": "ivf", "transfer_date": "2026-08-31", "embryo_age_days": 5}, "12+0"),
    ({"method": "manual", "weeks": 13, "days": 2}, "13+2"),
])
def test_dating_methods(dating, label):
    body = {**BASE, "dating": dating}
    out = post(body).json()
    assert out["ga_label"] == label


@pytest.mark.parametrize("change, fragment", [
    ({"dating": {"method": "hc"}}, "not available yet"),
    ({"dating": {"method": "lmp"}}, "needs: lmp"),
    ({"dating": {"method": "manual", "weeks": 20, "days": 0}}, "outside 11+0 to 13+6"),
    ({"date_of_birth": "2030-01-01"}, "date of birth"),
    ({"height_cm": 90}, "greater than or equal"),
])
def test_validation_errors(change, fragment):
    r = post({**BASE, **change})
    assert r.status_code == 422
    assert fragment in r.text


def test_vanishing_twin_warns():
    out = post({**BASE, "vanishing_twin": True}).json()
    assert any("Vanishing twin" in w for w in out["warnings"])


def test_extra_outputs_for_charts_and_formulas():
    body = copy.deepcopy(BASE)
    body["dating"]["bpd_mm"] = 21.5
    body["biomarkers"]["plgf_sample_date"] = "2026-11-01"
    body["biomarkers"]["oa_psv"] = {"right_psv1": 40, "right_psv2": 28, "left_psv1": 42, "left_psv2": 30}
    body["biomarkers"]["map_operator"] = "MW Lan"
    out = post(body).json()
    terms = {t["name"]: t["weeks"] for t in out["prior_terms"]}
    assert sum(terms.values()) == pytest.approx(out["prior_mean_weeks"], abs=1e-3)
    assert out["prior_sd_weeks"] == 6.8833
    assert set(out["curves"]) == {"map", "utpi", "plgf"} and len(out["curves"]["utpi"]) == 22
    assert out["plgf_sample_ga_days"] == pytest.approx(out["ga_days"] - 3)
    assert out["bpd"]["median_mm"] == pytest.approx(0.4299 * out["ga_days"] - 16.33798, abs=0.01)
    assert out["oa_psv_ratio"] == pytest.approx((28 / 40 + 30 / 42) / 2, abs=1e-3)
    assert any("Ophthalmic" in w for w in out["warnings"])
    assert out["map_operator"] == "MW Lan"
    # history line + one line per marker + all markers together
    assert [c["markers"] for c in out["combinations"]] == [[], ["map"], ["utpi"], ["plgf"], ["map", "utpi", "plgf"]]
    assert out["combinations"][1]["risk37"] is None  # likelihood not loaded


def test_bpd_dating_and_absent_heart():
    assert post({**BASE, "dating": {"method": "bpd", "bpd_mm": 23}}).json()["ga_label"] == "13+0"
    r = post({**BASE, "fetal_heart_activity": False})
    assert r.status_code == 422 and "heart" in r.text
