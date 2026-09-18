from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from ledger.db.session import get_db_session
from ledger.domains.auth.schemas import (
    CurrentUserResponse,
    LoginRequest,
    RefreshRequest,
    SignupRequest,
    TokenResponse,
)
from ledger.domains.auth.security import decode_token
from ledger.domains.auth.service import (
    authenticate_user,
    refresh_access_token,
    signup_user,
)
from ledger.domains.users.service import get_user_by_id

router = APIRouter(prefix="/auth", tags=["authentication"])

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
)


@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: LoginRequest,
    session: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    return await authenticate_user(session, credentials)


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def signup(
    credentials: SignupRequest,
    session: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    return await signup_user(session, credentials)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: RefreshRequest,
    session: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    return await refresh_access_token(
        session,
        request.refresh_token,
    )


@router.get("/me", response_model=CurrentUserResponse)
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_db_session),
):
    try:
        payload = decode_token(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
        ) from exc

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
        )

    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
        )

    user = await get_user_by_id(session, user_id)

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is unavailable",
        )

    return user