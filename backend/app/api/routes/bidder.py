from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.db import get_db
from app.api.deps import require_bidder
from app.models import User, SupplierProfile, Bid, RFQ, BidHistory, ContractAward, SupplierReview, POStatus, AuctionConfig, AuctionActivityLog
from app.schemas.schemas import SupplierProfileUpdate

router = APIRouter(prefix="/bidder", tags=["bidder"])


def _get_supplier(user: User, db: Session) -> SupplierProfile:
    prof = db.query(SupplierProfile).filter(SupplierProfile.user_id == user.id).first()
    if not prof:
        raise HTTPException(status_code=400, detail="Supplier profile not found")
    return prof


@router.get("/profile")
def get_profile(db: Session = Depends(get_db), user: User = Depends(require_bidder)):
    s = _get_supplier(user, db)
    awards = db.query(ContractAward).filter(ContractAward.supplier_id == s.id).all()
    completed = sum(1 for a in awards if a.purchase_order and a.purchase_order.status == POStatus.COMPLETED)
    reviews = db.query(SupplierReview).filter(SupplierReview.supplier_id == s.id).all()
    avg = (sum(r.rating for r in reviews) / len(reviews)) if reviews else None
    return {
        "id": str(s.id),
        "company_name": s.company_name,
        "contact_person": s.contact_person,
        "phone_number": s.phone_number,
        "business_category": s.business_category,
        "gstin": s.gstin,
        "fleet_details": s.fleet_details,
        "certifications": s.certifications,
        "awarded_contracts": len(awards),
        "completed_contracts": completed,
        "successful_deliveries": completed,
        "average_rating": round(avg, 2) if avg else None,
    }


@router.put("/profile")
def update_profile(payload: SupplierProfileUpdate, db: Session = Depends(get_db), user: User = Depends(require_bidder)):
    s = _get_supplier(user, db)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return {"status": "ok"}


@router.get("/bid-history")
def all_my_bid_history(db: Session = Depends(get_db), user: User = Depends(require_bidder)):
    s = _get_supplier(user, db)
    rows = db.query(BidHistory).filter(BidHistory.supplier_id == s.id).order_by(BidHistory.created_at.desc()).all()
    rfq_map = {r.id: r for r in db.query(RFQ).all()}
    # outcome per rfq
    awards = {a.rfq_id: a for a in db.query(ContractAward).all()}
    result = []
    seen_rfqs = set()
    for h in rows:
        rfq = rfq_map.get(h.rfq_id)
        outcome = "In Progress"
        if rfq and rfq.status.value == "CLOSED":
            award = awards.get(rfq.id)
            outcome = "Won" if award and award.supplier_id == s.id else "Lost"
        result.append({
            "id": str(h.id),
            "rfq_id": str(h.rfq_id),
            "rfq_reference": rfq.reference_id if rfq else None,
            "rfq_title": rfq.title if rfq else None,
            "total_bid_amount": str(h.total_bid_amount),
            "freight_charges": str(h.freight_charges),
            "origin_charges": str(h.origin_charges),
            "destination_charges": str(h.destination_charges),
            "revision_number": h.revision_number,
            "created_at": h.created_at.isoformat(),
            "outcome": outcome,
        })
    return result


@router.get("/notifications")
def notifications(db: Session = Depends(get_db), user: User = Depends(require_bidder)):
    """Contextual notifications for a bidder, derived from real auction events.

    Competitor identities are never included. Only events for auctions the
    supplier has actually bid in are returned.
    """
    supplier = _get_supplier(user, db)
    my_bids = db.query(Bid).filter(Bid.supplier_id == supplier.id).all()
    rfq_ids = [b.rfq_id for b in my_bids]
    if not rfq_ids:
        return []
    rfq_map = {r.id: r for r in db.query(RFQ).filter(RFQ.id.in_(rfq_ids)).all()}
    logs = db.query(AuctionActivityLog).filter(AuctionActivityLog.rfq_id.in_(rfq_ids)).order_by(AuctionActivityLog.created_at.desc()).limit(20).all()

    result = []
    for log in logs:
        rfq = rfq_map.get(log.rfq_id)
        message = log.message
        # anonymize competitor-facing bid/award messages
        if log.event_type in ("BID_PLACED", "CONTRACT_AWARDED"):
            if log.event_type == "CONTRACT_AWARDED":
                message = f"An award decision was recorded for {rfq.reference_id}" if rfq else "An award decision was recorded"
            else:
                message = f"You were outbid on {rfq.reference_id} — check your rank" if rfq else "A new bid was placed"
        result.append({
            "id": str(log.id),
            "event_type": log.event_type,
            "message": message,
            "created_at": log.created_at.isoformat(),
            "rfq_id": str(log.rfq_id),
        })
    return result


@router.get("/my-auctions")
def my_auctions(db: Session = Depends(get_db), user: User = Depends(require_bidder)):
    s = _get_supplier(user, db)
    bids = db.query(Bid).filter(Bid.supplier_id == s.id).all()
    rfq_ids = [b.rfq_id for b in bids]
    if not rfq_ids:
        return []
    rfqs = db.query(RFQ).filter(RFQ.id.in_(rfq_ids)).all()
    result = []
    for rfq in rfqs:
        my_bid = next((b for b in bids if b.rfq_id == rfq.id), None)
        # compute rank
        all_bids = db.query(Bid).filter(Bid.rfq_id == rfq.id).order_by(Bid.total_bid_amount.asc()).all()
        rank = next((i+1 for i, b in enumerate(all_bids) if b.supplier_id == s.id), None)
        l1 = all_bids[0].total_bid_amount if all_bids else None
        result.append({
            "id": str(rfq.id),
            "reference_id": rfq.reference_id,
            "title": rfq.title,
            "status": rfq.status.value,
            "auction_status": rfq.auction_config.status.value if rfq.auction_config else None,
            "my_bid": str(my_bid.total_bid_amount) if my_bid else None,
            "my_rank": rank,
            "current_l1": str(l1) if l1 else None,
            "current_closing_time": rfq.auction_config.current_closing_time.isoformat() if rfq.auction_config else None,
        })
    return result
