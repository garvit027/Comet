from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.db import get_db
from app.api.deps import require_auctioneer, require_bidder
from app.models import RFQ, RFQStatus, AuctionConfig, AuctionStatus, Bid, BidHistory, SupplierProfile, User, ContractAward, POStatus, AuctionActivityLog

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/auctioneer")
def auctioneer_dashboard(db: Session = Depends(get_db), user: User = Depends(require_auctioneer)):
    rfqs = db.query(RFQ).filter(RFQ.auctioneer_id == user.id).all()
    total_rfqs = len(rfqs)
    active = sum(1 for r in rfqs if r.auction_config and r.auction_config.status == AuctionStatus.ACTIVE)
    completed = sum(1 for r in rfqs if r.auction_config and r.auction_config.status == AuctionStatus.CLOSED)
    supplier_count = db.query(func.count(func.distinct(Bid.supplier_id))).join(RFQ, Bid.rfq_id == RFQ.id).filter(RFQ.auctioneer_id == user.id).scalar() or 0

    auctions = []
    for r in sorted(rfqs, key=lambda x: x.created_at, reverse=True):
        bids = db.query(Bid).filter(Bid.rfq_id == r.id).order_by(Bid.total_bid_amount.asc()).all()
        l1 = bids[0].total_bid_amount if bids else None
        first_hist = db.query(BidHistory).filter(BidHistory.rfq_id == r.id).order_by(BidHistory.created_at.asc()).first()
        initial = first_hist.total_bid_amount if first_hist else None
        savings_pct = None
        if initial and l1 and initial > 0:
            savings_pct = float((initial - l1) / initial * 100)
        auctions.append({
            "id": str(r.id),
            "reference_id": r.reference_id,
            "title": r.title,
            "status": r.status.value,
            "auction_status": r.auction_config.status.value if r.auction_config else None,
            "current_l1": str(l1) if l1 else None,
            "initial_best_quote": str(initial) if initial else None,
            "savings_percent": round(savings_pct, 2) if savings_pct is not None else None,
            "current_closing_time": r.auction_config.current_closing_time.isoformat() if r.auction_config else None,
            "participating_suppliers": len(bids),
        })

    # recent activity across my rfqs
    rfq_ids = [r.id for r in rfqs]
    recent = []
    if rfq_ids:
        logs = db.query(AuctionActivityLog).filter(AuctionActivityLog.rfq_id.in_(rfq_ids)).order_by(AuctionActivityLog.created_at.desc()).limit(15).all()
        recent = [{"event_type": l.event_type, "message": l.message, "created_at": l.created_at.isoformat(), "rfq_id": str(l.rfq_id)} for l in logs]

    return {
        "stats": {
            "total_rfqs": total_rfqs,
            "active_auctions": active,
            "completed_auctions": completed,
            "participating_suppliers": supplier_count,
        },
        "auctions": auctions,
        "recent_activity": recent,
    }


@router.get("/bidder")
def bidder_dashboard(db: Session = Depends(get_db), user: User = Depends(require_bidder)):
    supplier = db.query(SupplierProfile).filter(SupplierProfile.user_id == user.id).first()
    if not supplier:
        return {"stats": {}, "my_auctions": [], "available_counts": {}}
    my_bids = db.query(Bid).filter(Bid.supplier_id == supplier.id).all()
    rfq_ids = [b.rfq_id for b in my_bids]
    my_rfqs = db.query(RFQ).filter(RFQ.id.in_(rfq_ids)).all() if rfq_ids else []

    awards = db.query(ContractAward).filter(ContractAward.supplier_id == supplier.id).all()
    completed = sum(1 for a in awards if a.purchase_order and a.purchase_order.status == POStatus.COMPLETED)
    reviews = db.query(SupplierReview).filter(SupplierReview.supplier_id == supplier.id).all()
    avg = (sum(r.rating for r in reviews) / len(reviews)) if reviews else None

    my_auctions = []
    for rfq in my_rfqs:
        my_bid = next((b for b in my_bids if b.rfq_id == rfq.id), None)
        all_bids = db.query(Bid).filter(Bid.rfq_id == rfq.id).order_by(Bid.total_bid_amount.asc()).all()
        rank = next((i+1 for i, b in enumerate(all_bids) if b.supplier_id == supplier.id), None)
        l1 = all_bids[0].total_bid_amount if all_bids else None
        my_auctions.append({
            "id": str(rfq.id), "reference_id": rfq.reference_id, "title": rfq.title,
            "status": rfq.status.value,
            "auction_status": rfq.auction_config.status.value if rfq.auction_config else None,
            "my_bid": str(my_bid.total_bid_amount) if my_bid else None,
            "my_rank": rank, "current_l1": str(l1) if l1 else None,
        })

    all_published = db.query(RFQ).filter(RFQ.status.in_([RFQStatus.PUBLISHED, RFQStatus.ACTIVE, RFQStatus.CLOSED])).all()
    available_counts = {
        "available_published": sum(1 for r in all_published if r.status == RFQStatus.PUBLISHED),
        "active": sum(1 for r in all_published if r.auction_config and r.auction_config.status == AuctionStatus.ACTIVE),
        "upcoming": sum(1 for r in all_published if r.auction_config and r.auction_config.status == AuctionStatus.SCHEDULED),
        "completed": sum(1 for r in all_published if r.auction_config and r.auction_config.status == AuctionStatus.CLOSED),
    }

    return {
        "performance": {
            "awarded_contracts": len(awards),
            "completed_contracts": completed,
            "successful_deliveries": completed,
            "average_rating": round(avg, 2) if avg else None,
        },
        "available_counts": available_counts,
        "my_auctions": my_auctions[:10],
    }
