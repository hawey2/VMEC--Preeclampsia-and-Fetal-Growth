"""Cloud deployment: accounts kept by the app (PE_AUTH_MODE=local)."""

import io
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from pe_api import users
from pe_api.config import Settings
from pe_api.main import create_app
from pe_api.passwords import hash_password, verify_password
from test_api import BASE

ADMIN_PW = "Admin-pass-2026"


@pytest.fixture
def local(tmp_path, monkeypatch):
    url = os.environ.get("PE_TEST_DATABASE_URL") or f"sqlite:///{tmp_path / 'pe.db'}"
    if url.startswith("postgresql"):
        eng = create_engine(url)
        with eng.begin() as conn:
            conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public"))
        eng.dispose()
    # First administrator from the command line, as the setup guide says.
    monkeypatch.setenv("PE_DATABASE_URL", url)
    monkeypatch.setattr("sys.stdin", io.StringIO(ADMIN_PW + "\n"))
    users.main(["add", "boss", "Head of department", "admin", "--password-stdin"])
    app = create_app(Settings(database_url=url, auth_mode="local", session_idle_minutes=15))
    opened = []

    def client(username=None, password=None):
        c = TestClient(app)
        c.__enter__()
        opened.append(c)
        if username:
            r = c.post("/api/auth/login", json={"username": username, "password": password})
            assert r.status_code == 200, r.text
        return c

    yield client
    for c in opened:
        c.__exit__(None, None, None)


def test_hashes_are_salted_and_verify():
    a, b = hash_password("same-password-1"), hash_password("same-password-1")
    assert a != b and a.startswith("scrypt$")
    assert verify_password("same-password-1", a) and not verify_password("other-password", a)
    assert not verify_password("anything", None)


def test_first_admin_must_change_password_before_working(local):
    boss = local("boss", ADMIN_PW)
    me = boss.get("/api/auth/me").json()
    assert me["must_change_password"] is True and me["auth_mode"] == "local"
    assert boss.get("/api/users").status_code == 403  # blocked until the password is changed
    assert boss.post("/api/auth/password", json={"current": "wrong", "new": "x" * 12}).status_code == 422
    assert boss.post("/api/auth/password", json={"current": ADMIN_PW, "new": "short"}).status_code == 422
    r = boss.post("/api/auth/password", json={"current": ADMIN_PW, "new": "Head-new-pass-1"})
    assert r.status_code == 200 and r.json()["must_change_password"] is False
    assert boss.get("/api/users").status_code == 200


def test_admin_adds_staff_who_then_save_screenings(local):
    boss = local("boss", ADMIN_PW)
    boss.post("/api/auth/password", json={"current": ADMIN_PW, "new": "Head-new-pass-1"})
    r = boss.post("/api/users", json={"username": "lan.nt", "display_name": "Nguyễn Thị Lan",
                                      "role": "sonographer", "password": "Temp-pass-123"})
    assert r.status_code == 201, r.text
    assert boss.post("/api/users", json={"username": "lan.nt", "display_name": "x", "role": "doctor",
                                         "password": "Temp-pass-123"}).status_code == 409
    assert boss.post("/api/users", json={"username": "weak", "display_name": "x", "role": "doctor",
                                         "password": "short"}).status_code == 422

    lan = local("lan.nt", "Temp-pass-123")
    assert lan.post("/api/assess", json=BASE).status_code == 403  # change password first
    lan.post("/api/auth/password", json={"current": "Temp-pass-123", "new": "Lan-own-pass-9"})
    body = {**BASE, "patient": {"name": "Test", "pid": "CLOUD-1"}}
    s = lan.post("/api/screenings", json={"assessment": body, "form_state": None})
    assert s.status_code == 201, s.text
    assert s.json()["created_by"] == "Nguyễn Thị Lan"
    assert lan.get("/api/users").status_code == 403  # staff cannot manage accounts

    # The record is still there after signing out and in again.
    lan.post("/api/auth/logout")
    again = local("lan.nt", "Lan-own-pass-9")
    assert [h["pid"] for h in again.get("/api/patients/CLOUD-1/screenings").json()] == ["CLOUD-1"]


def test_disable_and_reset_end_sessions(local):
    boss = local("boss", ADMIN_PW)
    boss.post("/api/auth/password", json={"current": ADMIN_PW, "new": "Head-new-pass-1"})
    boss.post("/api/users", json={"username": "minh", "display_name": "Minh", "role": "doctor", "password": "Temp-pass-123"})
    minh = local("minh", "Temp-pass-123")
    assert minh.get("/api/auth/me").status_code == 200
    assert boss.patch("/api/users/minh", json={"active": False}).json()["active"] is False
    assert minh.get("/api/auth/me").status_code == 401
    assert local().post("/api/auth/login", json={"username": "minh", "password": "Temp-pass-123"}).status_code == 401
    r = boss.patch("/api/users/minh", json={"active": True, "password": "Another-temp-1"})
    assert r.json()["must_change_password"] is True
    assert local().post("/api/auth/login", json={"username": "minh", "password": "Another-temp-1"}).status_code == 200
    assert boss.patch("/api/users/boss", json={"active": False}).status_code == 422  # not your own account


def test_five_wrong_passwords_lock_the_account(local):
    c = local()
    for _ in range(5):
        assert c.post("/api/auth/login", json={"username": "boss", "password": "wrong-password"}).status_code == 401
    r = c.post("/api/auth/login", json={"username": "boss", "password": ADMIN_PW})
    assert r.status_code == 401 and r.json()["detail"] == "account locked"


def test_user_management_is_refused_in_ldap_or_dev_mode(make_client):
    admin = make_client("admin")
    assert admin.post("/api/users", json={"username": "x1", "display_name": "x", "role": "doctor",
                                          "password": "Temp-pass-123"}).status_code == 409
