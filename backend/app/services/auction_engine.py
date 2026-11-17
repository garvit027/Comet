import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select, func, asc
from sqlalchemy.orm import Session

from app.models import (
    RFQ, RFQStatus, AuctionConfig, AuctionStatus, ExtensionTriggerType,
    Bid, BidHistory, AuctionExtension, AuctionActivityLog, SupplierProfile, UserRole
)


def utcnow():
    return datetime.now(timezone.utc)


def _ensure_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def compute_rankings(db: Session, rfq_id) -> list[tuple[Bid, int]]:
    bids = db.execute(
        select(Bid).where(Bid.rfq_id == rfq_id).order_by(asc(Bid.total_bid_amount), asc(Bid.updated_at))
    ).scalars().all()
    return [(b, idx + 1) for idx, b in enumerate(bids)]


def get_leaderboard(db: Session, rfq_id, viewer_role: UserRole, viewer_supplier_id=None):
    rankings = compute_rankings(db, rfq_id)
    entries = []
    for bid, rank in rankings:
        is_self = viewer_supplier_id is not None and bid.supplier_id == viewer_supplier_id
        if viewer_role == UserRole.AUCTIONEER:
            supplier = db.get(SupplierProfile, bid.supplier_id)
            name = supplier.company_name if supplier else "Supplier"
        else:
            if is_self:
                supplier = db.get(SupplierProfile, bid.supplier_id)
                name = f"{supplier.company_name} (You)" if supplier else "You"
            else:
                name = f"Bidder #{rank}" if rank == 1 else f"Bidder #{rank}"  # anonymized
        entries.append({
            "rank": rank,
            "supplier_id": bid.supplier_id if viewer_role == UserRole.AUCTIONEER or is_self else None,
            "supplier_name": name,
            "total_bid_amount": bid.total_bid_amount,
            "last_bid_time": bid.updated_at,
            "is_self": is_self,
        })
    return entries


def log_event(db: Session, rfq_id, event_type: str, message: str, metadata: dict | None = None):
    db.add(AuctionActivityLog(
        rfq_id=rfq_id,
        event_type=event_type,
        message=message,
        metadata_json=json.dumps(metadata) if metadata else None,
    ))


def activate_if_due(db: Session, rfq: RFQ, config: AuctionConfig):
    now = utcnow()
    start = _ensure_aware(config.auction_start_time)
    end = _ensure_aware(config.current_closing_time)
    forced = _ensure_aware(config.forced_closing_time)
    if config.status == AuctionStatus.SCHEDULED and start <= now < min(end, forced):
        config.status = AuctionStatus.ACTIVE
        rfq.status = RFQStatus.ACTIVE
        log_event(db, rfq.id, "AUCTION_STARTED", f"Auction started for {rfq.reference_id}")
    elif config.status == AuctionStatus.ACTIVE and now >= min(end, forced):
        close_auction(db, rfq, config, reason="Auction closing time reached")


def close_auction(db: Session, rfq: RFQ, config: AuctionConfig, reason: str = "Auction closed"):
    if config.status == AuctionStatus.CLOSED:
        return
    config.status = AuctionStatus.CLOSED
    rfq.status = RFQStatus.CLOSED
    log_event(db, rfq.id, "AUCTION_CLOSED", reason)


def maybe_extend(db: Session, rfq: RFQ, config: AuctionConfig, bid_time: datetime, rank_changed: bool, l1_changed: bool) -> dict | None:
    if config.status != AuctionStatus.ACTIVE:
        return None
    bid_time = _ensure_aware(bid_time)
    current_close = _ensure_aware(config.current_closing_time)
    forced = _ensure_aware(config.forced_closing_time)
    trigger_window_start = current_close - timedelta(minutes=config.trigger_window_minutes)

    in_window = bid_time >= trigger_window_start and bid_time <= current_close
    if not in_window:
        return None

    should_extend = False
    reason = ""
    if config.extension_trigger_type == ExtensionTriggerType.ANY_BID:
        should_extend = True
        reason = f"New bid in last {config.trigger_window_minutes} minutes"
    elif config.extension_trigger_type == ExtensionTriggerType.RANK_CHANGE and rank_changed:
        should_extend = True
        reason = f"Ranking change in last {config.trigger_window_minutes} minutes"
    elif config.extension_trigger_type == ExtensionTriggerType.L1_CHANGE and l1_changed:
        should_extend = True
        reason = f"L1 changed in last {config.trigger_window_minutes} minutes"

    if not should_extend:
        return None

    proposed = current_close + timedelta(minutes=config.extension_duration_minutes)
    new_close = min(proposed, forced)
    if new_close <= current_close:
        return None

    old = current_close
    config.current_closing_time = new_close
    db.add(AuctionExtension(
        rfq_id=rfq.id,
        old_closing_time=old,
        new_closing_time=new_close,
        reason=reason,
        triggered_by="SYSTEM",
    ))
    log_event(db, rfq.id, "AUCTION_EXTENDED", f"Auction extended by {config.extension_duration_minutes} minutes — Reason: {reason}",
              {"old_closing_time": old.isoformat(), "new_closing_time": new_close.isoformat(), "reason": reason})
    return {"old_closing_time": old, "new_closing_time": new_close, "reason": reason}


def place_bid(db: Session, rfq_id, supplier: SupplierProfile, payload) -> dict[str, Any]:
    # Lock RFQ/config row to serialize concurrent bids and extension updates
    rfq = db.execute(select(RFQ).where(RFQ.id == rfq_id).with_for_update()).scalar_one_or_none()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")
    config = db.execute(select(AuctionConfig).where(AuctionConfig.rfq_id == rfq_id).with_for_update()).scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=400, detail="Auction not configured")

    activate_if_due(db, rfq, config)
    now = utcnow()
    if config.status != AuctionStatus.ACTIVE or rfq.status != RFQStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Auction is not active")
    if now >= min(_ensure_aware(config.current_closing_time), _ensure_aware(config.forced_closing_time)):
        close_auction(db, rfq, config, "Auction already closed")
        raise HTTPException(status_code=400, detail="Auction is closed")

    # Eligibility: for MVP require category match if not all eligible? keep simple: allow all published/active
    # (can be tightened with eligibility table; not required by core spec beyond "eligible published auctions")

    total = payload.freight_charges + payload.origin_charges + payload.destination_charges
    if payload.total_bid_amount is not None and payload.total_bid_amount != total:
        raise HTTPException(status_code=400, detail="Total bid amount must equal sum of charges")
    if total <= 0:
        raise HTTPException(status_code=400, detail="Invalid bid amount")

    prev_rankings = compute_rankings(db, rfq_id)
    prev_l1_supplier = prev_rankings[0][0].supplier_id if prev_rankings else None
    prev_rank_map = {b.supplier_id: r for b, r in prev_rankings}

    existing = db.execute(
        select(Bid).where(Bid.rfq_id == rfq_id, Bid.supplier_id == supplier.id)
    ).scalar_one_or_none()

    if existing:
        if total >= existing.total_bid_amount:
            raise HTTPException(status_code=400, detail="New bid must be strictly lower than your current bid")
        existing.freight_charges = payload.freight_charges
        existing.origin_charges = payload.origin_charges
        existing.destination_charges = payload.destination_charges
        existing.total_bid_amount = total
        existing.transit_time = payload.transit_time
        existing.quote_validity_days = payload.quote_validity_days
        existing.revision_number += 1
        bid = existing
    else:
        bid = Bid(
            rfq_id=rfq_id,
            supplier_id=supplier.id,
            freight_charges=payload.freight_charges,
            origin_charges=payload.origin_charges,
            destination_charges=payload.destination_charges,
            total_bid_amount=total,
            transit_time=payload.transit_time,
            quote_validity_days=payload.quote_validity_days,
            revision_number=1,
        )
        db.add(bid)
        db.flush()

    # recompute rankings after update
    new_rankings = compute_rankings(db, rfq_id)
    new_rank_map = {b.supplier_id: r for b, r in new_rankings}
    new_l1_supplier = new_rankings[0][0].supplier_id if new_rankings else None
    rank_changed = prev_rank_map != new_rank_map
    l1_changed = prev_l1_supplier != new_l1_supplier
    my_rank = new_rank_map.get(supplier.id)

    db.add(BidHistory(
        rfq_id=rfq_id,
        supplier_id=supplier.id,
        freight_charges=payload.freight_charges,
        origin_charges=payload.origin_charges,
        destination_charges=payload.destination_charges,
        total_bid_amount=total,
        transit_time=payload.transit_time,
        quote_validity_days=payload.quote_validity_days,
        revision_number=bid.revision_number,
        rank_at_time=my_rank,
    ))

    log_event(db, rfq_id, "BID_PLACED",
              f"New bid received — ₹ {total} (revision #{bid.revision_number})" + (" (now L1)" if new_l1_supplier == supplier.id else ""),
              {"supplier_id": str(supplier.id), "amount": str(total), "revision": bid.revision_number, "rank": my_rank, "l1": str(new_l1_supplier) == str(supplier.id)})

    extension = maybe_extend(db, rfq, config, now, rank_changed, l1_changed)

    # close if forced reached by extension boundary check handled on next actions; but ensure state
    if now >= _ensure_aware(config.current_closing_time):
        close_auction(db, rfq, config, "Closing time reached")

    return {
        "bid_id": bid.id,
        "total": total,
        "rank": my_rank,
        "revision_number": bid.revision_number,
        "extension": extension,
        "l1_changed": l1_changed,
        "rank_changed": rank_changed,
    }
