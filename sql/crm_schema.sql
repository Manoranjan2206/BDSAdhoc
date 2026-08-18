-- ============================================================================
-- Enterprise CRM Schema for BDSAdhoc Multi-Tenant Databases
-- Compatible with PostgreSQL 14+
-- Enables Row Level Security (RLS) via 'app.current_region' session variable
-- ============================================================================

-- 1. Users Table (Platform users, matches InMemoryUserStore)
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    region VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Contacts Table (Leads & Customers)
CREATE TABLE IF NOT EXISTS contacts (
    contact_id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    company VARCHAR(255),
    job_title VARCHAR(150),
    region VARCHAR(100) NOT NULL,
    lead_source VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Active',
    owner_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Products Table (Product & Service Catalog)
CREATE TABLE IF NOT EXISTS products (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    unit_price NUMERIC(15,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Deals Table (Sales Opportunities & Pipeline)
CREATE TABLE IF NOT EXISTS deals (
    deal_id SERIAL PRIMARY KEY,
    deal_name VARCHAR(255) NOT NULL,
    contact_id INT REFERENCES contacts(contact_id) ON DELETE SET NULL,
    owner_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE SET NULL,
    stage VARCHAR(50) NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    probability INT CHECK (probability >= 0 AND probability <= 100),
    region VARCHAR(100) NOT NULL,
    expected_close_date DATE,
    actual_close_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Deal Products Table (Line items per deal)
CREATE TABLE IF NOT EXISTS deal_products (
    deal_product_id SERIAL PRIMARY KEY,
    deal_id INT REFERENCES deals(deal_id) ON DELETE CASCADE,
    product_id INT REFERENCES products(product_id) ON DELETE CASCADE,
    quantity INT DEFAULT 1,
    unit_price NUMERIC(15,2),
    discount_pct NUMERIC(5,2) DEFAULT 0,
    total_price NUMERIC(15,2)
);

-- 6. Activities Table (Customer Touchpoints)
CREATE TABLE IF NOT EXISTS activities (
    activity_id SERIAL PRIMARY KEY,
    activity_type VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    contact_id INT REFERENCES contacts(contact_id) ON DELETE CASCADE,
    deal_id INT REFERENCES deals(deal_id) ON DELETE SET NULL,
    owner_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE SET NULL,
    region VARCHAR(100) NOT NULL,
    activity_date TIMESTAMPTZ NOT NULL,
    duration_minutes INT,
    outcome VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Invoices Table (Billing Records)
CREATE TABLE IF NOT EXISTS invoices (
    invoice_id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    contact_id INT REFERENCES contacts(contact_id) ON DELETE SET NULL,
    deal_id INT REFERENCES deals(deal_id) ON DELETE SET NULL,
    amount NUMERIC(15,2) NOT NULL,
    tax_amount NUMERIC(15,2) DEFAULT 0,
    total_amount NUMERIC(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'Draft',
    region VARCHAR(100) NOT NULL,
    issued_date DATE NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE,
    created_by VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Revenue Summary Table (Monthly Aggregate KPIs)
CREATE TABLE IF NOT EXISTS revenue_summary (
    revenue_id SERIAL PRIMARY KEY,
    month DATE NOT NULL,
    region VARCHAR(100) NOT NULL,
    total_revenue NUMERIC(15,2),
    total_deals_won INT,
    total_deals_lost INT,
    avg_deal_size NUMERIC(15,2),
    new_contacts INT,
    CONSTRAINT idx_revenue_summary_month_region UNIQUE (month, region)
);

-- 9. Support Tickets Table (Customer Support Cases)
CREATE TABLE IF NOT EXISTS support_tickets (
    ticket_id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    contact_id INT REFERENCES contacts(contact_id) ON DELETE CASCADE,
    priority VARCHAR(20) DEFAULT 'Medium',
    status VARCHAR(50) DEFAULT 'Open',
    category VARCHAR(100),
    assigned_to VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE SET NULL,
    region VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    satisfaction_score INT CHECK (satisfaction_score >= 1 AND satisfaction_score <= 5)
);

-- 10. Campaigns Table (Marketing Campaigns)
CREATE TABLE IF NOT EXISTS campaigns (
    campaign_id SERIAL PRIMARY KEY,
    campaign_name VARCHAR(255) NOT NULL,
    campaign_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Planned',
    budget NUMERIC(15,2),
    actual_cost NUMERIC(15,2),
    start_date DATE,
    end_date DATE,
    region VARCHAR(100) NOT NULL,
    owner_email VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE SET NULL,
    leads_generated INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Campaign Contacts Table (Junction Table)
CREATE TABLE IF NOT EXISTS campaign_contacts (
    campaign_contact_id SERIAL PRIMARY KEY,
    campaign_id INT REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    contact_id INT REFERENCES contacts(contact_id) ON DELETE CASCADE,
    responded BOOLEAN DEFAULT FALSE,
    response_date DATE,
    CONSTRAINT idx_campaign_contacts_uniq UNIQUE (campaign_id, contact_id)
);

-- 12. Tasks Table (User To-Dos and Tasks)
CREATE TABLE IF NOT EXISTS tasks (
    task_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assigned_to VARCHAR(255) REFERENCES users(email) ON UPDATE CASCADE ON DELETE SET NULL,
    related_contact_id INT REFERENCES contacts(contact_id) ON DELETE SET NULL,
    related_deal_id INT REFERENCES deals(deal_id) ON DELETE SET NULL,
    priority VARCHAR(20) DEFAULT 'Medium',
    status VARCHAR(50) DEFAULT 'Pending',
    due_date DATE,
    region VARCHAR(100) NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Audit Log Table (System Change Tracking)
CREATE TABLE IF NOT EXISTS audit_log (
    log_id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id INT,
    action VARCHAR(20) NOT NULL,
    performed_by VARCHAR(255),
    region VARCHAR(100),
    details JSONB,
    performed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Email Logs Table (Email Communications)
CREATE TABLE IF NOT EXISTS email_logs (
    email_log_id SERIAL PRIMARY KEY,
    from_email VARCHAR(255) NOT NULL,
    to_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body_preview TEXT,
    contact_id INT REFERENCES contacts(contact_id) ON DELETE SET NULL,
    deal_id INT REFERENCES deals(deal_id) ON DELETE SET NULL,
    region VARCHAR(100) NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) DEFAULT 'Sent'
);

-- ============================================================================
-- INDEXES FOR OPTIMIZED QUERY PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_contacts_region ON contacts(region);
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner_email);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);

CREATE INDEX IF NOT EXISTS idx_deals_region ON deals(region);
CREATE INDEX IF NOT EXISTS idx_deals_owner ON deals(owner_email);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at);

CREATE INDEX IF NOT EXISTS idx_activities_region ON activities(region);
CREATE INDEX IF NOT EXISTS idx_activities_owner ON activities(owner_email);
CREATE INDEX IF NOT EXISTS idx_activities_contact ON activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(activity_date);

CREATE INDEX IF NOT EXISTS idx_invoices_region ON invoices(region);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issued ON invoices(issued_date);

CREATE INDEX IF NOT EXISTS idx_tickets_region ON support_tickets(region);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);

CREATE INDEX IF NOT EXISTS idx_tasks_region ON tasks(region);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

CREATE INDEX IF NOT EXISTS idx_email_logs_region ON email_logs(region);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Uses 'app.current_region' session variable.
-- When 'app.current_region' is set to 'ALL' or null/empty, all rows are accessible.
-- ============================================================================

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE deals FORCE ROW LEVEL SECURITY;
ALTER TABLE activities FORCE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE revenue_summary FORCE ROW LEVEL SECURITY;
ALTER TABLE support_tickets FORCE ROW LEVEL SECURITY;
ALTER TABLE campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE email_logs FORCE ROW LEVEL SECURITY;

-- Helper function for RLS policy check
CREATE OR REPLACE FUNCTION rls_region_check(row_region VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        current_setting('app.current_region', true) IS NULL OR
        current_setting('app.current_region', true) = '' OR
        current_setting('app.current_region', true) = 'ALL' OR
        row_region = current_setting('app.current_region', true)
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Apply RLS Policies
DROP POLICY IF EXISTS rls_contacts_policy ON contacts;
CREATE POLICY rls_contacts_policy ON contacts USING (rls_region_check(region));

DROP POLICY IF EXISTS rls_deals_policy ON deals;
CREATE POLICY rls_deals_policy ON deals USING (rls_region_check(region));

DROP POLICY IF EXISTS rls_activities_policy ON activities;
CREATE POLICY rls_activities_policy ON activities USING (rls_region_check(region));

DROP POLICY IF EXISTS rls_invoices_policy ON invoices;
CREATE POLICY rls_invoices_policy ON invoices USING (rls_region_check(region));

DROP POLICY IF EXISTS rls_revenue_summary_policy ON revenue_summary;
CREATE POLICY rls_revenue_summary_policy ON revenue_summary USING (rls_region_check(region));

DROP POLICY IF EXISTS rls_support_tickets_policy ON support_tickets;
CREATE POLICY rls_support_tickets_policy ON support_tickets USING (rls_region_check(region));

DROP POLICY IF EXISTS rls_campaigns_policy ON campaigns;
CREATE POLICY rls_campaigns_policy ON campaigns USING (rls_region_check(region));

DROP POLICY IF EXISTS rls_tasks_policy ON tasks;
CREATE POLICY rls_tasks_policy ON tasks USING (rls_region_check(region));

DROP POLICY IF EXISTS rls_audit_log_policy ON audit_log;
CREATE POLICY rls_audit_log_policy ON audit_log USING (rls_region_check(region));

DROP POLICY IF EXISTS rls_email_logs_policy ON email_logs;
CREATE POLICY rls_email_logs_policy ON email_logs USING (rls_region_check(region));
