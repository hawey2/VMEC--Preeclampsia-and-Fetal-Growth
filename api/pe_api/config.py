"""Settings, all from environment variables (see deploy/.env.example)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


@dataclass(frozen=True)
class Settings:
    database_url: str = field(default_factory=lambda: _env("PE_DATABASE_URL", "sqlite:///./pe_local.db"))
    # "ldap" in the hospital; "dev" = accounts listed in PE_DEV_USERS, for local use and tests only.
    auth_mode: str = field(default_factory=lambda: _env("PE_AUTH_MODE", "dev"))
    dev_users: str = field(default_factory=lambda: _env(
        "PE_DEV_USERS", "sono:sono:sonographer,doctor:doctor:doctor,admin:admin:admin"))
    ldap_url: str = field(default_factory=lambda: _env("PE_LDAP_URL"))
    ldap_bind_dn: str = field(default_factory=lambda: _env("PE_LDAP_BIND_DN"))
    ldap_bind_password: str = field(default_factory=lambda: _env("PE_LDAP_BIND_PASSWORD"))
    ldap_base_dn: str = field(default_factory=lambda: _env("PE_LDAP_BASE_DN"))
    ldap_user_filter: str = field(default_factory=lambda: _env("PE_LDAP_USER_FILTER", "(sAMAccountName={username})"))
    ldap_group_sonographer: str = field(default_factory=lambda: _env("PE_LDAP_GROUP_SONOGRAPHER"))
    ldap_group_doctor: str = field(default_factory=lambda: _env("PE_LDAP_GROUP_DOCTOR"))
    ldap_group_admin: str = field(default_factory=lambda: _env("PE_LDAP_GROUP_ADMIN"))
    session_idle_minutes: int = field(default_factory=lambda: int(_env("PE_SESSION_IDLE_MINUTES", "15")))
    cookie_secure: bool = field(default_factory=lambda: _env("PE_COOKIE_SECURE", "0") == "1")
    # Key for the pseudonymous patient number in research exports. Set a long random value in production.
    export_salt: str = field(default_factory=lambda: _env("PE_EXPORT_SALT", "change-me"))


def get_settings() -> Settings:
    return Settings()
