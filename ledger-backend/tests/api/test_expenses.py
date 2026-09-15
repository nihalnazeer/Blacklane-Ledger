import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from unittest.mock import ANY, AsyncMock

from fastapi.testclient import TestClient

from ledger.domains.auth.dependencies import get_current_user
from ledger.domains.businesses.models import Business, BusinessType
from ledger.domains.expenses.models import Expense
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


def create_test_expense(
    *,
    business_id: uuid.UUID,
    expense_date: date = date(2026, 9, 13),
    amount: Decimal = Decimal("250.00"),
    description: str = "Vegetables",
    note: str | None = "Market purchase",
) -> Expense:
    return Expense(
        id=uuid.uuid4(),
        business_id=business_id,
        expense_date=expense_date,
        amount=amount,
        description=description,
        note=note,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


def test_list_expenses_requires_authentication() -> None:
    business_id = uuid.uuid4()

    response = client.get(
        f"/api/v1/businesses/{business_id}/expenses",
    )

    assert response.status_code == 401


def test_create_expense_requires_authentication() -> None:
    business_id = uuid.uuid4()

    response = client.post(
        f"/api/v1/businesses/{business_id}/expenses",
        json={
            "expense_date": "2026-09-13",
            "amount": "250.00",
            "description": "Vegetables",
            "note": "Market purchase",
        },
    )

    assert response.status_code == 401


def test_restaurant_member_can_list_expenses() -> None:
    user = create_test_user()
    business = create_test_business()

    expenses = [
        create_test_expense(
            business_id=business.id,
            expense_date=date(2026, 9, 13),
            amount=Decimal("250.00"),
            description="Vegetables",
            note="Market purchase",
        ),
        create_test_expense(
            business_id=business.id,
            expense_date=date(2026, 9, 13),
            amount=Decimal("120.00"),
            description="Cleaning supplies",
            note=None,
        ),
        create_test_expense(
            business_id=business.id,
            expense_date=date(2026, 9, 12),
            amount=Decimal("500.00"),
            description="Utilities",
            note="Electricity",
        ),
    ]

    get_restaurant_business_for_user = AsyncMock(return_value=business)
    list_expenses = AsyncMock(return_value=expenses)

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.expenses import router as expenses_router

        original_access_check = expenses_router.get_restaurant_business_for_user
        original_list_expenses = expenses_router.list_expenses

        expenses_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )
        expenses_router.list_expenses = list_expenses

        response = client.get(
            f"/api/v1/businesses/{business.id}/expenses",
        )

        assert response.status_code == 200

        data = response.json()

        assert len(data) == 3

        assert data[0]["id"] == str(expenses[0].id)
        assert data[0]["business_id"] == str(business.id)
        assert data[0]["expense_date"] == "2026-09-13"
        assert data[0]["amount"] == "250.00"
        assert data[0]["description"] == "Vegetables"
        assert data[0]["note"] == "Market purchase"

        assert data[1]["expense_date"] == "2026-09-13"
        assert data[1]["amount"] == "120.00"
        assert data[1]["description"] == "Cleaning supplies"
        assert data[1]["note"] is None

        assert data[2]["expense_date"] == "2026-09-12"
        assert data[2]["amount"] == "500.00"
        assert data[2]["description"] == "Utilities"

        get_restaurant_business_for_user.assert_awaited_once_with(
            ANY,
            user.id,
            business.id,
        )

        list_expenses.assert_awaited_once_with(
            ANY,
            business.id,
            None,
        )

    finally:
        expenses_router.get_restaurant_business_for_user = original_access_check
        expenses_router.list_expenses = original_list_expenses
        app.dependency_overrides.clear()


def test_list_expenses_can_filter_by_date() -> None:
    user = create_test_user()
    business = create_test_business()

    expenses = [
        create_test_expense(
            business_id=business.id,
            expense_date=date(2026, 9, 13),
            amount=Decimal("250.00"),
            description="Vegetables",
        ),
        create_test_expense(
            business_id=business.id,
            expense_date=date(2026, 9, 13),
            amount=Decimal("120.00"),
            description="Cleaning supplies",
        ),
    ]

    get_restaurant_business_for_user = AsyncMock(return_value=business)
    list_expenses = AsyncMock(return_value=expenses)

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.expenses import router as expenses_router

        original_access_check = expenses_router.get_restaurant_business_for_user
        original_list_expenses = expenses_router.list_expenses

        expenses_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )
        expenses_router.list_expenses = list_expenses

        response = client.get(
            f"/api/v1/businesses/{business.id}/expenses",
            params={"expense_date": "2026-09-13"},
        )

        assert response.status_code == 200

        data = response.json()

        assert len(data) == 2
        assert data[0]["expense_date"] == "2026-09-13"
        assert data[1]["expense_date"] == "2026-09-13"

        list_expenses.assert_awaited_once_with(
            ANY,
            business.id,
            date(2026, 9, 13),
        )

    finally:
        expenses_router.get_restaurant_business_for_user = original_access_check
        expenses_router.list_expenses = original_list_expenses
        app.dependency_overrides.clear()


def test_non_member_cannot_access_restaurant_expenses() -> None:
    user = create_test_user()
    business = create_test_business()

    get_restaurant_business_for_user = AsyncMock(return_value=None)

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.expenses import router as expenses_router

        original_access_check = expenses_router.get_restaurant_business_for_user

        expenses_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )

        response = client.get(
            f"/api/v1/businesses/{business.id}/expenses",
        )

        assert response.status_code == 404

        assert response.json() == {
            "detail": "Restaurant business not found",
        }

    finally:
        expenses_router.get_restaurant_business_for_user = original_access_check
        app.dependency_overrides.clear()


def test_non_restaurant_business_cannot_access_restaurant_expenses() -> None:
    user = create_test_user()

    business = create_test_business(
        business_type="shop",
    )

    get_restaurant_business_for_user = AsyncMock(return_value=None)

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.expenses import router as expenses_router

        original_access_check = expenses_router.get_restaurant_business_for_user

        expenses_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )

        response = client.get(
            f"/api/v1/businesses/{business.id}/expenses",
        )

        assert response.status_code == 404

        assert response.json() == {
            "detail": "Restaurant business not found",
        }

    finally:
        expenses_router.get_restaurant_business_for_user = original_access_check
        app.dependency_overrides.clear()


def test_create_expense() -> None:
    user = create_test_user()
    business = create_test_business()

    expense = create_test_expense(
        business_id=business.id,
        expense_date=date(2026, 9, 13),
        amount=Decimal("250.00"),
        description="Vegetables",
        note="Market purchase",
    )

    get_restaurant_business_for_user = AsyncMock(return_value=business)
    create_expense = AsyncMock(return_value=expense)

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.expenses import router as expenses_router

        original_access_check = expenses_router.get_restaurant_business_for_user
        original_create_expense = expenses_router.create_expense

        expenses_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )
        expenses_router.create_expense = create_expense

        response = client.post(
            f"/api/v1/businesses/{business.id}/expenses",
            json={
                "expense_date": "2026-09-13",
                "amount": "250.00",
                "description": "Vegetables",
                "note": "Market purchase",
            },
        )

        assert response.status_code == 201

        data = response.json()

        assert data["id"] == str(expense.id)
        assert data["business_id"] == str(business.id)
        assert data["expense_date"] == "2026-09-13"
        assert data["amount"] == "250.00"
        assert data["description"] == "Vegetables"
        assert data["note"] == "Market purchase"

        create_expense.assert_awaited_once()

        args, _ = create_expense.await_args

        assert args[0] is not None
        assert args[1] == business.id
        assert args[2].expense_date == date(2026, 9, 13)
        assert args[2].amount == Decimal("250.00")
        assert args[2].description == "Vegetables"
        assert args[2].note == "Market purchase"

    finally:
        expenses_router.get_restaurant_business_for_user = original_access_check
        expenses_router.create_expense = original_create_expense
        app.dependency_overrides.clear()


def test_multiple_expenses_can_have_same_date() -> None:
    user = create_test_user()
    business = create_test_business()

    first_expense = create_test_expense(
        business_id=business.id,
        expense_date=date(2026, 9, 13),
        amount=Decimal("250.00"),
        description="Vegetables",
    )

    second_expense = create_test_expense(
        business_id=business.id,
        expense_date=date(2026, 9, 13),
        amount=Decimal("120.00"),
        description="Cleaning supplies",
    )

    get_restaurant_business_for_user = AsyncMock(return_value=business)
    create_expense = AsyncMock(
        side_effect=[first_expense, second_expense],
    )

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.expenses import router as expenses_router

        original_access_check = expenses_router.get_restaurant_business_for_user
        original_create_expense = expenses_router.create_expense

        expenses_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )
        expenses_router.create_expense = create_expense

        first_response = client.post(
            f"/api/v1/businesses/{business.id}/expenses",
            json={
                "expense_date": "2026-09-13",
                "amount": "250.00",
                "description": "Vegetables",
            },
        )

        second_response = client.post(
            f"/api/v1/businesses/{business.id}/expenses",
            json={
                "expense_date": "2026-09-13",
                "amount": "120.00",
                "description": "Cleaning supplies",
            },
        )

        assert first_response.status_code == 201
        assert second_response.status_code == 201

        assert first_response.json()["expense_date"] == "2026-09-13"
        assert second_response.json()["expense_date"] == "2026-09-13"

        assert create_expense.await_count == 2

    finally:
        expenses_router.get_restaurant_business_for_user = original_access_check
        expenses_router.create_expense = original_create_expense
        app.dependency_overrides.clear()


def test_get_expense() -> None:
    user = create_test_user()
    business = create_test_business()

    expense = create_test_expense(
        business_id=business.id,
    )

    get_restaurant_business_for_user = AsyncMock(return_value=business)
    get_expense = AsyncMock(return_value=expense)

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.expenses import router as expenses_router

        original_access_check = expenses_router.get_restaurant_business_for_user
        original_get_expense = expenses_router.get_expense

        expenses_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )
        expenses_router.get_expense = get_expense

        response = client.get(
            f"/api/v1/businesses/{business.id}/expenses/{expense.id}",
        )

        assert response.status_code == 200

        data = response.json()

        assert data["id"] == str(expense.id)
        assert data["business_id"] == str(business.id)
        assert data["expense_date"] == "2026-09-13"
        assert data["amount"] == "250.00"
        assert data["description"] == "Vegetables"
        assert data["note"] == "Market purchase"

        get_expense.assert_awaited_once_with(
            ANY,
            business.id,
            expense.id,
        )

    finally:
        expenses_router.get_restaurant_business_for_user = original_access_check
        expenses_router.get_expense = original_get_expense
        app.dependency_overrides.clear()


def test_get_expense_not_found() -> None:
    user = create_test_user()
    business = create_test_business()
    expense_id = uuid.uuid4()

    get_restaurant_business_for_user = AsyncMock(return_value=business)
    get_expense = AsyncMock(return_value=None)

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.expenses import router as expenses_router

        original_access_check = expenses_router.get_restaurant_business_for_user
        original_get_expense = expenses_router.get_expense

        expenses_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )
        expenses_router.get_expense = get_expense

        response = client.get(
            f"/api/v1/businesses/{business.id}/expenses/{expense_id}",
        )

        assert response.status_code == 404

        assert response.json() == {
            "detail": "Expense not found",
        }

    finally:
        expenses_router.get_restaurant_business_for_user = original_access_check
        expenses_router.get_expense = original_get_expense
        app.dependency_overrides.clear()


def test_update_expense() -> None:
    user = create_test_user()
    business = create_test_business()

    expense = create_test_expense(
        business_id=business.id,
    )

    updated_expense = create_test_expense(
        business_id=business.id,
        amount=Decimal("300.00"),
        description="Vegetables and fruit",
        note="Updated market purchase",
    )

    get_restaurant_business_for_user = AsyncMock(return_value=business)
    get_expense = AsyncMock(return_value=expense)
    update_expense = AsyncMock(return_value=updated_expense)

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.expenses import router as expenses_router

        original_access_check = expenses_router.get_restaurant_business_for_user
        original_get_expense = expenses_router.get_expense
        original_update_expense = expenses_router.update_expense

        expenses_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )
        expenses_router.get_expense = get_expense
        expenses_router.update_expense = update_expense

        response = client.patch(
            f"/api/v1/businesses/{business.id}/expenses/{expense.id}",
            json={
                "amount": "300.00",
                "description": "Vegetables and fruit",
                "note": "Updated market purchase",
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["id"] == str(updated_expense.id)
        assert data["amount"] == "300.00"
        assert data["description"] == "Vegetables and fruit"
        assert data["note"] == "Updated market purchase"

        update_expense.assert_awaited_once()

        args, _ = update_expense.await_args

        assert args[0] is not None
        assert args[1] == expense
        assert args[2].amount == Decimal("300.00")
        assert args[2].description == "Vegetables and fruit"
        assert args[2].note == "Updated market purchase"

    finally:
        expenses_router.get_restaurant_business_for_user = original_access_check
        expenses_router.get_expense = original_get_expense
        expenses_router.update_expense = original_update_expense
        app.dependency_overrides.clear()


def test_delete_expense() -> None:
    user = create_test_user()
    business = create_test_business()

    expense = create_test_expense(
        business_id=business.id,
    )

    get_restaurant_business_for_user = AsyncMock(return_value=business)
    get_expense = AsyncMock(return_value=expense)
    delete_expense = AsyncMock()

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.expenses import router as expenses_router

        original_access_check = expenses_router.get_restaurant_business_for_user
        original_get_expense = expenses_router.get_expense
        original_delete_expense = expenses_router.delete_expense

        expenses_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )
        expenses_router.get_expense = get_expense
        expenses_router.delete_expense = delete_expense

        response = client.delete(
            f"/api/v1/businesses/{business.id}/expenses/{expense.id}",
        )

        assert response.status_code == 204
        assert response.content == b""

        get_expense.assert_awaited_once_with(
            ANY,
            business.id,
            expense.id,
        )

        delete_expense.assert_awaited_once_with(
            ANY,
            expense,
        )

    finally:
        expenses_router.get_restaurant_business_for_user = original_access_check
        expenses_router.get_expense = original_get_expense
        expenses_router.delete_expense = original_delete_expense
        app.dependency_overrides.clear()


def test_delete_expense_not_found() -> None:
    user = create_test_user()
    business = create_test_business()
    expense_id = uuid.uuid4()

    get_restaurant_business_for_user = AsyncMock(return_value=business)
    get_expense = AsyncMock(return_value=None)
    delete_expense = AsyncMock()

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.expenses import router as expenses_router

        original_access_check = expenses_router.get_restaurant_business_for_user
        original_get_expense = expenses_router.get_expense

        expenses_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )
        expenses_router.get_expense = get_expense

        response = client.delete(
            f"/api/v1/businesses/{business.id}/expenses/{expense_id}",
        )

        assert response.status_code == 404

        assert response.json() == {
            "detail": "Expense not found",
        }

        delete_expense.assert_not_awaited()

    finally:
        expenses_router.get_restaurant_business_for_user = original_access_check
        expenses_router.get_expense = original_get_expense
        app.dependency_overrides.clear()


def test_get_daily_expense_total() -> None:
    user = create_test_user()
    business = create_test_business()

    get_restaurant_business_for_user = AsyncMock(return_value=business)
    get_daily_expense_total = AsyncMock(
        return_value=Decimal("370.00"),
    )

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.expenses import router as expenses_router

        original_access_check = expenses_router.get_restaurant_business_for_user
        original_get_daily_expense_total = (
            expenses_router.get_daily_expense_total
        )

        expenses_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )
        expenses_router.get_daily_expense_total = get_daily_expense_total

        response = client.get(
            f"/api/v1/businesses/{business.id}/expenses/daily-total",
            params={"expense_date": "2026-09-13"},
        )

        assert response.status_code == 200

        data = response.json()

        assert data["business_id"] == str(business.id)
        assert data["expense_date"] == "2026-09-13"
        assert data["total"] == "370.00"

        get_daily_expense_total.assert_awaited_once_with(
            ANY,
            business.id,
            date(2026, 9, 13),
        )

    finally:
        expenses_router.get_restaurant_business_for_user = original_access_check
        expenses_router.get_daily_expense_total = (
            original_get_daily_expense_total
        )
        app.dependency_overrides.clear()


def test_get_monthly_expense_total() -> None:
    user = create_test_user()
    business = create_test_business()

    get_restaurant_business_for_user = AsyncMock(return_value=business)
    get_monthly_expense_total = AsyncMock(
        return_value=Decimal("5200.00"),
    )

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.expenses import router as expenses_router

        original_access_check = expenses_router.get_restaurant_business_for_user
        original_get_monthly_expense_total = (
            expenses_router.get_monthly_expense_total
        )

        expenses_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )
        expenses_router.get_monthly_expense_total = (
            get_monthly_expense_total
        )

        response = client.get(
            f"/api/v1/businesses/{business.id}/expenses/monthly-total",
            params={
                "year": 2026,
                "month": 9,
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["business_id"] == str(business.id)
        assert data["year"] == 2026
        assert data["month"] == 9
        assert data["total"] == "5200.00"

        get_monthly_expense_total.assert_awaited_once_with(
            ANY,
            business.id,
            2026,
            9,
        )

    finally:
        expenses_router.get_restaurant_business_for_user = original_access_check
        expenses_router.get_monthly_expense_total = (
            original_get_monthly_expense_total
        )
        app.dependency_overrides.clear()


def test_get_monthly_expense_total_rejects_invalid_month() -> None:
    user = create_test_user()
    business = create_test_business()

    get_restaurant_business_for_user = AsyncMock(return_value=business)
    get_monthly_expense_total = AsyncMock()

    app.dependency_overrides[get_current_user] = lambda: user

    try:
        from ledger.domains.expenses import router as expenses_router

        original_access_check = expenses_router.get_restaurant_business_for_user
        original_get_monthly_expense_total = (
            expenses_router.get_monthly_expense_total
        )

        expenses_router.get_restaurant_business_for_user = (
            get_restaurant_business_for_user
        )
        expenses_router.get_monthly_expense_total = (
            get_monthly_expense_total
        )

        response = client.get(
            f"/api/v1/businesses/{business.id}/expenses/monthly-total",
            params={
                "year": 2026,
                "month": 13,
            },
        )

        assert response.status_code == 422

        assert response.json() == {
            "detail": "Month must be between 1 and 12",
        }

        get_restaurant_business_for_user.assert_not_awaited()
        get_monthly_expense_total.assert_not_awaited()

    finally:
        expenses_router.get_restaurant_business_for_user = original_access_check
        expenses_router.get_monthly_expense_total = (
            original_get_monthly_expense_total
        )
        app.dependency_overrides.clear()