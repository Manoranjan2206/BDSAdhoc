using System.Data;
using Npgsql;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BoldAdhocEmbed.Server.Services
{
    public interface IDatabaseBootstrapper
    {
        Task InitializeAllDatabasesAsync(CancellationToken ct = default);
    }

    public class DatabaseBootstrapper : IDatabaseBootstrapper
    {
        private readonly IConfiguration _config;
        private readonly ILogger<DatabaseBootstrapper> _logger;

        public DatabaseBootstrapper(IConfiguration config, ILogger<DatabaseBootstrapper> logger)
        {
            _config = config ?? throw new ArgumentNullException(nameof(config));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        private string GetHost() =>
            Environment.GetEnvironmentVariable("POSTGRES_HOST")
            ?? _config["Postgres:Host"]
            ?? "localhost";

        private string GetPort() =>
            Environment.GetEnvironmentVariable("POSTGRES_PORT")
            ?? _config["Postgres:Port"]
            ?? "5432";

        private string GetUser() =>
            Environment.GetEnvironmentVariable("POSTGRES_USER")
            ?? _config["Postgres:User"]
            ?? "postgres";

        private string GetPassword() =>
            Environment.GetEnvironmentVariable("POSTGRES_PASSWORD")
            ?? _config["Postgres:Password"]
            ?? "Password123!";

        private string GetServerConnectionString(string dbName = "postgres")
        {
            var host = GetHost();
            var port = GetPort();
            var user = GetUser();
            var password = GetPassword();
            return $"Host={host};Port={port};Database={dbName};Username={user};Password={password};Timeout=10;CommandTimeout=30;";
        }

        public async Task InitializeAllDatabasesAsync(CancellationToken ct = default)
        {
            _logger.LogInformation("Checking and initializing multi-tenant PostgreSQL databases and tables...");

            var tenantSection = _config.GetSection("TenantMappings");
            var tenants = tenantSection.GetChildren().ToList();

            if (!tenants.Any())
            {
                _logger.LogWarning("No TenantMappings found in configuration. Skipping database initialization.");
                return;
            }

            // Retry loop to accommodate databases still booting in container environments
            const int maxRetries = 5;
            for (int attempt = 1; attempt <= maxRetries; attempt++)
            {
                try
                {
                    await EnsureDatabasesExistAsync(tenants, ct);
                    break;
                }
                catch (Exception ex)
                {
                    if (attempt == maxRetries)
                    {
                        _logger.LogError(ex, "Failed to connect to PostgreSQL server after {MaxRetries} attempts. Skipping auto-initialization.", maxRetries);
                        return;
                    }
                    _logger.LogWarning("PostgreSQL not ready on attempt {Attempt}/{MaxRetries}: {Msg}. Retrying in 2s...", attempt, maxRetries, ex.Message);
                    await Task.Delay(2000, ct);
                }
            }

            // Initialize schemas, tables, and default seed data for each tenant
            foreach (var tenant in tenants)
            {
                var tenantName = tenant.Key;
                var dbName = tenant.GetValue<string>("Database");
                var defaultRegion = tenant.GetValue<string>("Region") ?? "North America";

                if (string.IsNullOrWhiteSpace(dbName)) continue;

                try
                {
                    await InitializeTenantDatabaseAsync(tenantName, dbName, defaultRegion, ct);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to initialize database {Database} for tenant {Tenant}", dbName, tenantName);
                }
            }

            _logger.LogInformation("Multi-tenant PostgreSQL database auto-initialization completed.");
        }

        private async Task EnsureDatabasesExistAsync(IEnumerable<IConfigurationSection> tenants, CancellationToken ct)
        {
            var masterConnStr = GetServerConnectionString("postgres");
            await using var conn = new NpgsqlConnection(masterConnStr);
            await conn.OpenAsync(ct);

            foreach (var tenant in tenants)
            {
                var dbName = tenant.GetValue<string>("Database");
                if (string.IsNullOrWhiteSpace(dbName)) continue;

                await using var checkCmd = new NpgsqlCommand("SELECT 1 FROM pg_database WHERE datname = @dbName;", conn);
                checkCmd.Parameters.AddWithValue("dbName", dbName);
                var exists = await checkCmd.ExecuteScalarAsync(ct);

                if (exists == null)
                {
                    _logger.LogInformation("Creating missing database: {Database}...", dbName);
                    // CREATE DATABASE cannot be executed inside a multi-statement transaction block
                    await using var createCmd = new NpgsqlCommand($"CREATE DATABASE \"{dbName}\";", conn);
                    await createCmd.ExecuteNonQueryAsync(ct);
                    _logger.LogInformation("Database {Database} created successfully.", dbName);
                }
            }
        }

        private async Task InitializeTenantDatabaseAsync(string tenantName, string dbName, string defaultRegion, CancellationToken ct)
        {
            var connStr = GetServerConnectionString(dbName);
            await using var conn = new NpgsqlConnection(connStr);
            await conn.OpenAsync(ct);

            // 1. Execute schema DDL (all tables, functions, indexes, RLS, custom_reports)
            var schemaSql = GetSchemaSql();
            await using var schemaCmd = new NpgsqlCommand(schemaSql, conn);
            await schemaCmd.ExecuteNonQueryAsync(ct);

            // Ensure server_report_name column exists on custom_reports
            await using var colCmd = new NpgsqlCommand("ALTER TABLE custom_reports ADD COLUMN IF NOT EXISTS server_report_name VARCHAR(255);", conn);
            await colCmd.ExecuteNonQueryAsync(ct);

            // Ensure tenant_schedules table exists for multi-tenant schedule isolation
            const string tenantSchedulesSql = @"
                CREATE TABLE IF NOT EXISTS tenant_schedules (
                    id SERIAL PRIMARY KEY,
                    schedule_id VARCHAR(255) NOT NULL,
                    schedule_name VARCHAR(255) NOT NULL,
                    server_schedule_name VARCHAR(255),
                    item_id VARCHAR(255),
                    item_name VARCHAR(255),
                    item_type VARCHAR(50) NOT NULL DEFAULT 'Report',
                    category_name VARCHAR(255),
                    tenant_name VARCHAR(100) NOT NULL,
                    tenant_id INT NOT NULL,
                    owner_email VARCHAR(255) NOT NULL,
                    description TEXT,
                    export_type VARCHAR(50),
                    recurrence_type VARCHAR(50),
                    is_enabled BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT uq_tenant_schedule UNIQUE (tenant_name, schedule_name)
                );";
            await using var schedCmd = new NpgsqlCommand(tenantSchedulesSql, conn);
            await schedCmd.ExecuteNonQueryAsync(ct);

            // 2. Ensure initial seed users exist if users table is empty
            await EnsureTenantUsersAsync(conn, tenantName, defaultRegion, ct);

            // 3. Ensure starter CRM data if deals table is empty
            await EnsureStarterCrmDataAsync(conn, tenantName, dbName, defaultRegion, ct);

            // 4. If AlphaCorp, ensure the pre-existing 'Test' report is mapped
            if (string.Equals(tenantName, "AlphaCorp", StringComparison.OrdinalIgnoreCase))
            {
                const string testReportSql = @"
                    INSERT INTO custom_reports (report_name, category_name, tenant_name, tenant_id, owner_email, description)
                    VALUES ('Test', 'Analytics Reports', 'AlphaCorp', 1, 'alpha1@alphacorp.com', 'Initial test report')
                    ON CONFLICT (tenant_name, report_name) DO NOTHING;";
                await using var testCmd = new NpgsqlCommand(testReportSql, conn);
                await testCmd.ExecuteNonQueryAsync(ct);
            }

            _logger.LogInformation("Database {Database} (Tenant: {Tenant}) verified with all tables and initial data.", dbName, tenantName);
        }

        private async Task EnsureTenantUsersAsync(NpgsqlConnection conn, string tenantName, string defaultRegion, CancellationToken ct)
        {
            await using var countCmd = new NpgsqlCommand("SELECT COUNT(*) FROM users;", conn);
            var count = Convert.ToInt64(await countCmd.ExecuteScalarAsync(ct));
            if (count > 0) return;

            var prefix = tenantName.ToLowerInvariant() switch
            {
                var t when t.Contains("alpha") => "alpha",
                var t when t.Contains("beta") => "beta",
                var t when t.Contains("gamma") => "gamma",
                var t when t.Contains("delta") => "delta",
                _ => tenantName.ToLowerInvariant()
            };

            var domain = $"{prefix}corp.com";
            if (prefix == "beta") domain = "betasolutions.com";
            else if (prefix == "gamma") domain = "gammaindustries.com";
            else if (prefix == "delta") domain = "deltaenterprises.com";

            var defaultUsers = new[]
            {
                ($"{prefix}1@{domain}", $"{tenantName} Admin", "Admin", defaultRegion),
                ($"{prefix}2@{domain}", $"{tenantName} Sales", "Sales", "Europe"),
                ($"{prefix}3@{domain}", $"{tenantName} Finance", "Finance", "Asia"),
                ($"{prefix}4@{domain}", $"{tenantName} Support", "Support", "Oceania"),
                ($"{prefix}5@{domain}", $"{tenantName} Operations", "Operations", "North America")
            };

            foreach (var (email, name, role, region) in defaultUsers)
            {
                const string insertUserSql = @"
                    INSERT INTO users (email, name, role, region, is_active)
                    VALUES (@email, @name, @role, @region, true)
                    ON CONFLICT (email) DO NOTHING;";
                await using var cmd = new NpgsqlCommand(insertUserSql, conn);
                cmd.Parameters.AddWithValue("email", email);
                cmd.Parameters.AddWithValue("name", name);
                cmd.Parameters.AddWithValue("role", role);
                cmd.Parameters.AddWithValue("region", region);
                await cmd.ExecuteNonQueryAsync(ct);
            }

            _logger.LogInformation("Default users seeded for {Tenant}.", tenantName);
        }

        private async Task EnsureStarterCrmDataAsync(NpgsqlConnection conn, string tenantName, string dbName, string defaultRegion, CancellationToken ct)
        {
            await using var countCmd = new NpgsqlCommand("SELECT COUNT(*) FROM deals;", conn);
            var count = Convert.ToInt64(await countCmd.ExecuteScalarAsync(ct));
            if (count > 0) return;

            // Try reading seed file from disk first
            var possiblePaths = new[]
            {
                Path.Combine(Directory.GetCurrentDirectory(), "sql", $"{dbName}_seed.sql"),
                Path.Combine(Directory.GetCurrentDirectory(), "..", "sql", $"{dbName}_seed.sql"),
                $"/docker-entrypoint-initdb.d/{dbName}_seed.sql",
                Path.Combine(AppContext.BaseDirectory, "sql", $"{dbName}_seed.sql")
            };

            foreach (var path in possiblePaths)
            {
                if (File.Exists(path))
                {
                    try
                    {
                        _logger.LogInformation("Executing seed script from {Path} for {Database}...", path, dbName);
                        var seedSql = await File.ReadAllTextAsync(path, ct);
                        await using var cmd = new NpgsqlCommand(seedSql, conn);
                        cmd.CommandTimeout = 120;
                        await cmd.ExecuteNonQueryAsync(ct);
                        _logger.LogInformation("Seed script {Path} executed successfully.", path);
                        return;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to run seed script from {Path}, falling back to built-in seed", path);
                    }
                }
            }

            // Fallback: minimal starter records so application runs with full functionality
            var starterSql = $@"
                INSERT INTO contacts (first_name, last_name, email, company, job_title, region, status)
                VALUES ('Alex', 'Rivers', 'alex.rivers@globaltech.com', 'Global Tech Inc', 'VP Technology', '{defaultRegion}', 'Active'),
                       ('Elena', 'Rostova', 'elena.rostova@nexus.eu', 'Nexus Enterprises', 'Director of Operations', 'Europe', 'Active')
                ON CONFLICT DO NOTHING;

                INSERT INTO products (product_name, category, unit_price)
                VALUES ('Enterprise Cloud Suite', 'Software', 125000.00),
                       ('BI Analytics Platform', 'Analytics', 75000.00),
                       ('24/7 Premium Support SLA', 'Services', 25000.00)
                ON CONFLICT DO NOTHING;

                INSERT INTO deals (deal_name, stage, amount, probability, region, expected_close_date)
                VALUES ('{tenantName} - Enterprise Analytics Expansion', 'Negotiation', 185000.00, 80, '{defaultRegion}', CURRENT_DATE + INTERVAL '30 days'),
                       ('{tenantName} - Global Cloud Migration', 'Proposal', 95000.00, 60, 'Europe', CURRENT_DATE + INTERVAL '45 days'),
                       ('{tenantName} - Data Warehouse Upgrade', 'Closed Won', 240000.00, 100, '{defaultRegion}', CURRENT_DATE - INTERVAL '15 days')
                ON CONFLICT DO NOTHING;

                INSERT INTO campaigns (campaign_name, campaign_type, status, budget, actual_cost, region, leads_generated)
                VALUES ('Q3 Enterprise Cloud Summit', 'Webinar', 'Active', 50000.00, 32000.00, '{defaultRegion}', 120),
                       ('Global Partner Roadshow', 'Event', 'Active', 80000.00, 65000.00, 'Europe', 210)
                ON CONFLICT DO NOTHING;

                INSERT INTO support_tickets (ticket_number, subject, priority, status, region)
                VALUES ('TCK-1001', 'API Integration timeout under high load', 'High', 'Open', '{defaultRegion}'),
                       ('TCK-1002', 'Dashboard widget export alignment', 'Medium', 'In Progress', 'Europe')
                ON CONFLICT DO NOTHING;

                INSERT INTO tasks (title, description, priority, status, due_date, region)
                VALUES ('Review Q3 Renewal Contracts', 'Coordinate with sales directors', 'High', 'Pending', CURRENT_DATE + INTERVAL '7 days', '{defaultRegion}'),
                       ('Security Audit Preparation', 'Verify RLS isolation across accounts', 'High', 'Pending', CURRENT_DATE + INTERVAL '14 days', '{defaultRegion}')
                ON CONFLICT DO NOTHING;
            ";

            await using var starterCmd = new NpgsqlCommand(starterSql, conn);
            await starterCmd.ExecuteNonQueryAsync(ct);
            _logger.LogInformation("Starter CRM records inserted for {Tenant}.", tenantName);
        }

        private static string GetSchemaSql()
        {
            return @"
-- 1. Users Table
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

-- 2. Contacts Table
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

-- 3. Products Table
CREATE TABLE IF NOT EXISTS products (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    unit_price NUMERIC(15,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Deals Table
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

-- 5. Deal Products Table
CREATE TABLE IF NOT EXISTS deal_products (
    deal_product_id SERIAL PRIMARY KEY,
    deal_id INT REFERENCES deals(deal_id) ON DELETE CASCADE,
    product_id INT REFERENCES products(product_id) ON DELETE CASCADE,
    quantity INT DEFAULT 1,
    unit_price NUMERIC(15,2),
    discount_pct NUMERIC(5,2) DEFAULT 0,
    total_price NUMERIC(15,2)
);

-- 6. Activities Table
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

-- 7. Invoices Table
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

-- 8. Revenue Summary Table
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

-- 9. Support Tickets Table
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

-- 10. Campaigns Table
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

-- 11. Campaign Contacts Table
CREATE TABLE IF NOT EXISTS campaign_contacts (
    campaign_contact_id SERIAL PRIMARY KEY,
    campaign_id INT REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    contact_id INT REFERENCES contacts(contact_id) ON DELETE CASCADE,
    responded BOOLEAN DEFAULT FALSE,
    response_date DATE,
    CONSTRAINT idx_campaign_contacts_uniq UNIQUE (campaign_id, contact_id)
);

-- 12. Tasks Table
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

-- 13. Audit Log Table
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

-- 14. Email Logs Table
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

-- 15. Custom Reports Table (Multi-Tenant Domain Scoped Reports)
CREATE TABLE IF NOT EXISTS custom_reports (
    id SERIAL PRIMARY KEY,
    report_name VARCHAR(255) NOT NULL,
    server_report_name VARCHAR(255),
    category_name VARCHAR(255) NOT NULL DEFAULT 'Analytics Reports',
    tenant_name VARCHAR(100) NOT NULL,
    tenant_id INT NOT NULL,
    owner_email VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_custom_report UNIQUE (tenant_name, report_name)
);

-- 16. Tenant Schedules Table (Multi-Tenant Domain Scoped Schedules)
CREATE TABLE IF NOT EXISTS tenant_schedules (
    id SERIAL PRIMARY KEY,
    schedule_id VARCHAR(255) NOT NULL,
    schedule_name VARCHAR(255) NOT NULL,
    server_schedule_name VARCHAR(255),
    item_id VARCHAR(255),
    item_name VARCHAR(255),
    item_type VARCHAR(50) NOT NULL DEFAULT 'Report',
    category_name VARCHAR(255),
    tenant_name VARCHAR(100) NOT NULL,
    tenant_id INT NOT NULL,
    owner_email VARCHAR(255) NOT NULL,
    description TEXT,
    export_type VARCHAR(50),
    recurrence_type VARCHAR(50),
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_schedule UNIQUE (tenant_name, schedule_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contacts_region ON contacts(region);
CREATE INDEX IF NOT EXISTS idx_deals_region ON deals(region);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_activities_region ON activities(region);
CREATE INDEX IF NOT EXISTS idx_invoices_region ON invoices(region);
CREATE INDEX IF NOT EXISTS idx_tickets_region ON support_tickets(region);
CREATE INDEX IF NOT EXISTS idx_tasks_region ON tasks(region);
CREATE INDEX IF NOT EXISTS idx_campaigns_region ON campaigns(region);

-- RLS helper function
CREATE OR REPLACE FUNCTION rls_region_check(row_region VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    region_value TEXT;
    is_admin     BOOLEAN;
BEGIN
    region_value := NULLIF(current_setting('app.current_user_region', true), '');
    is_admin := COALESCE(NULLIF(current_setting('app.is_admin', true), '') = 'true', FALSE);

    IF region_value IS NULL OR region_value = '' THEN
        RETURN is_admin;
    END IF;

    IF is_admin THEN
        RETURN TRUE;
    END IF;

    RETURN row_region = region_value;
END;
$$ LANGUAGE plpgsql STABLE;

-- Enable RLS
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
";
        }
    }
}
