import json
import uuid
from datetime import timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import select, func, asc

from app.core.db import get_db
from app.api.deps import require_auctioneer, require_bidder, get_current_user
from app.models import (
  RFQ, RFQStatus, AuctionConfig, AuctionStatus, Bid, BidHistory, SupplierProfile, User, UserRole,
  AuctionExtension, AuctionActivityLog
)
from app.schemas.schemas import BidSubmit
from app.services.auction_engine import (
  place_bid, get_leaderboard, compute_rankings, log_event, close_auction, activate_if_due, utcnow, _ensure_aware
)
from app.ws.manager import manager

router = APIRouter(prefix="/auctions", tags=["auctions"])


def _get_supplier(user: User, db: Session) -> SupplierProfile:
  prof = db.query(SupplierProfile).filter(SupplierProfile.user_id == user.id).first()
  if not prof:
    raise HTTPException(status_code=400, detail="Supplier profile not found")
  return prof


def _rfq_or_404(db: Session, rfq_id: uuid.UUID) -> RFQ:
  rfq = db.get(RFQ, rfq_id)
  if not rfq:
    raise HTTPException(status_code=404, detail="RFQ not found")
  return rfq


@router.get("/{rfq_id}/state")
def auction_state(rfq_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
  rfq = _rfq_or_404(db, rfq_id)
  if user.role == UserRole.AUCTIONEER and rfq.auctioneer_id != user.id:
    raise HTTPException(status_code=403, detail="Not your RFQ")
  config = rfq.auction_config
  if not config:
    raise HTTPException(status_code=400, detail="Auction not configured")

  # opportunistic status sync
  activate_if_due(db, rfq, config)
  db.commit()
  db.refresh(rfq)
  db.refresh(config)

  supplier_id = None
  if user.role == UserRole.BIDDER:
    supplier_id = _get_supplier(user, db).id

  leaderboard = get_leaderboard(db, rfq_id, user.role, supplier_id)
  bids = db.query(Bid).filter(Bid.rfq_id == rfq_id).all()
  total_bids = db.query(func.count(BidHistory.id)).filter(BidHistory.rfq_id == rfq_id).scalar() or 0
  current_l1 = min([b.total_bid_amount for b in bids], default=None)
  initial_best = db.query(func.max(BidHistory.total_bid_amount)).filter(BidHistory.rfq_id == rfq_id).scalar()
  # better initial: first bid amount overall
  first_hist = db.query(BidHistory).filter(BidHistory.rfq_id == rfq_id).order_by(asc(BidHistory.created_at)).first()
  initial_best_quote = first_hist.total_bid_amount if first_hist else None
  savings_amount = (initial_best_quote - current_l1) if (initial_best_quote is not None and current_l1 is not None) else None
  savings_percent = None
  if initial_best_quote and current_l1 and initial_best_quote > 0:
    savings_percent = float((initial_best_quote - current_l1) / initial_best_quote * 100)

  extensions_count = db.query(func.count(AuctionExtension.id)).filter(AuctionExtension.rfq_id == rfq_id).scalar() or 0

  my_rank = None
  my_bid = None
  if user.role == UserRole.BIDDER and supplier_id:
    for e in leaderboard:
      if e.get("is_self"):
        my_rank = e["rank"]
    my_bid_obj = db.query(Bid).filter(Bid.rfq_id == rfq_id, Bid.supplier_id == supplier_id).first()
    if my_bid_obj:
      my_bid = {
        "total_bid_amount": str(my_bid_obj.total_bid_amount),
        "freight_charges": str(my_bid_obj.freight_charges),
        "origin_charges": str(my_bid_obj.origin_charges),
        "destination_charges": str(my_bid_obj.destination_charges),
        "revision_number": my_bid_obj.revision_number,
        "transit_time": my_bid_obj.transit_time,
        "quote_validity_days": my_bid_obj.quote_validity_days,
      }

  participating = db.query(func.count(Bid.id)).filter(Bid.rfq_id == rfq_id).scalar() or 0

  return {
    "rfq": {
      "id": str(rfq.id),
      "reference_id": rfq.reference_id,
      "title": rfq.title,
      "category": rfq.category,
      "description": rfq.description,
      "quantity": rfq.quantity,
      "specifications": rfq.specifications,
      "pickup_location": rfq.pickup_location,
      "delivery_location": rfq.delivery_location,
      "transit_window": rfq.transit_window,
      "status": rfq.status.value,
    },
    "config": {
      "auction_start_time": config.auction_start_time.isoformat(),
      "initial_closing_time": config.initial_closing_time.isoformat(),
      "current_closing_time": config.current_closing_time.isoformat(),
      "forced_closing_time": config.forced_closing_time.isoformat(),
      "trigger_window_minutes": config.trigger_window_minutes,
      "extension_duration_minutes": config.extension_duration_minutes,
      "extension_trigger_type": config.extension_trigger_type.value,
      "status": config.status.value,
    },
    "leaderboard": leaderboard,
    "total_bids": total_bids,
    "participating_suppliers": participating,
    "current_l1": str(current_l1) if current_l1 is not None else None,
    "initial_best_quote": str(initial_best_quote) if initial_best_quote is not None else None,
    "savings_amount": str(savings_amount) if savings_amount is not None else None,
    "savings_percent": round(savings_percent, 2) if savings_percent is not None else None,
    "extensions_count": extensions_count,
    "my_rank": my_rank,
    "my_bid": my_bid,
  }


@router.post("/{rfq_id}/bids")
async def submit_bid(rfq_id: uuid.UUID, payload: BidSubmit, db: Session = Depends(get_db), user: User = Depends(require_bidder)):
  supplier = _get_supplier(user, db)
  try:
    result = place_bid(db, rfq_id, supplier, payload)
    db.commit()
  except Exception:
    db.rollback()
    raise

  # broadcast events
  await manager.broadcast(str(rfq_id), {"type": "BID_PLACED", "rfq_id": str(rfq_id)})
  if result.get("extension"):
    ext = result["extension"]
    await manager.broadcast(str(rfq_id), {
      "type": "AUCTION_EXTENDED",
      "rfq_id": str(rfq_id),
      "reason": ext["reason"],
      "new_closing_time": _ensure_aware(ext["new_closing_time"]).isoformat(),
    })
  # closure may happen inside engine? check state
  rfq = db.get(RFQ, rfq_id)
  if rfq and rfq.auction_config and rfq.auction_config.status == AuctionStatus.CLOSED:
    await manager.broadcast(str(rfq_id), {"type": "AUCTION_CLOSED", "rfq_id": str(rfq_id)})

  return {"status": "ok", "rank": result["rank"], "revision_number": result["revision_number"]}


@router.get("/{rfq_id}/my-bids")
def my_bid_history(rfq_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_bidder)):
  supplier = _get_supplier(user, db)
  rows = db.query(BidHistory).filter(BidHistory.rfq_id == rfq_id, BidHistory.supplier_id == supplier.id).order_by(BidHistory.created_at.desc()).all()
  return [{
    "id": str(r.id),
    "total_bid_amount": str(r.total_bid_amount),
    "freight_charges": str(r.freight_charges),
    "origin_charges": str(r.origin_charges),
    "destination_charges": str(r.destination_charges),
    "revision_number": r.revision_number,
    "created_at": r.created_at.isoformat(),
    "transit_time": r.transit_time,
    "quote_validity_days": r.quote_validity_days,
  } for r in rows]


@router.get("/{rfq_id}/all-bids")
def all_bids(rfq_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_auctioneer)):
  rfq = _rfq_or_404(db, rfq_id)
  if rfq.auctioneer_id != user.id:
    raise HTTPException(status_code=403, detail="Not your RFQ")
  rows = db.query(BidHistory).filter(BidHistory.rfq_id == rfq_id).order_by(BidHistory.created_at.desc()).all()
  supplier_map = {s.id: s.company_name for s in db.query(SupplierProfile).all()}
  return [{
    "id": str(r.id),
    "supplier_name": supplier_map.get(r.supplier_id, "Supplier"),
    "supplier_id": str(r.supplier_id),
    "total_bid_amount": str(r.total_bid_amount),
    "freight_charges": str(r.freight_charges),
    "origin_charges": str(r.origin_charges),
    "destination_charges": str(r.destination_charges),
    "revision_number": r.revision_number,
    "rank_at_time": r.rank_at_time,
    "created_at": r.created_at.isoformat(),
    "transit_time": r.transit_time,
  } for r in rows]


@router.get("/{rfq_id}/activity")
def activity(rfq_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
  rfq = _rfq_or_404(db, rfq_id)
  if user.role == UserRole.AUCTIONEER and rfq.auctioneer_id != user.id:
    raise HTTPException(status_code=403, detail="Not your RFQ")
  logs = db.query(AuctionActivityLog).filter(AuctionActivityLog.rfq_id == rfq_id).order_by(AuctionActivityLog.created_at.desc()).limit(100).all()
  result = []
  for l in logs:
    msg = l.message
    # hide competitor identity from bidders in messages (best effort for MVP)
    if user.role == UserRole.BIDDER and l.event_type == "BID_PLACED":
      msg = "New bid placed — leaderboard updated"
    result.append({
      "id": str(l.id),
      "event_type": l.event_type,
      "message": msg,
      "created_at": l.created_at.isoformat(),
    })
  return result


@router.get("/{rfq_id}/extensions")
def extensions(rfq_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_auctioneer)):
  rfq = _rfq_or_404(db, rfq_id)
  if rfq.auctioneer_id != user.id:
    raise HTTPException(status_code=403, detail="Not your RFQ")
  rows = db.query(AuctionExtension).filter(AuctionExtension.rfq_id == rfq_id).order_by(AuctionExtension.created_at.desc()).all()
  return [{
    "id": str(e.id),
    "old_closing_time": e.old_closing_time.isoformat(),
    "new_closing_time": e.new_closing_time.isoformat(),
    "reason": e.reason,
    "triggered_by": e.triggered_by,
    "created_at": e.created_at.isoformat(),
  } for e in rows]


@router.post("/{rfq_id}/extend-manual")
async def extend_manual(rfq_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_auctioneer)):
  rfq = _rfq_or_404(db, rfq_id)
  if rfq.auctioneer_id != user.id:
    raise HTTPException(status_code=403, detail="Not your RFQ")
  config = rfq.auction_config
  if config.status != AuctionStatus.ACTIVE:
    raise HTTPException(status_code=400, detail="Auction not active")
  old = _ensure_aware(config.current_closing_time)
  proposed = old + timedelta(minutes=config.extension_duration_minutes)
  new_close = min(proposed, _ensure_aware(config.forced_closing_time))
  if new_close <= old:
    raise HTTPException(status_code=400, detail="Cannot extend beyond forced closing time")
  config.current_closing_time = new_close
  db.add(AuctionExtension(rfq_id=rfq.id, old_closing_time=old, new_closing_time=new_close, reason="Manual extension by auctioneer", triggered_by="AUCTIONEER"))
  log_event(db, rfq.id, "AUCTION_EXTENDED", f"Auction extended manually by {config.extension_duration_minutes} minutes")
  db.commit()
  await manager.broadcast(str(rfq_id), {"type": "AUCTION_EXTENDED", "rfq_id": str(rfq_id), "reason": "Manual extension", "new_closing_time": new_close.isoformat()})
  return {"new_closing_time": new_close.isoformat()}


@router.post("/{rfq_id}/force-close")
async def force_close(rfq_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_auctioneer)):
  rfq = _rfq_or_404(db, rfq_id)
  if rfq.auctioneer_id != user.id:
    raise HTTPException(status_code=403, detail="Not your RFQ")
  config = rfq.auction_config
  close_auction(db, rfq, config, "Force closed by auctioneer")
  db.commit()
  await manager.broadcast(str(rfq_id), {"type": "AUCTION_CLOSED", "rfq_id": str(rfq_id)})
  return {"status": "closed"}


@router.post("/{rfq_id}/cancel")
async def cancel(rfq_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_auctioneer)):
  rfq = _rfq_or_404(db, rfq_id)
  if rfq.auctioneer_id != user.id:
    raise HTTPException(status_code=403, detail="Not your RFQ")
  rfq.status = RFQStatus.CANCELLED
  rfq.auction_config.status = AuctionStatus.CANCELLED
  log_event(db, rfq.id, "AUCTION_CANCELLED", "Auction cancelled by auctioneer")
  db.commit()
  await manager.broadcast(str(rfq_id), {"type": "AUCTION_CLOSED", "rfq_id": str(rfq_id), "cancelled": True})
  return {"status": "cancelled"}


@router.websocket("/ws/{rfq_id}")
async def auction_ws(websocket: WebSocket, rfq_id: str):
  await manager.connect(rfq_id, websocket)
  try:
    while True:
      # keepalive / ignore client messages
      await websocket.receive_text()
  except WebSocketDisconnect:
    manager.disconnect(rfq_id, websocket)
  except Exception:
    manager.disconnect(rfq_id, websocket)
