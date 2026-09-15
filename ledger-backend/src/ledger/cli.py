import asyncio
import getpass

from ledger.db.session import AsyncSessionLocal
from ledger.domains.users.models import UserRole
from ledger.domains.users.schemas import UserCreate
from ledger.domains.users.service import create_user, get_user_by_email


async def create_admin() -> None:
    email = input("Admin email: ").strip().lower()
    password = getpass.getpass("Admin password: ")
    confirm_password = getpass.getpass("Confirm password: ")

    if password != confirm_password:
        print("Passwords do not match.")
        return

    if not email:
        print("Email is required.")
        return

    if not password:
        print("Password is required.")
        return

    async with AsyncSessionLocal() as session:
        existing_user = await get_user_by_email(
            session,
            email,
        )

        if existing_user is not None:
            print(f"A user with email '{email}' already exists.")
            return

        user = await create_user(
            session,
            UserCreate(
                email=email,
                password=password,
                role=UserRole.ADMIN,
            ),
        )

        print(f"Admin user created successfully: {user.email}")


def main() -> None:
    asyncio.run(create_admin())


if __name__ == "__main__":
    main()