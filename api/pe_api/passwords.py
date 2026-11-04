"""Password hashing for app-owned accounts (cloud deployment, PE_AUTH_MODE=local).

scrypt from the Python standard library; each hash carries its own salt and parameters:
``scrypt$<n>$<r>$<p>$<salt b64>$<hash b64>``.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets

N, R, P = 2**14, 8, 1
MIN_LENGTH = 10


class WeakPassword(ValueError):
    pass


def check_strength(password: str, username: str = "") -> None:
    if len(password) < MIN_LENGTH:
        raise WeakPassword(f"password must have at least {MIN_LENGTH} characters")
    if username and username.lower() in password.lower():
        raise WeakPassword("password must not contain the username")


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=N, r=R, p=P, dklen=32)
    b64 = lambda b: base64.b64encode(b).decode()  # noqa: E731
    return f"scrypt${N}${R}${P}${b64(salt)}${b64(digest)}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        # Same work as a real check, so timing does not reveal unknown usernames.
        hashlib.scrypt(password.encode(), salt=b"0" * 16, n=N, r=R, p=P, dklen=32)
        return False
    try:
        _, n, r, p, salt, digest = stored.split("$")
        got = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt), n=int(n), r=int(r), p=int(p),
                             dklen=len(base64.b64decode(digest)))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(got, base64.b64decode(digest))
