"""Phase 3: sign-in, roles, saved screenings, versions, outcomes, audit, export."""

import copy

from sqlalchemy import text

from pe_api import db
from test_api import BASE


def save(c, body=BASE, form=None):
    return c.post("/api/screenings", json={"assessment": body, "form_state": form})


def test_everything_needs_sign_in(make_client):
    c = make_client(None)
    assert c.get("/api/health").status_code == 200
    assert c.post("/api/assess", json=BASE).status_code == 401
    assert save(c).status_code == 401
    assert c.get("/api/audit").status_code == 401


def test_wrong_password_is_refused_and_logged(make_client):
    c = make_client(None)
    assert c.post("/api/auth/login", json={"username": "sono", "password": "nope"}).status_code == 401
    admin = make_client("admin")
    actions = [(r["username"], r["action"]) for r in admin.get("/api/audit").json()]
    assert ("sono", "login_failed") in actions


def test_save_view_sign_print_outcome_cycle(make_client):
    sono, doctor = make_client("sono"), make_client("doctor")
    r = save(sono, form={"pid": "TEST-0001", "crl_mm": "62"})
    assert r.status_code == 201, r.text
    s = r.json()
    assert s["status"] == "draft" and s["version"] == 1 and s["pid"] == "TEST-0001"
    assert s["result"]["ga_label"] == "12+3" and s["risk37_one_in"] > 0

    assert sono.post(f"/api/screenings/{s['id']}/sign").status_code == 403  # sonographers cannot sign
    signed = doctor.post(f"/api/screenings/{s['id']}/sign").json()
    assert signed["status"] == "signed" and signed["signed_by"] == "doctor"
    assert doctor.post(f"/api/screenings/{s['id']}/sign").status_code == 409

    full = sono.get(f"/api/screenings/{s['id']}").json()
    assert full["form_state"] == {"pid": "TEST-0001", "crl_mm": "62"}
    assert full["result"] == s["result"]  # the stored report reprints identically

    assert sono.post(f"/api/screenings/{s['id']}/printed?lang=en").json() == {"ok": True}

    bad = sono.put(f"/api/screenings/{s['id']}/outcome", json={"preeclampsia": True})
    assert bad.status_code == 422
    out = sono.put(f"/api/screenings/{s['id']}/outcome",
                   json={"delivery_date": "2027-05-01", "ga_at_delivery_days": 252,
                         "preeclampsia": True, "pe_ga_days": 250, "aspirin": True})
    assert out.json()["outcome"]["pe_ga_days"] == 250

    hist = sono.get("/api/patients/TEST-0001/screenings").json()
    assert [h["id"] for h in hist] == [s["id"]]


def test_amend_creates_a_new_version(make_client):
    sono = make_client("sono")
    first = save(sono).json()
    changed = copy.deepcopy(BASE)
    changed["weight_kg"] = 60
    second = sono.post(f"/api/screenings/{first['id']}/amend", json={"assessment": changed}).json()
    assert second["version"] == 2 and second["replaces_id"] == first["id"]
    hist = sono.get("/api/patients/TEST-0001/screenings").json()
    assert [(h["version"], h["status"]) for h in hist] == [(2, "draft"), (1, "superseded")]
    assert sono.post(f"/api/screenings/{first['id']}/amend", json={"assessment": changed}).status_code == 409
    other = copy.deepcopy(BASE)
    other["patient"]["pid"] = "OTHER"
    assert sono.post(f"/api/screenings/{second['id']}/amend", json={"assessment": other}).status_code == 422


def test_pid_required_to_save(make_client):
    body = copy.deepcopy(BASE)
    body["patient"]["pid"] = " "
    assert save(make_client("sono"), body).status_code == 422


def test_audit_and_export_are_admin_only(make_client):
    sono, admin = make_client("sono"), make_client("admin")
    sid = save(sono).json()["id"]
    sono.get(f"/api/screenings/{sid}")
    assert sono.get("/api/audit").status_code == 403
    assert sono.get("/api/export.csv").status_code == 403
    assert admin.post("/api/assess", json=BASE).status_code == 403  # admins do not screen

    log = admin.get("/api/audit?username=sono").json()
    assert {"login", "create", "view"} <= {r["action"] for r in log}

    csv_text = admin.get("/api/export.csv").text
    header, row = csv_text.splitlines()[:2]
    assert header.startswith("screening_id,patient_key,exam_date")
    assert "TEST-0001" not in csv_text and "Nguyen" not in csv_text  # de-identified
    assert "export" in {r["action"] for r in admin.get("/api/audit?action=export").json()}
    assert {u["username"] for u in admin.get("/api/users").json()} == {"sono", "admin"}


def test_session_expires_when_idle(make_client):
    sono = make_client("sono")
    with db.engine().begin() as conn:
        conn.execute(text("UPDATE sessions SET last_seen = '2000-01-01 00:00:00'"))
    r = sono.get("/api/auth/me")
    assert r.status_code == 401 and "expired" in r.text


def test_logout(make_client):
    sono = make_client("sono")
    assert sono.get("/api/auth/me").json()["role"] == "sonographer"
    sono.post("/api/auth/logout")
    assert sono.get("/api/auth/me").status_code == 401


def test_audit_log_cannot_be_changed_on_postgresql(make_client):
    make_client("sono")
    if db.engine().dialect.name != "postgresql":
        return  # the trigger exists only on PostgreSQL
    import pytest
    from sqlalchemy.exc import DBAPIError
    with pytest.raises(DBAPIError, match="append-only"):
        with db.engine().begin() as conn:
            conn.execute(text("DELETE FROM audit_log"))
