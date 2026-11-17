-- Comet PostgreSQL schema (MVP)
-- Note: The FastAPI app also creates tables via SQLAlchemy metadata on startup.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('AUCTIONEER', 'BIDDER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE rfq_status AS ENUM ('DRAFT', 'PUBLISHED', 'ACTIVE', 'CLOSED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE auction_status AS ENUM ('SCHEDULED', 'ACTIVE', 'CLOSED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE extension_trigger_type AS ENUM ('ANY_BID', 'RANK_CHANGE', 'L1_CHANGE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE po_status AS ENUM ('ISSUED', 'IN_TRANSIT', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  role user_role NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  approval_status approval_status NOT NULL DEFAULT 'APPROVED',
  organization_name VARCHAR(255),
  department VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  phone_number VARCHAR(50),
  business_category VARCHAR(255),
  gstin VARCHAR(50),
  fleet_details TEXT,
  certifications TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rfqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id VARCHAR(50) UNIQUE NOT NULL,
  auctioneer_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(255),
  description TEXT,
  quantity VARCHAR(255),
  specifications TEXT,
  pickup_location VARCHAR(255),
  delivery_location VARCHAR(255),
  transit_window VARCHAR(100),
  status rfq_status NOT NULL DEFAULT 'DRAFT',
  eligible_all_suppliers BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auction_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID UNIQUE NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  auction_start_time TIMESTAMPTZ NOT NULL,
  initial_closing_time TIMESTAMPTZ NOT NULL,
  current_closing_time TIMESTAMPTZ NOT NULL,
  forced_closing_time TIMESTAMPTZ NOT NULL,
  trigger_window_minutes INTEGER NOT NULL,
  extension_duration_minutes INTEGER NOT NULL,
  extension_trigger_type extension_trigger_type NOT NULL,
  status auction_status NOT NULL DEFAULT 'SCHEDULED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES supplier_profiles(id) ON DELETE CASCADE,
  freight_charges NUMERIC(14,2) NOT NULL,
  origin_charges NUMERIC(14,2) NOT NULL,
  destination_charges NUMERIC(14,2) NOT NULL,
  total_bid_amount NUMERIC(14,2) NOT NULL,
  transit_time VARCHAR(100),
  quote_validity_days INTEGER,
  revision_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_bid_rfq_supplier UNIQUE (rfq_id, supplier_id)
);
CREATE INDEX IF NOT EXISTS ix_bids_rfq_total ON bids(rfq_id, total_bid_amount);

CREATE TABLE IF NOT EXISTS bid_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES supplier_profiles(id) ON DELETE CASCADE,
  freight_charges NUMERIC(14,2) NOT NULL,
  origin_charges NUMERIC(14,2) NOT NULL,
  destination_charges NUMERIC(14,2) NOT NULL,
  total_bid_amount NUMERIC(14,2) NOT NULL,
  transit_time VARCHAR(100),
  quote_validity_days INTEGER,
  revision_number INTEGER NOT NULL,
  rank_at_time INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_bid_history_rfq_created ON bid_history(rfq_id, created_at);

CREATE TABLE IF NOT EXISTS auction_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  old_closing_time TIMESTAMPTZ NOT NULL,
  new_closing_time TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  triggered_by VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auction_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  metadata_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_activity_rfq_created ON auction_activity_logs(rfq_id, created_at);

CREATE TABLE IF NOT EXISTS contract_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID UNIQUE NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES supplier_profiles(id),
  awarded_bid_amount NUMERIC(14,2) NOT NULL,
  awarded_rank INTEGER NOT NULL,
  justification TEXT,
  awarded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(50) UNIQUE NOT NULL,
  award_id UUID UNIQUE NOT NULL REFERENCES contract_awards(id) ON DELETE CASCADE,
  status po_status NOT NULL DEFAULT 'ISSUED',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS supplier_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES supplier_profiles(id),
  award_id UUID UNIQUE NOT NULL REFERENCES contract_awards(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
