import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
  String, Text, DateTime, Enum, ForeignKey, Boolean, Integer, Numeric,
  UniqueConstraint, Index, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class UserRole(str, enum.Enum):
  AUCTIONEER = "AUCTIONEER"
  BIDDER = "BIDDER"


class RFQStatus(str, enum.Enum):
  DRAFT = "DRAFT"
  PUBLISHED = "PUBLISHED"
  ACTIVE = "ACTIVE"
  CLOSED = "CLOSED"
  CANCELLED = "CANCELLED"


class AuctionStatus(str, enum.Enum):
  SCHEDULED = "SCHEDULED"
  ACTIVE = "ACTIVE"
  CLOSED = "CLOSED"
  CANCELLED = "CANCELLED"


class ExtensionTriggerType(str, enum.Enum):
  ANY_BID = "ANY_BID"
  RANK_CHANGE = "RANK_CHANGE"
  L1_CHANGE = "L1_CHANGE"


class POStatus(str, enum.Enum):
  ISSUED = "ISSUED"
  IN_TRANSIT = "IN_TRANSIT"
  COMPLETED = "COMPLETED"


class User(Base):
  __tablename__ = "users"

  id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
  hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
  role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False, index=True)
  full_name: Mapped[str] = mapped_column(String(255), nullable=False)
  organization_name: Mapped[str | None] = mapped_column(String(255))
  department: Mapped[str | None] = mapped_column(String(255))
  is_active: Mapped[bool] = mapped_column(Boolean, default=True)
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

  supplier_profile: Mapped["SupplierProfile"] = relationship(back_populates="user", uselist=False)


class SupplierProfile(Base):
  __tablename__ = "supplier_profiles"

  id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
  company_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
  contact_person: Mapped[str | None] = mapped_column(String(255))
  phone_number: Mapped[str | None] = mapped_column(String(50))
  business_category: Mapped[str | None] = mapped_column(String(255), index=True)
  gstin: Mapped[str | None] = mapped_column(String(50))
  fleet_details: Mapped[str | None] = mapped_column(Text)
  certifications: Mapped[str | None] = mapped_column(Text)
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

  user: Mapped["User"] = relationship(back_populates="supplier_profile")
  bids: Mapped[list["Bid"]] = relationship(back_populates="supplier")
  reviews: Mapped[list["SupplierReview"]] = relationship(back_populates="supplier")
  awards: Mapped[list["ContractAward"]] = relationship(back_populates="supplier")


class RFQ(Base):
  __tablename__ = "rfqs"

  id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  reference_id: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
  auctioneer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
  title: Mapped[str] = mapped_column(String(255), nullable=False)
  category: Mapped[str | None] = mapped_column(String(255))
  description: Mapped[str | None] = mapped_column(Text)
  quantity: Mapped[str | None] = mapped_column(String(255))
  specifications: Mapped[str | None] = mapped_column(Text)
  pickup_location: Mapped[str | None] = mapped_column(String(255))
  delivery_location: Mapped[str | None] = mapped_column(String(255))
  transit_window: Mapped[str | None] = mapped_column(String(100))
  status: Mapped[RFQStatus] = mapped_column(Enum(RFQStatus), default=RFQStatus.DRAFT, index=True)
  eligible_all_suppliers: Mapped[bool] = mapped_column(Boolean, default=True)
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
  updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

  auction_config: Mapped["AuctionConfig"] = relationship(back_populates="rfq", uselist=False, cascade="all, delete-orphan")
  bids: Mapped[list["Bid"]] = relationship(back_populates="rfq")
  extensions: Mapped[list["AuctionExtension"]] = relationship(back_populates="rfq")
  logs: Mapped[list["AuctionActivityLog"]] = relationship(back_populates="rfq")
  award: Mapped["ContractAward"] = relationship(back_populates="rfq", uselist=False)


class AuctionConfig(Base):
  __tablename__ = "auction_configurations"

  id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  rfq_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rfqs.id", ondelete="CASCADE"), unique=True)
  auction_start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
  initial_closing_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
  current_closing_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
  forced_closing_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
  trigger_window_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
  extension_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
  extension_trigger_type: Mapped[ExtensionTriggerType] = mapped_column(Enum(ExtensionTriggerType), nullable=False)
  status: Mapped[AuctionStatus] = mapped_column(Enum(AuctionStatus), default=AuctionStatus.SCHEDULED, index=True)
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

  rfq: Mapped["RFQ"] = relationship(back_populates="auction_config")


class Bid(Base):
  __tablename__ = "bids"
  __table_args__ = (
    UniqueConstraint("rfq_id", "supplier_id", name="uq_bid_rfq_supplier"),
    Index("ix_bids_rfq_total", "rfq_id", "total_bid_amount"),
  )

  id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  rfq_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rfqs.id", ondelete="CASCADE"), index=True)
  supplier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("supplier_profiles.id", ondelete="CASCADE"), index=True)
  freight_charges: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
  origin_charges: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
  destination_charges: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
  total_bid_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
  transit_time: Mapped[str | None] = mapped_column(String(100))
  quote_validity_days: Mapped[int | None] = mapped_column(Integer)
  revision_number: Mapped[int] = mapped_column(Integer, default=1)
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
  updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

  rfq: Mapped["RFQ"] = relationship(back_populates="bids")
  supplier: Mapped["SupplierProfile"] = relationship(back_populates="bids")


class BidHistory(Base):
  __tablename__ = "bid_history"
  __table_args__ = (Index("ix_bid_history_rfq_created", "rfq_id", "created_at"),)

  id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  rfq_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rfqs.id", ondelete="CASCADE"), index=True)
  supplier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("supplier_profiles.id", ondelete="CASCADE"), index=True)
  freight_charges: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
  origin_charges: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
  destination_charges: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
  total_bid_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
  transit_time: Mapped[str | None] = mapped_column(String(100))
  quote_validity_days: Mapped[int | None] = mapped_column(Integer)
  revision_number: Mapped[int] = mapped_column(Integer, nullable=False)
  rank_at_time: Mapped[int | None] = mapped_column(Integer)
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuctionExtension(Base):
  __tablename__ = "auction_extensions"

  id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  rfq_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rfqs.id", ondelete="CASCADE"), index=True)
  old_closing_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
  new_closing_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
  reason: Mapped[str] = mapped_column(Text, nullable=False)
  triggered_by: Mapped[str] = mapped_column(String(50), default="SYSTEM")  # SYSTEM or AUCTIONEER
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

  rfq: Mapped["RFQ"] = relationship(back_populates="extensions")


class AuctionActivityLog(Base):
  __tablename__ = "auction_activity_logs"
  __table_args__ = (Index("ix_activity_rfq_created", "rfq_id", "created_at"),)

  id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  rfq_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rfqs.id", ondelete="CASCADE"), index=True)
  event_type: Mapped[str] = mapped_column(String(100), nullable=False)
  message: Mapped[str] = mapped_column(Text, nullable=False)
  metadata_json: Mapped[str | None] = mapped_column(Text)  # JSON string for extra details
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

  rfq: Mapped["RFQ"] = relationship(back_populates="logs")


class ContractAward(Base):
  __tablename__ = "contract_awards"

  id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  rfq_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rfqs.id", ondelete="CASCADE"), unique=True)
  supplier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("supplier_profiles.id"), nullable=False)
  awarded_bid_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
  awarded_rank: Mapped[int] = mapped_column(Integer, nullable=False)
  justification: Mapped[str | None] = mapped_column(Text)
  awarded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

  rfq: Mapped["RFQ"] = relationship(back_populates="award")
  supplier: Mapped["SupplierProfile"] = relationship(back_populates="awards")
  purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="award", uselist=False)
  review: Mapped["SupplierReview"] = relationship(back_populates="award", uselist=False)


class PurchaseOrder(Base):
  __tablename__ = "purchase_orders"

  id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  po_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
  award_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("contract_awards.id", ondelete="CASCADE"), unique=True)
  status: Mapped[POStatus] = mapped_column(Enum(POStatus), default=POStatus.ISSUED, index=True)
  issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
  completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

  award: Mapped["ContractAward"] = relationship(back_populates="purchase_order")


class SupplierReview(Base):
  __tablename__ = "supplier_reviews"
  __table_args__ = (UniqueConstraint("award_id", name="uq_review_award"),)

  id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
  supplier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("supplier_profiles.id"), index=True)
  award_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("contract_awards.id", ondelete="CASCADE"))
  reviewer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
  rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
  review_text: Mapped[str | None] = mapped_column(Text)
  created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

  supplier: Mapped["SupplierProfile"] = relationship(back_populates="reviews")
  award: Mapped["ContractAward"] = relationship(back_populates="review")
