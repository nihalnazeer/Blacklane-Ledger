import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from ledger.domains.auth.dependencies import get_current_user
from ledger.domains.businesses.models import Business, BusinessType
from ledger.domains.users.models import User
from ledger.main import app


client = TestClient(app)


def create_test_user(*, role: str = "user") -> User:
    return User(
        id=uuid.uuid4(),
        email=f"{uuid.uuid4()}@example.com",
        password_hash="test-password-hash",
        role=role,
        is_active=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


def create_test_business(
    *,
    name: str = "Test Business",
    business_type: str = BusinessType.RESTAURANT.value,
) -> Business:
    return Business(
        id=uuid.uuid4(),
        name=name,
        business_type=business_type,
        is_active=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


def test_create_business_requires_authentication() -> None:
    response = client.post(
        "/api/v1/businesses",
        json={
            "name": "Test Business",
            "business_type": "restaurant",
        },
    )

    assert response.status_code == 401


def test_create_business() -> None:
    user = create_test_user()
    business = create_test_business()

    create_business = AsyncMock(return_value=business)

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.businesses import router as businesses_router

        original_create_business = businesses_router.create_business
        businesses_router.create_business = create_business

        response = client.post(
            "/api/v1/businesses",
            json={
                "name": "Test Business",
                "business_type": "restaurant",
            },
        )

        assert response.status_code == 201

        data = response.json()

        assert data["id"] == str(business.id)
        assert data["name"] == "Test Business"
        assert data["business_type"] == "restaurant"
        assert data["is_active"] is True

        create_business.assert_awaited_once()

        _, kwargs = create_business.await_args

        assert kwargs["name"] == "Test Business"
        assert kwargs["owner_id"] == user.id
        assert kwargs["business_type"] == BusinessType.RESTAURANT

    finally:
        businesses_router.create_business = original_create_business
        app.dependency_overrides.clear()


def test_create_business_requires_business_type() -> None:
    user = create_test_user()

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        response = client.post(
            "/api/v1/businesses",
            json={
                "name": "Test Business",
            },
        )

        assert response.status_code == 422

    finally:
        app.dependency_overrides.clear()


def test_create_business_rejects_invalid_business_type() -> None:
    user = create_test_user()

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        response = client.post(
            "/api/v1/businesses",
            json={
                "name": "Test Business",
                "business_type": "shop",
            },
        )

        assert response.status_code == 422

    finally:
        app.dependency_overrides.clear()


def test_list_my_businesses() -> None:
    user = create_test_user()

    businesses = [
        create_test_business(
            name="Business One",
        ),
        create_test_business(
            name="Business Two",
        ),
    ]

    get_user_businesses = AsyncMock(return_value=businesses)

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.businesses import router as businesses_router

        original_get_user_businesses = businesses_router.get_user_businesses
        businesses_router.get_user_businesses = get_user_businesses

        response = client.get("/api/v1/businesses/mine")

        assert response.status_code == 200

        data = response.json()

        assert len(data) == 2

        assert data[0]["name"] == "Business One"
        assert data[0]["business_type"] == "restaurant"

        assert data[1]["name"] == "Business Two"
        assert data[1]["business_type"] == "restaurant"

        get_user_businesses.assert_awaited_once()

        args, _ = get_user_businesses.await_args

        assert args[1] == user.id

    finally:
        businesses_router.get_user_businesses = original_get_user_businesses
        app.dependency_overrides.clear()


def test_list_my_businesses_requires_authentication() -> None:
    response = client.get("/api/v1/businesses/mine")

    assert response.status_code == 401