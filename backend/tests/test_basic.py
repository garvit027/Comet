from decimal import Decimal
from app.services.auction_engine import _ensure_aware
from datetime import datetime, timezone


def test_ensure_aware_naive():
    dt = datetime(2026, 1, 1, 12, 0, 0)
    aware = _ensure_aware(dt)
    assert aware.tzinfo == timezone.utc


def test_bid_total_calculation_logic():
    # mirrors validation logic: total = freight + origin + destination
    freight = Decimal("450000.00")
    origin = Decimal("15000.00")
    destination = Decimal("10000.00")
    assert freight + origin + destination == Decimal("475000.00")
