-- Invite tokens for auto-provisioning (magic link onboarding)
CREATE TABLE IF NOT EXISTS invite_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_invite_tokens_token ON invite_tokens(token);

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

-- Phase 2: Asset maintenance schedules table
CREATE TABLE IF NOT EXISTS asset_maintenance_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    frequency_type TEXT NOT NULL,
    frequency_value INTEGER NOT NULL,
    last_completed TIMESTAMPTZ,
    next_due TIMESTAMPTZ,
    assigned_contractor_id UUID,
    auto_create_work_order BOOLEAN DEFAULT FALSE,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_asset_maintenance_schedules_asset_id ON asset_maintenance_schedules(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_maintenance_schedules_next_due ON asset_maintenance_schedules(next_due);

-- Phase 2: Asset work orders table
CREATE TABLE IF NOT EXISTS asset_work_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_id UUID NOT NULL,
    schedule_id UUID,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'pending',
    assigned_contractor_id UUID,
    scheduled_date DATE,
    completed_date DATE,
    completed_by UUID,
    labor_hours DECIMAL(6,2),
    labor_cost DECIMAL(10,2),
    parts_cost DECIMAL(10,2) DEFAULT 0,
    total_cost DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_asset_work_orders_asset_id ON asset_work_orders(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_work_orders_status ON asset_work_orders(status);
CREATE INDEX IF NOT EXISTS idx_asset_work_orders_assigned_contractor ON asset_work_orders(assigned_contractor_id);

-- Permissions Matrix: per-user view/edit access per resource
CREATE TABLE IF NOT EXISTS user_permissions (
    user_id UUID NOT NULL,
    resource TEXT NOT NULL,
    can_view BOOLEAN NOT NULL DEFAULT false,
    can_edit BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (user_id, resource)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);

-- User management: archived flag + profile fields
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS pushover_user_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS postcode TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
