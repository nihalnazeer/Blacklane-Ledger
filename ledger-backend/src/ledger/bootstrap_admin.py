import asyncio
import os

from ledger.db.session import AsyncSessionLocal
from ledger.domains.auth.security import hash_password
from ledger.domains.users.models import UserRole
from ledger.domains.users.schemas import UserCreate
from ledger.domains.users.service import create_user, get_user_by_email


async def bootstrap_admin() -> None:
    email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    password = os.getenv("ADMIN_PASSWORD", "")

    if not email or not password:
        print("ADMIN_EMAIL or ADMIN_PASSWORD is not configured.")
        return

    async with AsyncSessionLocal() as session:
        existing_user = await get_user_by_email(session, email)

        if existing_user is not None:
            print(f"Admin user already exists: {email}")
            return

        await create_user(
            session,
            UserCreate(
                email=email,
                password=password,
                role=UserRole.ADMIN,
            ),
        )

        print(f"Admin user created successfully: {email}")


def main() -> None:
    asyncio.run(bootstrap_admin())


if __name__ == "__main__":
    main()