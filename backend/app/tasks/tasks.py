from datetime import datetime, timezone
from sqlalchemy import select

from app.tasks.celery_app import celery_app
from app.core.db import SessionLocal
from app.models import RFQ, AuctionConfig, AuctionStatus, RFQStatus
from app.services.auction_engine import activate_if_due, close_auction, _ensure_aware, log_event


@celery_app.task
def process_auction_lifecycle():
    """Periodic task: activate scheduled auctions and close expired ones."""
    db = SessionLocal()
    try:
        configs = db.execute(select(AuctionConfig).where(AuctionConfig.status.in_([AuctionStatus.SCHEDULED, AuctionStatus.ACTIVE]))).scalars().all()
        for cfg in configs:
            rfq = db.get(RFQ, cfg.rfq_id)
            if not rfq:
                continue
            activate_if_due(db, rfq, cfg)
            now = datetime.now(timezone.utc)
            if cfg.status == AuctionStatus.ACTIVE and now >= min(_ensure_aware(cfg.current_closing_time), _ensure_aware(cfg.forced_closing_time)):
                close_auction(db, rfq, cfg, "Auction closed by scheduler")
        db.commit()
    finally:
        db.close()
