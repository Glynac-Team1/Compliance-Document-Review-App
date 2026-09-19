"""
Admin seeding script for creating officer accounts.
Officer accounts cannot be created through the public /auth/signup endpoint.
Run this script directly on a machine with database access to provision one.

Usage:
    python create_officer.py <email> <password> <name>
"""
import asyncio
import sys

sys.path.insert(0, ".")

from sqlalchemy import select

from app.core.security import hash_password
from app.database import AsyncSessionLocal
from models import Role, User


async def create_officer(email: str, password: str, name: str):
    async with AsyncSessionLocal() as db:
        existing = await db.scalar(select(User).where(User.email == email))
        if existing:
            print(f"A user with email {email} already exists (role: {existing.role.value}).")
            return

        new_officer = User(
            email=email,
            password_hash=hash_password(password),
            role=Role.officer,
            name=name,
        )
        db.add(new_officer)
        await db.commit()
        print(f"Officer account created: {email}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python create_officer.py <email> <password> <name>")
        sys.exit(1)

    email, password, name = sys.argv[1], sys.argv[2], sys.argv[3]
    asyncio.run(create_officer(email, password, name))