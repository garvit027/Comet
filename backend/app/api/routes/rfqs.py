import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.db import get_db
from app.api.deps import require_auctioneer, get_current_user
from app.models import RFQ, RFQStatus, AuctionConfig, AuctionStatus, User, UserRole
from app.schemas.schemas import RFQCreate, RFQUpdate, RFQOut
from app.services.auction_engine import log_event

router = APIRouter(prefix="/rfqs", tags=["rfqs"])


def _gen_ref() -> str:
  return f"RFQ-{uuid.uuid4().hex[:6].upper()}"


@router.post("", response_model=RFQOut)
def create_rfq(payload: RFQCreate, db: Session = Depends(get_db), user: User = Depends(require_auctioneer)):
  cfg = payload.auction_config
  if cfg.forced_closing_time <= cfg.initial_closing_time:
    raise HTTPException(status_code=400, detail="Forced closing time must be later than initial closing time")
  if cfg.initial_closing_time <= cfg.auction_start_time:
    raise HTTPException(status_code=400, detail="Initial closing must be after start time")

  rfq = RFQ(
    reference_id=_gen_ref(),
    auctioneer_id=user.id,
    title=payload.title,
    category=payload.category,
    description=payload.description,
    quantity=payload.quantity,
    specifications=payload.specifications,
    pickup_location=payload.pickup_location,
    delivery_location=payload.delivery_location,
    transit_window=payload.transit_window,
    status=RFQStatus.DRAFT,
    eligible_all_suppliers=payload.eligible_all_suppliers,
  )
  db.add(rfq)
  db.flush()
  config = AuctionConfig(
    rfq_id=rfq.id,
    auction_start_time=cfg.auction_start_time,
    initial_closing_time=cfg.initial_closing_time,
    current_closing_time=cfg.initial_closing_time,
    forced_closing_time=cfg.forced_closing_time,
    trigger_window_minutes=cfg.trigger_window_minutes,
    extension_duration_minutes=cfg.extension_duration_minutes,
    extension_trigger_type=cfg.extension_trigger_type,
    status=AuctionStatus.SCHEDULED,
  )
  db.add(config)
  db.commit()
  db.refresh(rfq)
  return rfq


@router.get("")
def list_rfqs(status: str | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
  q = select(RFQ)
  if user.role == UserRole.AUCTIONEER:
    q = q.where(RFQ.auctioneer_id == user.id)
  else:
    # bidders see published/active/closed eligible auctions (available auctions)
    q = q.where(RFQ.status.in_([RFQStatus.PUBLISHED, RFQStatus.ACTIVE, RFQStatus.CLOSED]))
  if status:
    q = q.where(RFQ.status == RFQStatus(status))
  q = q.order_by(RFQ.created_at.desc())
  rfqs = db.execute(q).scalars().all()
  result = []
  for r in rfqs:
    result.append({
      "id": str(r.id),
      "reference_id": r.reference_id,
      "title": r.title,
      "category": r.category,
      "description": r.description,
      "quantity": r.quantity,
      "pickup_location": r.pickup_location,
      "delivery_location": r.delivery_location,
      "status": r.status.value,
      "auction_config": {
        "auction_start_time": r.auction_config.auction_start_time.isoformat() if r.auction_config else None,
        "initial_closing_time": r.auction_config.initial_closing_time.isoformat() if r.auction_config else None,
        "current_closing_time": r.auction_config.current_closing_time.isoformat() if r.auction_config else None,
        "forced_closing_time": r.auction_config.forced_closing_time.isoformat() if r.auction_config else None,
        "status": r.auction_config.status.value if r.auction_config else None,
        "trigger_window_minutes": r.auction_config.trigger_window_minutes if r.auction_config else None,
        "extension_duration_minutes": r.auction_config.extension_duration_minutes if r.auction_config else None,
        "extension_trigger_type": r.auction_config.extension_trigger_type.value if r.auction_config else None,
      } if r.auction_config else None,
      "created_at": r.created_at.isoformat(),
    })
  return result


@router.get("/{rfq_id}")
def get_rfq(rfq_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
  rfq = db.get(RFQ, rfq_id)
  if not rfq:
    raise HTTPException(status_code=404, detail="RFQ not found")
  if user.role == UserRole.BIDDER and rfq.status == RFQStatus.DRAFT:
    raise HTTPException(status_code=403, detail="Not accessible")
  if user.role == UserRole.AUCTIONEER and rfq.auctioneer_id != user.id:
    raise HTTPException(status_code=403, detail="Not your RFQ")
  return rfq


@router.put("/{rfq_id}", response_model=RFQOut)
def update_rfq(rfq_id: uuid.UUID, payload: RFQUpdate, db: Session = Depends(get_db), user: User = Depends(require_auctioneer)):
  rfq = db.get(RFQ, rfq_id)
  if not rfq or rfq.auctioneer_id != user.id:
    raise HTTPException(status_code=404, detail="RFQ not found")
  if rfq.status != RFQStatus.DRAFT:
    raise HTTPException(status_code=400, detail="Only unpublished (draft) RFQs can be edited")
  data = payload.model_dump(exclude_unset=True)
  cfg_data = data.pop("auction_config", None)
  for k, v in data.items():
    setattr(rfq, k, v)
  if cfg_data and rfq.auction_config:
    cfg = rfq.auction_config
    if cfg_data.get("forced_closing_time") and cfg_data.get("initial_closing_time"):
      if cfg_data["forced_closing_time"] <= cfg_data["initial_closing_time"]:
        raise HTTPException(status_code=400, detail="Forced closing time must be later than initial closing time")
    for k, v in cfg_data.items():
      setattr(cfg, k, v)
    cfg.current_closing_time = cfg.initial_closing_time
  db.commit()
  db.refresh(rfq)
  return rfq


@router.post("/{rfq_id}/publish", response_model=RFQOut)
def publish_rfq(rfq_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_auctioneer)):
  rfq = db.get(RFQ, rfq_id)
  if not rfq or rfq.auctioneer_id != user.id:
    raise HTTPException(status_code=404, detail="RFQ not found")
  if rfq.status != RFQStatus.DRAFT:
    raise HTTPException(status_code=400, detail="RFQ already published or not editable")
  rfq.status = RFQStatus.PUBLISHED
  log_event(db, rfq.id, "RFQ_PUBLISHED", f"RFQ {rfq.reference_id} published")
  db.commit()
  db.refresh(rfq)
  return rfq
