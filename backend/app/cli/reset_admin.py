"""
Server CLI Break-Glass Administrator Recovery Tool.
Allows resetting workspace administrator credentials directly on the host or container terminal,
bypassing all web, proxy, and email dependencies.

Usage:
    python -m app.cli.reset_admin --email admin@firm.com --password "NewPassword123!"
"""
import argparse
import asyncio
import getpass
import secrets
import sys
from datetime import datetime, timezone

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.core.security import hash_password, validate_password_strength
from models import User


async def reset_admin_password(email: str, new_password: str):
    clean_email = email.strip().lower()
    validate_password_strength(new_password)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == clean_email))
        user = result.scalar_one_or_none()

        if not user:
            print(f"Error: No user account found with email '{clean_email}'.", file=sys.stderr)
            sys.exit(1)

        if not user.is_admin:
            print(f"Warning: User '{clean_email}' is not marked as an administrator. Granting admin privileges.")
            user.is_admin = True

        new_recovery_key = f"rec_{secrets.token_urlsafe(24)}"

        user.password_hash = hash_password(new_password)
        user.recovery_key_hash = hash_password(new_recovery_key)
        user.reset_token = None
        user.reset_token_expires_at = None

        await db.commit()

        print("\n=======================================================")
        print("  ADMINISTRATOR CREDENTIALS SUCCESSFULLY UPDATED")
        print("=======================================================")
        print(f"User:               {user.name} ({user.email})")
        print(f"Role:               {user.role.value}")
        print(f"Is Admin:           {user.is_admin}")
        print(f"New Recovery Key:   {new_recovery_key}")
        print("-------------------------------------------------------")
        print("Note: Store the Master Recovery Key securely. It can be")
        print("used to recover this admin account if email access fails.")
        print("=======================================================\n")


def main():
    parser = argparse.ArgumentParser(description="Break-glass admin password reset tool")
    parser.add_argument("--email", "-e", required=False, help="Administrator email address")
    parser.add_argument("--password", "-p", required=False, help="New password (will prompt if omitted)")

    args = parser.parse_args()

    email = args.email
    if not email:
        email = input("Administrator email: ").strip()

    password = args.password
    if not password:
        password = getpass.getpass("New password: ")
        confirm = getpass.getpass("Confirm new password: ")
        if password != confirm:
            print("Error: Passwords do not match.", file=sys.stderr)
            sys.exit(1)

    asyncio.run(reset_admin_password(email, password))


if __name__ == "__main__":
    main()
