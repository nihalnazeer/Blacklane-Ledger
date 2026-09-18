from pydantic import BaseModel

from ledger.domains.businesses.models import BusinessType
from ledger.domains.users.schemas import UserResponse


class LoginRequest(BaseModel):

    email: str

    password: str


class SignupRequest(BaseModel):

    email: str

    password: str

    business_name: str

    business_type: BusinessType


class TokenResponse(BaseModel):

    access_token: str

    refresh_token: str

    token_type: str = "bearer"


class RefreshRequest(BaseModel):

    refresh_token: str


class CurrentUserResponse(UserResponse):

    pass