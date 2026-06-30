-- Performance: Critical missing indexes
-- Every API request validates session via sessions.token
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Manager dashboard queries customerLocations by customerId
CREATE INDEX IF NOT EXISTS idx_customer_locations_customer_id ON "customerLocations"("customerId");

-- Assets page sorts by asset_name, no sequential scan + sort
CREATE INDEX IF NOT EXISTS idx_assets_v2_asset_name ON assets_v2(asset_name);

-- Composite index for permission lookups (user_id + resource)
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_resource ON user_permissions(user_id, resource);

-- Work orders sorted by created_at desc
CREATE INDEX IF NOT EXISTS idx_asset_work_orders_created_at ON asset_work_orders(created_at DESC);

-- Requests filtered by customer_id (manager dashboard)
CREATE INDEX IF NOT EXISTS idx_requests_customer_id ON requests("customerId");
