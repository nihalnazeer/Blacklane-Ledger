from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ledger.domains.auth.schemas import LoginRequest, TokenResponse
from ledger.domains.auth.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from ledger.domains.users.service import get_user_by_email, get_user_by_id


async def authenticate_user(
    session: AsyncSession,
    credentials: LoginRequest,
) -> TokenResponse:
    user = await get_user_by_email(
        session,
        credentials.email,
    )

    if user is None or not verify_password(
        credentials.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    user_id = str(user.id)

    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


async def refresh_access_token(
    session: AsyncSession,
    refresh_token: str,
) -> TokenResponse:
    try:
        payload = decode_token(refresh_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        ) from exc

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user = await get_user_by_id(session, user_id)

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is unavailable",
        )

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )