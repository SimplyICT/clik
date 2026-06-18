-- Asset Management System - Schema
-- New tables only. No ALTER on existing tables.

CREATE TABLE IF NOT EXISTS assets_v2 (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_name TEXT NOT NULL,
    asset_code TEXT NOT NULL UNIQUE,
    qr_code TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT 'Other',
    sub_category TEXT,
    status TEXT NOT NULL DEFAULT 'Active',
    lifecycle_status TEXT NOT NULL DEFAULT 'active',
    criticality TEXT NOT NULL DEFAULT 'Medium',
    manufacturer TEXT,
    model TEXT,
    serial_number TEXT,
    customer_id UUID,
    customer_location_id UUID,
    assigned_contractor_id UUID,
    parent_asset_id UUID,
    install_date DATE,
    purchase_date DATE,
    warranty_expiry_date DATE,
    last_service_date DATE,
    next_service_date DATE,
    photo_urls TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);

CREATE TABLE IF NOT EXISTS asset_custom_field_defs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL,
    field_name TEXT NOT NULL,
    field_label TEXT NOT NULL,
    field_type TEXT NOT NULL DEFAULT 'text',
    options JSONB,
    required BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    UNIQUE(category, field_name)
);

CREATE TABLE IF NOT EXISTS asset_parts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_id UUID,
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_threshold INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'each',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_part_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    part_id UUID,
    request_id UUID,
    quantity INTEGER NOT NULL,
    used_by UUID,
    used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_v2_customer_id ON assets_v2(customer_id);
CREATE INDEX IF NOT EXISTS idx_assets_v2_contractor_id ON assets_v2(assigned_contractor_id);
CREATE INDEX IF NOT EXISTS idx_assets_v2_category ON assets_v2(category);
CREATE INDEX IF NOT EXISTS idx_assets_v2_status ON assets_v2(status);
CREATE INDEX IF NOT EXISTS idx_assets_v2_qr_code ON assets_v2(qr_code);
CREATE INDEX IF NOT EXISTS idx_asset_parts_sku ON asset_parts(sku);

CREATE OR REPLACE FUNCTION update_assets_v2_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assets_v2_updated_at ON assets_v2;
CREATE TRIGGER trg_assets_v2_updated_at
    BEFORE UPDATE ON assets_v2
    FOR EACH ROW EXECUTE FUNCTION update_assets_v2_updated_at();

-- Phase 1: Extend assets_v2 with financial, location, and meter columns
ALTER TABLE assets_v2 ADD COLUMN IF NOT EXISTS purchase_cost DECIMAL(12,2);
ALTER TABLE assets_v2 ADD COLUMN IF NOT EXISTS replacement_value DECIMAL(12,2);
ALTER TABLE assets_v2 ADD COLUMN IF NOT EXISTS depreciation_method TEXT DEFAULT 'none';
ALTER TABLE assets_v2 ADD COLUMN IF NOT EXISTS useful_life_years INTEGER;
ALTER TABLE assets_v2 ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE assets_v2 ADD COLUMN IF NOT EXISTS contractor_name TEXT;
ALTER TABLE assets_v2 ADD COLUMN IF NOT EXISTS hours_run DECIMAL(10,2);
ALTER TABLE assets_v2 ADD COLUMN IF NOT EXISTS meter_reading DECIMAL(10,2);

-- Phase 1: Asset documents table
CREATE TABLE IF NOT EXISTS asset_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_id UUID NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL DEFAULT 'other',
    file_size INTEGER,
    mime_type TEXT,
    uploaded_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_asset_documents_asset_id ON asset_documents(asset_id);

-- Phase 1: Asset audit log table
CREATE TABLE IF NOT EXISTS asset_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    actor_id UUID,
    actor_name TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_asset_audit_log_asset_id ON asset_audit_log(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_audit_log_created_at ON asset_audit_log(created_at);

-- Phase 1: Asset cost history table
CREATE TABLE IF NOT EXISTS asset_cost_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_id UUID NOT NULL,
    cost_type TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    recorded_date DATE NOT NULL,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_asset_cost_history_asset_id ON asset_cost_history(asset_id);
