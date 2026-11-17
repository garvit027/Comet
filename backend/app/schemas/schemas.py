from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict

from app.models import UserRole, RFQStatus, AuctionStatus, ExtensionTriggerType, POStatus


# Auth
class UserCreate(BaseModel):
  email: EmailStr
  password: str = Field(min_length=6)
  role: UserRole
  full_name: str
  # Bidder fields
  company_name: Optional[str] = None
  contact_person: Optional[str] = None
  phone_number: Optional[str] = None
  business_category: Optional[str] = None
  gstin: Optional[str] = None
  # Auctioneer fields
  organization_name: Optional[str] = None
  department: Optional[str] = None


class Token(BaseModel):
  access_token: str
  token_type: str = "bearer"
  role: UserRole
  user_id: UUID
  full_name: str
  company_name: Optional[str] = None


class LoginRequest(BaseModel):
  email: EmailStr
  password: str


class UserOut(BaseModel):
  model_config = ConfigDict(from_attributes=True)
  id: UUID
  email: EmailStr
  role: UserRole
  full_name: str
  organization_name: Optional[str] = None
  department: Optional[str] = None


# Supplier
class SupplierProfileUpdate(BaseModel):
  company_name: Optional[str] = None
  contact_person: Optional[str] = None
  phone_number: Optional[str] = None
  business_category: Optional[str] = None
  gstin: Optional[str] = None
  fleet_details: Optional[str] = None
  certifications: Optional[str] = None


class SupplierProfileOut(BaseModel):
  model_config = ConfigDict(from_attributes=True)
  id: UUID
  user_id: UUID
  company_name: str
  contact_person: Optional[str] = None
  phone_number: Optional[str] = None
  business_category: Optional[str] = None
  gstin: Optional[str] = None
  fleet_details: Optional[str] = None
  certifications: Optional[str] = None
  awarded_contracts: int = 0
  completed_contracts: int = 0
  successful_deliveries: int = 0
  average_rating: Optional[float] = None


# RFQ / Auction
class AuctionConfigIn(BaseModel):
  auction_start_time: datetime
  initial_closing_time: datetime
  forced_closing_time: datetime
  trigger_window_minutes: int = Field(gt=0)
  extension_duration_minutes: int = Field(gt=0)
  extension_trigger_type: ExtensionTriggerType

  @field_validator("forced_closing_time")
  @classmethod
  def forced_after_initial(cls, v, info):
    initial = info.data.get("initial_closing_time")
    if initial and v <= initial:
      raise ValueError("Forced closing time must be later than initial closing time")
    return v


class AuctionConfigOut(BaseModel):
  model_config = ConfigDict(from_attributes=True)
  auction_start_time: datetime
  initial_closing_time: datetime
  current_closing_time: datetime
  forced_closing_time: datetime
  trigger_window_minutes: int
  extension_duration_minutes: int
  extension_trigger_type: ExtensionTriggerType
  status: AuctionStatus


class RFQCreate(BaseModel):
  title: str
  category: Optional[str] = None
  description: Optional[str] = None
  quantity: Optional[str] = None
  specifications: Optional[str] = None
  pickup_location: Optional[str] = None
  delivery_location: Optional[str] = None
  transit_window: Optional[str] = None
  eligible_all_suppliers: bool = True
  auction_config: AuctionConfigIn


class RFQUpdate(BaseModel):
  title: Optional[str] = None
  category: Optional[str] = None
  description: Optional[str] = None
  quantity: Optional[str] = None
  specifications: Optional[str] = None
  pickup_location: Optional[str] = None
  delivery_location: Optional[str] = None
  transit_window: Optional[str] = None
  eligible_all_suppliers: Optional[bool] = None
  auction_config: Optional[AuctionConfigIn] = None


class RFQOut(BaseModel):
  model_config = ConfigDict(from_attributes=True)
  id: UUID
  reference_id: str
  title: str
  category: Optional[str]
  description: Optional[str]
  quantity: Optional[str]
  specifications: Optional[str]
  pickup_location: Optional[str]
  delivery_location: Optional[str]
  transit_window: Optional[str]
  status: RFQStatus
  eligible_all_suppliers: bool
  auction_config: Optional[AuctionConfigOut] = None
  created_at: datetime


# Bids
class BidSubmit(BaseModel):
  freight_charges: Decimal = Field(gt=0)
  origin_charges: Decimal = Field(ge=0)
  destination_charges: Decimal = Field(ge=0)
  total_bid_amount: Optional[Decimal] = None
  transit_time: Optional[str] = None
  quote_validity_days: Optional[int] = Field(default=None, gt=0)


class BidOut(BaseModel):
  model_config = ConfigDict(from_attributes=True)
  id: UUID
  rfq_id: UUID
  supplier_id: UUID
  freight_charges: Decimal
  origin_charges: Decimal
  destination_charges: Decimal
  total_bid_amount: Decimal
  transit_time: Optional[str]
  quote_validity_days: Optional[int]
  revision_number: int
  created_at: datetime
  updated_at: datetime


class BidHistoryOut(BaseModel):
  model_config = ConfigDict(from_attributes=True)
  id: UUID
  rfq_id: UUID
  supplier_id: UUID
  total_bid_amount: Decimal
  freight_charges: Decimal
  origin_charges: Decimal
  destination_charges: Decimal
  revision_number: int
  rank_at_time: Optional[int]
  created_at: datetime
  transit_time: Optional[str]
  quote_validity_days: Optional[int]


class LeaderboardEntry(BaseModel):
  rank: int
  supplier_id: Optional[UUID] = None
  supplier_name: str
  total_bid_amount: Decimal
  last_bid_time: datetime
  is_self: bool = False


class AuctionState(BaseModel):
  rfq: RFQOut
  leaderboard: List[LeaderboardEntry]
  total_bids: int
  current_l1: Optional[Decimal] = None
  initial_best_quote: Optional[Decimal] = None
  savings_amount: Optional[Decimal] = None
  savings_percent: Optional[float] = None
  extensions_count: int = 0


# Award / PO / Review
class AwardCreate(BaseModel):
  supplier_id: UUID
  justification: Optional[str] = None


class AwardOut(BaseModel):
  model_config = ConfigDict(from_attributes=True)
  id: UUID
  rfq_id: UUID
  supplier_id: UUID
  awarded_bid_amount: Decimal
  awarded_rank: int
  justification: Optional[str]
  created_at: datetime


class POOut(BaseModel):
  model_config = ConfigDict(from_attributes=True)
  id: UUID
  po_number: str
  award_id: UUID
  status: POStatus
  issued_at: datetime
  completed_at: Optional[datetime] = None


class ReviewCreate(BaseModel):
  rating: int = Field(ge=1, le=5)
  review_text: Optional[str] = None
