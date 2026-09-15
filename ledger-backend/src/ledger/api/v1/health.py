from fastapi import APIRouter

router = APIRouter()


@router.get("/health", tags=["system"])
async def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "blacklane-ledger-api",
    }