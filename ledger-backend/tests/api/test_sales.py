import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from unittest.mock import ANY, AsyncMock

from fastapi.testclient import TestClient

from ledger.domains.auth.dependencies import get_current_user
from ledger.domains.businesses.models import Business, BusinessType
from ledger.domains.sales.models import Sale
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
    business_type: str = BusinessType.RESTAURANT.value,
) -> Business:
    return Business(
        id=uuid.uuid4(),
        name="Test Restaurant",
        business_type=business_type,
        is_active=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


def create_test_sale(
    *,
    business_id: uuid.UUID,
    sale_date: date = date(2026, 9, 13),
    cash_income: Decimal = Decimal("1500.00"),
    bank_balance: Decimal = Decimal("5000.00"),
) -> Sale:
    return Sale(
        id=uuid.uuid4(),
        business_id=business_id,
        sale_date=sale_date,
        cash_income=cash_income,
        bank_balance=bank_balance,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


def test_list_sales_requires_authentication() -> None:
    business_id = uuid.uuid4()

    response = client.get(
        f"/api/v1/businesses/{business_id}/sales",
    )

    assert response.status_code == 401


def test_create_sale_requires_authentication() -> None:
    business_id = uuid.uuid4()

    response = client.post(
        f"/api/v1/businesses/{business_id}/sales",
        json={
            "sale_date": "2026-09-13",
            "cash_income": "1500.00",
            "bank_balance": "5000.00",
        },
    )

    assert response.status_code == 401


def test_restaurant_member_can_list_sales() -> None:
    user = create_test_user()
    business = create_test_business()

    sales = [
        create_test_sale(
            business_id=business.id,
            sale_date=date(2026, 9, 13),
        ),
        create_test_sale(
            business_id=business.id,
            sale_date=date(2026, 9, 12),
            cash_income=Decimal("1200.00"),
            bank_balance=Decimal("4800.00"),
        ),
    ]

    get_restaurant_business_for_user = AsyncMock(return_value=business)
    list_sales = AsyncMock(return_value=sales)

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.sales import router as sales_router

        original_access_check = sales_router.get_restaurant_business_for_user
        original_list_sales = sales_router.list_sales

        sales_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )
        sales_router.list_sales = list_sales

        response = client.get(
            f"/api/v1/businesses/{business.id}/sales",
        )

        assert response.status_code == 200

        data = response.json()

        assert len(data) == 2

        assert data[0]["id"] == str(sales[0].id)
        assert data[0]["business_id"] == str(business.id)
        assert data[0]["sale_date"] == "2026-09-13"
        assert data[0]["cash_income"] == "1500.00"
        assert data[0]["bank_balance"] == "5000.00"

        assert data[1]["sale_date"] == "2026-09-12"
        assert data[1]["cash_income"] == "1200.00"
        assert data[1]["bank_balance"] == "4800.00"

        get_restaurant_business_for_user.assert_awaited_once_with(
            ANY,
            user.id,
            business.id,
        )

        list_sales.assert_awaited_once_with(
            ANY,
            business.id,
        )

    finally:
        sales_router.get_restaurant_business_for_user = original_access_check
        sales_router.list_sales = original_list_sales
        app.dependency_overrides.clear()


def test_non_member_cannot_access_restaurant_sales() -> None:
    user = create_test_user()
    business = create_test_business()

    get_restaurant_business_for_user = AsyncMock(return_value=None)

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.sales import router as sales_router

        original_access_check = sales_router.get_restaurant_business_for_user

        sales_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )

        response = client.get(
            f"/api/v1/businesses/{business.id}/sales",
        )

        assert response.status_code == 404

        assert response.json() == {
            "detail": "Restaurant business not found",
        }

    finally:
        sales_router.get_restaurant_business_for_user = original_access_check
        app.dependency_overrides.clear()


def test_non_restaurant_business_cannot_access_restaurant_sales() -> None:
    user = create_test_user()

    business = create_test_business(
        business_type="shop",
    )

    get_restaurant_business_for_user = AsyncMock(return_value=None)

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.sales import router as sales_router

        original_access_check = sales_router.get_restaurant_business_for_user

        sales_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )

        response = client.get(
            f"/api/v1/businesses/{business.id}/sales",
        )

        assert response.status_code == 404

        assert response.json() == {
            "detail": "Restaurant business not found",
        }

    finally:
        sales_router.get_restaurant_business_for_user = original_access_check
        app.dependency_overrides.clear()


def test_create_sale() -> None:
    user = create_test_user()
    business = create_test_business()

    sale = create_test_sale(
        business_id=business.id,
    )

    get_restaurant_business_for_user = AsyncMock(return_value=business)
    get_sale_by_date = AsyncMock(return_value=None)
    create_sale = AsyncMock(return_value=sale)

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.sales import router as sales_router

        original_access_check = sales_router.get_restaurant_business_for_user
        original_get_sale_by_date = sales_router.get_sale_by_date
        original_create_sale = sales_router.create_sale

        sales_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )
        sales_router.get_sale_by_date = get_sale_by_date
        sales_router.create_sale = create_sale

        response = client.post(
            f"/api/v1/businesses/{business.id}/sales",
            json={
                "sale_date": "2026-09-13",
                "cash_income": "1500.00",
                "bank_balance": "5000.00",
            },
        )

        assert response.status_code == 201

        data = response.json()

        assert data["id"] == str(sale.id)
        assert data["business_id"] == str(business.id)
        assert data["sale_date"] == "2026-09-13"
        assert data["cash_income"] == "1500.00"
        assert data["bank_balance"] == "5000.00"

        get_sale_by_date.assert_awaited_once_with(
            ANY,
            business.id,
            date(2026, 9, 13),
        )

        create_sale.assert_awaited_once()

        args, _ = create_sale.await_args

        assert args[0] is not None
        assert args[1] == business.id
        assert args[2].sale_date == date(2026, 9, 13)
        assert args[2].cash_income == Decimal("1500.00")
        assert args[2].bank_balance == Decimal("5000.00")

    finally:
        sales_router.get_restaurant_business_for_user = original_access_check
        sales_router.get_sale_by_date = original_get_sale_by_date
        sales_router.create_sale = original_create_sale
        app.dependency_overrides.clear()


def test_create_sale_rejects_duplicate_date() -> None:
    user = create_test_user()
    business = create_test_business()

    existing_sale = create_test_sale(
        business_id=business.id,
    )

    get_restaurant_business_for_user = AsyncMock(return_value=business)
    get_sale_by_date = AsyncMock(return_value=existing_sale)
    create_sale = AsyncMock()

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.sales import router as sales_router

        original_access_check = sales_router.get_restaurant_business_for_user
        original_get_sale_by_date = sales_router.get_sale_by_date
        original_create_sale = sales_router.create_sale

        sales_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )
        sales_router.get_sale_by_date = get_sale_by_date
        sales_router.create_sale = create_sale

        response = client.post(
            f"/api/v1/businesses/{business.id}/sales",
            json={
                "sale_date": "2026-09-13",
                "cash_income": "2000.00",
                "bank_balance": "6000.00",
            },
        )

        assert response.status_code == 409

        assert response.json() == {
            "detail": "A sale already exists for this date",
        }

        create_sale.assert_not_awaited()

    finally:
        sales_router.get_restaurant_business_for_user = original_access_check
        sales_router.get_sale_by_date = original_get_sale_by_date
        sales_router.create_sale = original_create_sale
        app.dependency_overrides.clear()


def test_get_sale() -> None:
    user = create_test_user()
    business = create_test_business()

    sale = create_test_sale(
        business_id=business.id,
    )

    get_restaurant_business_for_user = AsyncMock(return_value=business)
    get_sale = AsyncMock(return_value=sale)

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.sales import router as sales_router

        original_access_check = sales_router.get_restaurant_business_for_user
        original_get_sale = sales_router.get_sale

        sales_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )
        sales_router.get_sale = get_sale

        response = client.get(
            f"/api/v1/businesses/{business.id}/sales/{sale.id}",
        )

        assert response.status_code == 200

        data = response.json()

        assert data["id"] == str(sale.id)
        assert data["business_id"] == str(business.id)
        assert data["sale_date"] == "2026-09-13"
        assert data["cash_income"] == "1500.00"
        assert data["bank_balance"] == "5000.00"

        get_sale.assert_awaited_once_with(
            ANY,
            business.id,
            sale.id,
        )

    finally:
        sales_router.get_restaurant_business_for_user = original_access_check
        sales_router.get_sale = original_get_sale
        app.dependency_overrides.clear()


def test_get_sale_not_found() -> None:
    user = create_test_user()
    business = create_test_business()
    sale_id = uuid.uuid4()

    get_restaurant_business_for_user = AsyncMock(return_value=business)
    get_sale = AsyncMock(return_value=None)

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.sales import router as sales_router

        original_access_check = sales_router.get_restaurant_business_for_user
        original_get_sale = sales_router.get_sale

        sales_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )
        sales_router.get_sale = get_sale

        response = client.get(
            f"/api/v1/businesses/{business.id}/sales/{sale_id}",
        )

        assert response.status_code == 404

        assert response.json() == {
            "detail": "Sale not found",
        }

    finally:
        sales_router.get_restaurant_business_for_user = original_access_check
        sales_router.get_sale = original_get_sale
        app.dependency_overrides.clear()


def test_update_sale() -> None:
    user = create_test_user()
    business = create_test_business()

    sale = create_test_sale(
        business_id=business.id,
    )

    updated_sale = create_test_sale(
        business_id=business.id,
        cash_income=Decimal("1800.00"),
        bank_balance=Decimal("5200.00"),
    )

    get_restaurant_business_for_user = AsyncMock(return_value=business)
    get_sale = AsyncMock(return_value=sale)
    update_sale = AsyncMock(return_value=updated_sale)

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.sales import router as sales_router

        original_access_check = sales_router.get_restaurant_business_for_user
        original_get_sale = sales_router.get_sale
        original_update_sale = sales_router.update_sale

        sales_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )
        sales_router.get_sale = get_sale
        sales_router.update_sale = update_sale

        response = client.patch(
            f"/api/v1/businesses/{business.id}/sales/{sale.id}",
            json={
                "cash_income": "1800.00",
                "bank_balance": "5200.00",
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["id"] == str(updated_sale.id)
        assert data["cash_income"] == "1800.00"
        assert data["bank_balance"] == "5200.00"

        update_sale.assert_awaited_once()

        args, _ = update_sale.await_args

        assert args[0] is not None
        assert args[1] == sale
        assert args[2].cash_income == Decimal("1800.00")
        assert args[2].bank_balance == Decimal("5200.00")

    finally:
        sales_router.get_restaurant_business_for_user = original_access_check
        sales_router.get_sale = original_get_sale
        sales_router.update_sale = original_update_sale
        app.dependency_overrides.clear()


def test_update_sale_rejects_duplicate_date() -> None:
    user = create_test_user()
    business = create_test_business()

    sale = create_test_sale(
        business_id=business.id,
        sale_date=date(2026, 9, 13),
    )

    conflicting_sale = create_test_sale(
        business_id=business.id,
        sale_date=date(2026, 9, 14),
    )

    get_restaurant_business_for_user = AsyncMock(return_value=business)
    get_sale = AsyncMock(return_value=sale)
    get_sale_by_date = AsyncMock(return_value=conflicting_sale)
    update_sale = AsyncMock()

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.sales import router as sales_router

        original_access_check = sales_router.get_restaurant_business_for_user
        original_get_sale = sales_router.get_sale
        original_get_sale_by_date = sales_router.get_sale_by_date
        original_update_sale = sales_router.update_sale

        sales_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )
        sales_router.get_sale = get_sale
        sales_router.get_sale_by_date = get_sale_by_date
        sales_router.update_sale = update_sale

        response = client.patch(
            f"/api/v1/businesses/{business.id}/sales/{sale.id}",
            json={
                "sale_date": "2026-09-14",
            },
        )

        assert response.status_code == 409

        assert response.json() == {
            "detail": "A sale already exists for this date",
        }

        update_sale.assert_not_awaited()

    finally:
        sales_router.get_restaurant_business_for_user = original_access_check
        sales_router.get_sale = original_get_sale
        sales_router.get_sale_by_date = original_get_sale_by_date
        sales_router.update_sale = original_update_sale
        app.dependency_overrides.clear()


def test_delete_sale() -> None:
    user = create_test_user()
    business = create_test_business()

    sale = create_test_sale(
        business_id=business.id,
    )

    get_restaurant_business_for_user = AsyncMock(return_value=business)
    get_sale = AsyncMock(return_value=sale)
    delete_sale = AsyncMock()

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.sales import router as sales_router

        original_access_check = sales_router.get_restaurant_business_for_user
        original_get_sale = sales_router.get_sale
        original_delete_sale = sales_router.delete_sale

        sales_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )
        sales_router.get_sale = get_sale
        sales_router.delete_sale = delete_sale

        response = client.delete(
            f"/api/v1/businesses/{business.id}/sales/{sale.id}",
        )

        assert response.status_code == 204
        assert response.content == b""

        get_sale.assert_awaited_once_with(
            ANY,
            business.id,
            sale.id,
        )

        delete_sale.assert_awaited_once_with(
            ANY,
            sale,
        )

    finally:
        sales_router.get_restaurant_business_for_user = original_access_check
        sales_router.get_sale = original_get_sale
        sales_router.delete_sale = original_delete_sale
        app.dependency_overrides.clear()


def test_delete_sale_not_found() -> None:
    user = create_test_user()
    business = create_test_business()
    sale_id = uuid.uuid4()

    get_restaurant_business_for_user = AsyncMock(return_value=business)
    get_sale = AsyncMock(return_value=None)
    delete_sale = AsyncMock()

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.sales import router as sales_router

        original_access_check = sales_router.get_restaurant_business_for_user
        original_get_sale = sales_router.get_sale

        sales_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )
        sales_router.get_sale = get_sale

        response = client.delete(
            f"/api/v1/businesses/{business.id}/sales/{sale_id}",
        )

        assert response.status_code == 404

        assert response.json() == {
            "detail": "Sale not found",
        }

        delete_sale.assert_not_awaited()

    finally:
        sales_router.get_restaurant_business_for_user = original_access_check
        sales_router.get_sale = original_get_sale
        app.dependency_overrides.clear()