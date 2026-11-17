import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.db import get_db
from app.api.deps import require_auctioneer, require_approved
from app.models import (
    RFQ, AuctionStatus, AuctionConfig, Bid, SupplierProfile, ContractAward, PurchaseOrder, POStatus,
    SupplierReview, User, BidHistory
)
from app.schemas.schemas import AwardCreate, ReviewCreate
from app.services.auction_engine import compute_rankings, log_event

router = APIRouter(tags=["evaluation"])


def _gen_po() -> str:
    return f"PO-{uuid.uuid4().hex[:8].upper()}"


@router.get("/auctions/{rfq_id}/evaluation")
def evaluation_data(rfq_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_auctioneer)):
    rfq = db.get(RFQ, rfq_id)
    if not rfq or rfq.auctioneer_id != user.id:
        raise HTTPException(status_code=404, detail="RFQ not found")
    if rfq.auction_config.status != AuctionStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Auction must be closed for evaluation")
    rankings = compute_rankings(db, rfq_id)
    rows = []
    for bid, rank in rankings:
        supplier = db.get(SupplierProfile, bid.supplier_id)
        awards = db.query(ContractAward).filter(ContractAward.supplier_id == supplier.id).all() if supplier else []
        completed = sum(1 for a in awards if a.purchase_order and a.purchase_order.status == POStatus.COMPLETED)
        reviews = db.query(SupplierReview).filter(SupplierReview.supplier_id == supplier.id).all() if supplier else []
        avg_rating = (sum(r.rating for r in reviews) / len(reviews)) if reviews else None
        rows.append({
            "rank": rank,
            "supplier_id": str(bid.supplier_id),
            "supplier_name": supplier.company_name if supplier else "Supplier",
            "total_bid_amount": str(bid.total_bid_amount),
            "freight_charges": str(bid.freight_charges),
            "origin_charges": str(bid.origin_charges),
            "destination_charges": str(bid.destination_charges),
            "transit_time": bid.transit_time,
            "quote_validity_days": bid.quote_validity_days,
            "awarded_contracts": len(awards),
            "completed_contracts": completed,
            "successful_deliveries": completed,
            "average_rating": round(avg_rating, 2) if avg_rating else None,
        })
    return {"rfq_id": str(rfq_id), "reference_id": rfq.reference_id, "title": rfq.title, "suppliers": rows}


@router.post("/auctions/{rfq_id}/award")
def award_contract(rfq_id: uuid.UUID, payload: AwardCreate, db: Session = Depends(get_db), user: User = Depends(require_auctioneer)):
    rfq = db.get(RFQ, rfq_id)
    if not rfq or rfq.auctioneer_id != user.id:
        raise HTTPException(status_code=404, detail="RFQ not found")
    if rfq.auction_config.status != AuctionStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Auction must be closed before awarding")
    existing = db.query(ContractAward).filter(ContractAward.rfq_id == rfq_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Contract already awarded")

    rankings = compute_rankings(db, rfq_id)
    rank_map = {b.supplier_id: (rank, b) for b, rank in rankings}
    if payload.supplier_id not in rank_map:
        raise HTTPException(status_code=400, detail="Supplier did not bid in this auction")
    awarded_rank, bid = rank_map[payload.supplier_id]
    if awarded_rank != 1 and not (payload.justification and payload.justification.strip()):
        raise HTTPException(status_code=400, detail="Justification required when selecting non-L1 supplier")

    award = ContractAward(
        rfq_id=rfq_id,
        supplier_id=payload.supplier_id,
        awarded_bid_amount=bid.total_bid_amount,
        awarded_rank=awarded_rank,
        justification=payload.justification,
        awarded_by=user.id,
    )
    db.add(award)
    db.flush()
    po = PurchaseOrder(po_number=_gen_po(), award_id=award.id, status=POStatus.ISSUED)
    db.add(po)
    log_event(db, rfq_id, "CONTRACT_AWARDED", f"Contract awarded (rank #{awarded_rank})", {"supplier_id": str(payload.supplier_id)})
    db.commit()
    return {"award_id": str(award.id), "po_number": po.po_number, "po_status": po.status.value}


@router.get("/purchase-orders")
def list_pos(db: Session = Depends(get_db), user: User = Depends(require_auctioneer)):
    pos = db.query(PurchaseOrder).join(ContractAward).join(RFQ).filter(RFQ.auctioneer_id == user.id).order_by(PurchaseOrder.issued_at.desc()).all()
    result = []
    for po in pos:
        award = po.award
        rfq = db.get(RFQ, award.rfq_id)
        supplier = db.get(SupplierProfile, award.supplier_id)
        result.append({
            "id": str(po.id),
            "po_number": po.po_number,
            "status": po.status.value,
            "issued_at": po.issued_at.isoformat(),
            "completed_at": po.completed_at.isoformat() if po.completed_at else None,
            "rfq_reference": rfq.reference_id if rfq else None,
            "rfq_title": rfq.title if rfq else None,
            "supplier_name": supplier.company_name if supplier else None,
            "supplier_id": str(award.supplier_id),
            "awarded_bid_amount": str(award.awarded_bid_amount),
            "award_id": str(award.id),
            "has_review": award.review is not None,
        })
    return result


@router.post("/purchase-orders/{po_id}/status")
def update_po_status(po_id: uuid.UUID, status: POStatus, db: Session = Depends(get_db), user: User = Depends(require_auctioneer)):
    po = db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    rfq = db.get(RFQ, po.award.rfq_id)
    if not rfq or rfq.auctioneer_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    po.status = status
    if status == POStatus.COMPLETED:
        po.completed_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": po.status.value}


@router.post("/purchase-orders/{po_id}/review")
def create_review(po_id: uuid.UUID, payload: ReviewCreate, db: Session = Depends(get_db), user: User = Depends(require_auctioneer)):
    po = db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    award = po.award
    rfq = db.get(RFQ, award.rfq_id)
    if not rfq or rfq.auctioneer_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    if po.status != POStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Reviews allowed only for completed contracts")
    if award.review:
        raise HTTPException(status_code=400, detail="Review already exists")
    review = SupplierReview(
        supplier_id=award.supplier_id,
        award_id=award.id,
        reviewer_id=user.id,
        rating=payload.rating,
        review_text=payload.review_text,
    )
    db.add(review)
    db.commit()
    return {"status": "ok"}


@router.get("/suppliers")
def list_suppliers(db: Session = Depends(get_db), user: User = Depends(require_auctioneer)):
    suppliers = db.query(SupplierProfile).all()
    result = []
    for s in suppliers:
        awards = db.query(ContractAward).filter(ContractAward.supplier_id == s.id).all()
        completed = sum(1 for a in awards if a.purchase_order and a.purchase_order.status == POStatus.COMPLETED)
        reviews = db.query(SupplierReview).filter(SupplierReview.supplier_id == s.id).all()
        avg = (sum(r.rating for r in reviews) / len(reviews)) if reviews else None
        result.append({
            "id": str(s.id),
            "company_name": s.company_name,
            "business_category": s.business_category,
            "contact_person": s.contact_person,
            "phone_number": s.phone_number,
            "awarded_contracts": len(awards),
            "completed_contracts": completed,
            "successful_deliveries": completed,
            "average_rating": round(avg, 2) if avg else None,
        })
    return result


@router.get("/suppliers/{supplier_id}")
def supplier_detail(supplier_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_auctioneer)):
    s = db.get(SupplierProfile, supplier_id)
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    awards = db.query(ContractAward).filter(ContractAward.supplier_id == s.id).all()
    completed = sum(1 for a in awards if a.purchase_order and a.purchase_order.status == POStatus.COMPLETED)
    reviews = db.query(SupplierReview).filter(SupplierReview.supplier_id == s.id).order_by(SupplierReview.created_at.desc()).all()
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
        "reviews": [{"id": str(r.id), "rating": r.rating, "review_text": r.review_text, "created_at": r.created_at.isoformat()} for r in reviews],
    }
