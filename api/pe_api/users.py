"""Manage app-owned accounts from the server's command line (cloud deployment, PE_AUTH_MODE=local).

The first administrator is created this way; after that, administrators manage accounts in the app.

    docker compose exec app python -m pe_api.users add <username> "<full name>" admin
    docker compose exec app python -m pe_api.users reset-password <username>
    docker compose exec app python -m pe_api.users list

The password is asked for twice (or read from stdin with --password-stdin) and must be changed at the
first sign-in.
"""

from __future__ import annotations

import argparse
import getpass
import sys

from sqlalchemy import select

from . import db, migrate
from .config import get_settings
from .models import User
from .passwords import WeakPassword, check_strength, hash_password


def _password(args, username: str) -> str:
    if args.password_stdin:
        pw = sys.stdin.readline().rstrip("\n")
    else:
        pw = getpass.getpass("Temporary password: ")
        if pw != getpass.getpass("Again: "):
            sys.exit("The two passwords are different.")
    try:
        check_strength(pw, username)
    except WeakPassword as e:
        sys.exit(str(e))
    return pw


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(prog="python -m pe_api.users", description=__doc__.split("\n\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("add", help="add an account")
    a.add_argument("username")
    a.add_argument("display_name")
    a.add_argument("role", choices=["sonographer", "doctor", "admin"])
    a.add_argument("--password-stdin", action="store_true")
    r = sub.add_parser("reset-password", help="set a temporary password and unlock the account")
    r.add_argument("username")
    r.add_argument("--password-stdin", action="store_true")
    sub.add_parser("list", help="list accounts")
    args = p.parse_args(argv)

    url = get_settings().database_url
    db.init_engine(url)
    migrate.upgrade(url)
    with db.session() as s:
        if args.cmd == "list":
            for u in s.scalars(select(User).order_by(User.username)):
                print(f"{u.username:20} {u.role:12} {'active' if u.active else 'disabled':9} {u.display_name}")
            return
        u = s.scalar(select(User).where(User.username == args.username))
        if args.cmd == "add":
            if u is not None:
                sys.exit(f"{args.username} already exists.")
            u = User(username=args.username, display_name=args.display_name, role=args.role,
                     password_hash=hash_password(_password(args, args.username)), must_change_password=True)
            s.add(u)
        else:
            if u is None:
                sys.exit(f"{args.username} does not exist.")
            u.password_hash = hash_password(_password(args, u.username))
            u.must_change_password, u.locked_until, u.failed_logins, u.active = True, None, 0, True
        s.commit()
        print(f"{args.cmd}: {u.username} ({u.role}). The password must be changed at the first sign-in.")


if __name__ == "__main__":
    main()
