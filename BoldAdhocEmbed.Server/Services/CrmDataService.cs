using System.Data;
using Npgsql;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BoldAdhocEmbed.Server.Services
{
    public interface ICrmDataService
    {
        Task<HomeSummaryDto> GetHomeSummaryAsync(AuthUserContext ctx, CancellationToken ct = default);
        Task<List<DealDto>> GetDealsAsync(AuthUserContext ctx, string? stage = null, int page = 1, int pageSize = 50, CancellationToken ct = default);
        Task<List<ContactDto>> GetContactsAsync(AuthUserContext ctx, int page = 1, int pageSize = 50, CancellationToken ct = default);
        Task<List<SupportTicketDto>> GetTicketsAsync(AuthUserContext ctx, int page = 1, int pageSize = 50, CancellationToken ct = default);
        Task<List<CampaignDto>> GetCampaignsAsync(AuthUserContext ctx, int page = 1, int pageSize = 50, CancellationToken ct = default);
        Task<List<AuditLogDto>> GetAuditLogsAsync(AuthUserContext ctx, int page = 1, int pageSize = 50, CancellationToken ct = default);
        Task EnsureCustomReportsTableAsync(AuthUserContext ctx, CancellationToken ct = default);
        Task RegisterCustomReportAsync(AuthUserContext ctx, string reportName, string? description, string? category = "Analytics Reports", string? serverReportName = null, CancellationToken ct = default);
        Task<List<CustomReportDto>> GetCustomReportsAsync(AuthUserContext ctx, CancellationToken ct = default);
        Task<bool> DeleteCustomReportAsync(AuthUserContext ctx, string reportName, CancellationToken ct = default);

        Task EnsureTenantSchedulesTableAsync(AuthUserContext ctx, CancellationToken ct = default);
        Task RegisterTenantScheduleAsync(AuthUserContext ctx, string scheduleId, string scheduleName, string? serverScheduleName, string? itemId, string? itemName, string? itemType, string? categoryName, string? description, string? exportType, string? recurrenceType, bool isEnabled, CancellationToken ct = default);
        Task<List<TenantScheduleDto>> GetTenantSchedulesAsync(AuthUserContext ctx, CancellationToken ct = default);
        Task<bool> DeleteTenantScheduleAsync(AuthUserContext ctx, string scheduleIdOrName, CancellationToken ct = default);
    }

    public class TenantScheduleDto
    {
        public int Id { get; set; }
        public string ScheduleId { get; set; } = string.Empty;
        public string ScheduleName { get; set; } = string.Empty;
        public string? ServerScheduleName { get; set; }
        public string? ItemId { get; set; }
        public string? ItemName { get; set; }
        public string ItemType { get; set; } = "Report";
        public string? CategoryName { get; set; }
        public string TenantName { get; set; } = string.Empty;
        public int TenantId { get; set; }
        public string OwnerEmail { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? ExportType { get; set; }
        public string? RecurrenceType { get; set; }
        public bool IsEnabled { get; set; } = true;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class CustomReportDto
    {
        public int Id { get; set; }
        public string ReportName { get; set; } = string.Empty;
        public string ServerReportName { get; set; } = string.Empty;
        public string CategoryName { get; set; } = "Analytics Reports";
        public string TenantName { get; set; } = string.Empty;
        public int TenantId { get; set; }
        public string OwnerEmail { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class HomeSummaryDto
    {
        public string TenantName { get; set; } = string.Empty;
        public string UserRole { get; set; } = string.Empty;
        public string UserRegion { get; set; } = string.Empty;
        public decimal TotalActivePipeline { get; set; }
        public int TotalDealsCount { get; set; }
        public int WonDealsCount { get; set; }
        public int TotalContactsCount { get; set; }
        public int TotalTicketsCount { get; set; }
        public int OpenTicketsCount { get; set; }
        public decimal CsatScore { get; set; }
        public int ActiveCampaignsCount { get; set; }
        public decimal TotalRevenue { get; set; }
        public List<TaskItemDto> Tasks { get; set; } = new();
        public List<PinnedAccountDto> PinnedAccounts { get; set; } = new();
        public List<AuditLogDto> RecentAnnouncements { get; set; } = new();
    }

    public class TaskItemDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Time { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public bool Completed { get; set; }
    }

    public class PinnedAccountDto
    {
        public string Title { get; set; } = string.Empty;
        public string Subtitle { get; set; } = string.Empty;
        public string Icon { get; set; } = "corporate_fare";
        public string Link { get; set; } = "/contacts";
    }

    public class DealDto
    {
        public int DealId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string CompanyName { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string Stage { get; set; } = string.Empty;
        public int Probability { get; set; }
        public string ExpectedCloseDate { get; set; } = string.Empty;
        public string Region { get; set; } = string.Empty;
        public string OwnerEmail { get; set; } = string.Empty;
    }

    public class ContactDto
    {
        public int ContactId { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string FullName => $"{FirstName} {LastName}".Trim();
        public string Email { get; set; } = string.Empty;
        public string CompanyName { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Region { get; set; } = string.Empty;
        public string LeadScore { get; set; } = string.Empty;
        public string CustomerTier { get; set; } = string.Empty;
    }

    public class SupportTicketDto
    {
        public int TicketId { get; set; }
        public string TicketNumber { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string CompanyName { get; set; } = string.Empty;
        public string Region { get; set; } = string.Empty;
        public string SlaDue { get; set; } = string.Empty;
        public decimal? SatisfactionRating { get; set; }
    }

    public class CampaignDto
    {
        public int CampaignId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public decimal Budget { get; set; }
        public decimal ActualCost { get; set; }
        public decimal ExpectedRevenue { get; set; }
        public int LeadsGenerated { get; set; }
        public string Region { get; set; } = string.Empty;
    }

    public class AuditLogDto
    {
        public int LogId { get; set; }
        public string Action { get; set; } = string.Empty;
        public string EntityType { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Severity { get; set; } = "Low";
        public string CreatedAt { get; set; } = string.Empty;
    }

    public class CrmDataService : ICrmDataService
    {
        private readonly IConfiguration _config;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<CrmDataService> _logger;

        public CrmDataService(
            IConfiguration config,
            IWebHostEnvironment env,
            ILogger<CrmDataService> logger)
        {
            _config = config;
            _env = env;
            _logger = logger;
        }

        private string? ResolveDatabaseName(string tenantName)
        {
            if (string.IsNullOrWhiteSpace(tenantName)) return null;
            return _config.GetSection("TenantMappings")
                          .GetSection(tenantName)
                          .GetValue<string>("Database");
        }

        private string? ResolveRegion(string tenantName)
        {
            if (string.IsNullOrWhiteSpace(tenantName)) return null;
            return _config.GetSection("TenantMappings")
                          .GetSection(tenantName)
                          .GetValue<string>("Region");
        }

        private string GetConnectionString(string tenantName)
        {
            var dbName = ResolveDatabaseName(tenantName)
                ?? throw new InvalidOperationException(
                    $"Unknown tenant '{tenantName}'. Add it to TenantMappings configuration.");

            var host = Environment.GetEnvironmentVariable("POSTGRES_HOST")
                       ?? _config["Postgres:Host"]
                       ?? "postgres";
            var port = Environment.GetEnvironmentVariable("POSTGRES_PORT")
                       ?? _config["Postgres:Port"]
                       ?? "5432";
            var user = Environment.GetEnvironmentVariable("POSTGRES_USER")
                       ?? _config["Postgres:User"]
                       ?? "postgres";
            // Password intentionally has NO compile-time default. The dev
            // appsettings file pointed at "Password123!" for years, which
            // made the application's connection string identical to the
            // default Postgres Docker image — and symmetric with the
            // committed appsettings prod compose.
            var password = Environment.GetEnvironmentVariable("POSTGRES_PASSWORD")
                           ?? _config["Postgres:Password"]
                           ?? throw new InvalidOperationException(
                               "Postgres password is unset. Set POSTGRES_PASSWORD env var or Postgres:Password via user-secrets.");

            return $"Host={host};Port={port};Database={dbName};Username={user};Password={password};Timeout=5;CommandTimeout=10;";
        }

        private static readonly HashSet<string> ValidRoles = new(StringComparer.OrdinalIgnoreCase)
        {
            "Admin", "Manager", "User", "Viewer", "ReadOnly", "Sales", "Finance", "Support", "Operations"
        };

        private async Task<NpgsqlConnection> CreateOpenConnectionAsync(
            AuthUserContext ctx,
            CancellationToken ct = default)
        {
            // ===== Fail-closed validation up-front =====
            if (string.IsNullOrWhiteSpace(ctx.Email))
                throw new ArgumentException("User email is required for RLS context", nameof(ctx));
            if (string.IsNullOrWhiteSpace(ctx.Role) || !ValidRoles.Contains(ctx.Role))
                throw new ArgumentException(
                    $"Invalid role '{ctx.Role}' for RLS. Must be one of: {string.Join(", ", ValidRoles)}",
                    nameof(ctx));
            if (string.IsNullOrWhiteSpace(ctx.Region))
                throw new ArgumentException("User region is required for RLS context", nameof(ctx));
            if (string.IsNullOrWhiteSpace(ctx.TenantName))
                throw new ArgumentException("User tenant is required for RLS context", nameof(ctx));

            var connStr = GetConnectionString(ctx.TenantName);

            NpgsqlConnection conn;
            try
            {
                conn = new NpgsqlConnection(connStr);
                await conn.OpenAsync(ct);
            }
            catch (Exception ex) when (_env.IsDevelopment())
            {
                _logger.LogWarning(ex,
                    "Primary PostgreSQL connection failed for tenant {Tenant}, trying localhost fallback",
                    ctx.TenantName);
                // In local dev outside docker, fallback to localhost:5434 only
                // when explicitly opted in. The 'Postgres:FallbackHost' env
                // var must be set, otherwise we'd silently swallow outages.
                var fallbackHost = Environment.GetEnvironmentVariable("POSTGRES_FALLBACK_HOST");
                if (string.IsNullOrWhiteSpace(fallbackHost)) throw;
                var fallbackConnStr = connStr.Replace($"Host={connStr.Split(';').First(s => s.StartsWith("Host=")).Substring(5)}", $"Host={fallbackHost}");
                conn = new NpgsqlConnection(fallbackConnStr);
                await conn.OpenAsync(ct);
            }

            // RLS variables MUST match the names consumed by the SQL policy
            // helper (rls_region_check). The previous code used the
            // inconsistent name 'app.current_region' which made every policy
            // return 'true' (fail-open). Now we use 'app.current_user_region'
            // for the per-row predicate and add 'app.is_admin' so admins can
            // bypass row restrictions without leaking the secret in client
            // headers.
            var isAdmin = IsAdminRole(ctx.Role);
            await using var rlsCmd = new NpgsqlCommand(@"
                SELECT set_config('app.current_user_id', @userId, false),
                       set_config('app.current_user_role', @userRole, false),
                       set_config('app.current_user_region', @userRegion, false),
                       set_config('app.is_admin', @isAdmin, false);", conn);
            rlsCmd.Parameters.AddWithValue("userId", ctx.Email);
            rlsCmd.Parameters.AddWithValue("userRole", ctx.Role);
            rlsCmd.Parameters.AddWithValue("userRegion", ctx.Region);
            rlsCmd.Parameters.AddWithValue("isAdmin", isAdmin ? "true" : "false");
            await rlsCmd.ExecuteNonQueryAsync(ct);

            _logger.LogDebug("RLS context set for {Email} (role={Role}, region={Region}, tenant={Tenant}, admin={IsAdmin})",
                ctx.Email, ctx.Role, ctx.Region, ctx.TenantName, isAdmin);

            return conn;
        }

        private bool IsAdminRole(string role)
        {
            if (string.IsNullOrWhiteSpace(role)) return false;
            var admins = _config.GetSection("AdminRoles").Get<string[]>()
                         ?? new[] { "Admin", "Administrator" };
            return admins.Any(a => string.Equals(a, role, StringComparison.OrdinalIgnoreCase));
        }

        public async Task<HomeSummaryDto> GetHomeSummaryAsync(AuthUserContext ctx, CancellationToken ct = default)
        {
            var summary = new HomeSummaryDto
            {
                TenantName = ctx.TenantName,
                UserRole = ctx.Role,
                UserRegion = ctx.Region
            };

            try
            {
                ct.ThrowIfCancellationRequested();
                await using var conn = await CreateOpenConnectionAsync(ctx, ct);

                // 1. Deals Aggregates
                await using (var cmd = new NpgsqlCommand(@"
                    SELECT 
                        COALESCE(SUM(amount), 0) as total_pipeline,
                        COUNT(*)::int as deals_count,
                        COUNT(*) FILTER (WHERE stage = 'Closed Won')::int as won_count
                    FROM deals;", conn))
                await using (var reader = await cmd.ExecuteReaderAsync())
                {
                    if (await reader.ReadAsync())
                    {
                        summary.TotalActivePipeline = reader.GetDecimal(0);
                        summary.TotalDealsCount = reader.GetInt32(1);
                        summary.WonDealsCount = reader.GetInt32(2);
                    }
                }

                // 2. Contacts Count
                await using (var cmd = new NpgsqlCommand("SELECT COUNT(*) FROM contacts;", conn))
                {
                    var countObj = await cmd.ExecuteScalarAsync();
                    summary.TotalContactsCount = Convert.ToInt32(countObj ?? 0);
                }

                // 3. Support Tickets Aggregates
                await using (var cmd = new NpgsqlCommand(@"
                    SELECT 
                        COUNT(*)::int as total_tickets,
                        COUNT(*) FILTER (WHERE status IN ('Open', 'In Progress', 'Escalated'))::int as open_tickets,
                        COALESCE(AVG(satisfaction_score), 4.8) as avg_csat
                    FROM support_tickets;", conn))
                await using (var reader = await cmd.ExecuteReaderAsync())
                {
                    if (await reader.ReadAsync())
                    {
                        summary.TotalTicketsCount = reader.GetInt32(0);
                        summary.OpenTicketsCount = reader.GetInt32(1);
                        summary.CsatScore = Math.Round(reader.GetDecimal(2), 2);
                    }
                }

                // 4. Active Campaigns Count
                await using (var cmd = new NpgsqlCommand("SELECT COUNT(*) FROM campaigns WHERE status = 'Active';", conn))
                {
                    var countObj = await cmd.ExecuteScalarAsync();
                    summary.ActiveCampaignsCount = Convert.ToInt32(countObj ?? 0);
                }

                // 5. Total Invoiced Revenue
                await using (var cmd = new NpgsqlCommand("SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE status IN ('Paid', 'Sent');", conn))
                {
                    var revObj = await cmd.ExecuteScalarAsync();
                    summary.TotalRevenue = Convert.ToDecimal(revObj ?? 0);
                }

                // 6. User Tasks
                await using (var cmd = new NpgsqlCommand(@"
                    SELECT task_id, title, due_date, priority, status
                    FROM tasks
                    ORDER BY due_date ASC
                    LIMIT 4;", conn))
                await using (var reader = await cmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        var dueDate = reader.IsDBNull(2) ? DateTime.UtcNow : reader.GetDateTime(2);
                        summary.Tasks.Add(new TaskItemDto
                        {
                            Id = reader.GetInt32(0),
                            Title = reader.GetString(1),
                            Time = dueDate.ToString("hh:mm tt"),
                            Role = ctx.Role,
                            Priority = reader.IsDBNull(3) ? "Medium" : reader.GetString(3),
                            Completed = reader.GetString(4) == "Completed"
                        });
                    }
                }

                // 7. Pinned Accounts from Enterprise Contacts
                await using (var cmd = new NpgsqlCommand(@"
                    SELECT DISTINCT company, lead_source, status
                    FROM contacts
                    WHERE company IS NOT NULL AND company != ''
                    ORDER BY company ASC
                    LIMIT 3;", conn))
                await using (var reader = await cmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        var company = reader.GetString(0);
                        var source = reader.IsDBNull(1) ? "Enterprise" : reader.GetString(1);
                        var status = reader.IsDBNull(2) ? "Key Account" : reader.GetString(2);
                        summary.PinnedAccounts.Add(new PinnedAccountDto
                        {
                            Title = company,
                            Subtitle = $"{status} • {source}",
                            Icon = "corporate_fare",
                            Link = "/contacts"
                        });
                    }
                }

                // 8. Recent Audit Logs as Announcements
                await using (var cmd = new NpgsqlCommand(@"
                    SELECT log_id, action, table_name, COALESCE(details::text, '{}'), region, performed_at
                    FROM audit_log
                    ORDER BY performed_at DESC
                    LIMIT 3;", conn))
                await using (var reader = await cmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        var performedAt = reader.GetDateTime(5);
                        summary.RecentAnnouncements.Add(new AuditLogDto
                        {
                            LogId = reader.GetInt32(0),
                            Action = reader.GetString(1),
                            EntityType = reader.GetString(2),
                            Description = reader.GetString(3),
                            Severity = reader.IsDBNull(4) ? "Info" : reader.GetString(4),
                            CreatedAt = FormatRelativeTime(performedAt)
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error executing PostgreSQL query for tenant {Tenant}", ctx.TenantName);
            }

            return summary;
        }

        public async Task<List<DealDto>> GetDealsAsync(AuthUserContext ctx, string? stage = null, int page = 1, int pageSize = 50, CancellationToken ct = default)
        {
            var list = new List<DealDto>();
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 200);
            try
            {
                ct.ThrowIfCancellationRequested();
                await using var conn = await CreateOpenConnectionAsync(ctx, ct);
                var query = @"
                    SELECT d.deal_id, d.deal_name, COALESCE(c.company, 'Enterprise Client'), d.amount, d.stage, d.probability, d.expected_close_date, d.region, d.owner_email
                    FROM deals d
                    LEFT JOIN contacts c ON d.contact_id = c.contact_id
                    WHERE (@stage IS NULL OR d.stage = @stage)
                    ORDER BY d.amount DESC
                    LIMIT @pageSize OFFSET @offset;";
                var cmd = new NpgsqlCommand(query, conn);
                cmd.Parameters.Add(new NpgsqlParameter("stage", NpgsqlTypes.NpgsqlDbType.Varchar) { Value = (object?)stage ?? DBNull.Value });
                cmd.Parameters.AddWithValue("pageSize", pageSize);
                cmd.Parameters.AddWithValue("offset", (page - 1) * pageSize);

                await using var reader = await cmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync())
                {
                    list.Add(new DealDto
                    {
                        DealId = reader.GetInt32(0),
                        Title = reader.GetString(1),
                        CompanyName = reader.IsDBNull(2) ? "Enterprise Client" : reader.GetString(2),
                        Amount = reader.GetDecimal(3),
                        Stage = reader.GetString(4),
                        Probability = reader.GetInt32(5),
                        ExpectedCloseDate = reader.IsDBNull(6) ? "" : reader.GetDateTime(6).ToString("yyyy-MM-dd"),
                        Region = reader.IsDBNull(7) ? ctx.Region : reader.GetString(7),
                        OwnerEmail = reader.IsDBNull(8) ? "" : reader.GetString(8)
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting deals from PostgreSQL for {Tenant}", ctx.TenantName);
            }
            return list;
        }

        public async Task<List<ContactDto>> GetContactsAsync(AuthUserContext ctx, int page = 1, int pageSize = 50, CancellationToken ct = default)
        {
            var list = new List<ContactDto>();
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 200);
            try
            {
                ct.ThrowIfCancellationRequested();
                await using var conn = await CreateOpenConnectionAsync(ctx, ct);
                var query = @"
                    SELECT contact_id, first_name, last_name, email, company, job_title, region, lead_source, status
                    FROM contacts
                    ORDER BY contact_id ASC
                    LIMIT @pageSize OFFSET @offset;";

                await using var cmd = new NpgsqlCommand(query, conn);
                cmd.Parameters.AddWithValue("pageSize", pageSize);
                cmd.Parameters.AddWithValue("offset", (page - 1) * pageSize);
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    list.Add(new ContactDto
                    {
                        ContactId = reader.GetInt32(0),
                        FirstName = reader.GetString(1),
                        LastName = reader.GetString(2),
                        Email = reader.IsDBNull(3) ? "" : reader.GetString(3),
                        CompanyName = reader.IsDBNull(4) ? "" : reader.GetString(4),
                        Title = reader.IsDBNull(5) ? "" : reader.GetString(5),
                        Region = reader.IsDBNull(6) ? ctx.Region : reader.GetString(6),
                        LeadScore = reader.IsDBNull(7) ? "Direct" : reader.GetString(7),
                        CustomerTier = reader.IsDBNull(8) ? "Active" : reader.GetString(8)
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting contacts from PostgreSQL for {Tenant}", ctx.TenantName);
            }
            return list;
        }

        public async Task<List<SupportTicketDto>> GetTicketsAsync(AuthUserContext ctx, int page = 1, int pageSize = 50, CancellationToken ct = default)
        {
            var list = new List<SupportTicketDto>();
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 200);
            try
            {
                ct.ThrowIfCancellationRequested();
                await using var conn = await CreateOpenConnectionAsync(ctx, ct);
                var query = @"
                    SELECT t.ticket_id, t.ticket_number, t.subject, t.priority, t.status, COALESCE(c.company, ''), t.region, t.created_at, t.satisfaction_score
                    FROM support_tickets t
                    LEFT JOIN contacts c ON t.contact_id = c.contact_id
                    ORDER BY t.ticket_id DESC
                    LIMIT @pageSize OFFSET @offset;";

                await using var cmd = new NpgsqlCommand(query, conn);
                cmd.Parameters.AddWithValue("pageSize", pageSize);
                cmd.Parameters.AddWithValue("offset", (page - 1) * pageSize);
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    list.Add(new SupportTicketDto
                    {
                        TicketId = reader.GetInt32(0),
                        TicketNumber = reader.GetString(1),
                        Subject = reader.GetString(2),
                        Priority = reader.GetString(3),
                        Status = reader.GetString(4),
                        CompanyName = reader.IsDBNull(5) ? "" : reader.GetString(5),
                        Region = reader.IsDBNull(6) ? ctx.Region : reader.GetString(6),
                        SlaDue = reader.IsDBNull(7) ? "" : reader.GetDateTime(7).ToString("MMM dd, hh:mm tt"),
                        SatisfactionRating = reader.IsDBNull(8) ? null : (decimal?)reader.GetInt32(8)
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting tickets from PostgreSQL for {Tenant}", ctx.TenantName);
            }
            return list;
        }

        public async Task<List<CampaignDto>> GetCampaignsAsync(AuthUserContext ctx, int page = 1, int pageSize = 50, CancellationToken ct = default)
        {
            var list = new List<CampaignDto>();
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 200);
            try
            {
                ct.ThrowIfCancellationRequested();
                await using var conn = await CreateOpenConnectionAsync(ctx, ct);
                var query = @"
                    SELECT campaign_id, campaign_name, campaign_type, status, COALESCE(budget, 0), COALESCE(actual_cost, 0), COALESCE(budget, 0), leads_generated, region
                    FROM campaigns
                    ORDER BY campaign_id DESC
                    LIMIT @pageSize OFFSET @offset;";

                await using var cmd = new NpgsqlCommand(query, conn);
                cmd.Parameters.AddWithValue("pageSize", pageSize);
                cmd.Parameters.AddWithValue("offset", (page - 1) * pageSize);
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    list.Add(new CampaignDto
                    {
                        CampaignId = reader.GetInt32(0),
                        Name = reader.GetString(1),
                        Type = reader.IsDBNull(2) ? "Email" : reader.GetString(2),
                        Status = reader.GetString(3),
                        Budget = reader.GetDecimal(4),
                        ActualCost = reader.GetDecimal(5),
                        ExpectedRevenue = reader.GetDecimal(6),
                        LeadsGenerated = reader.GetInt32(7),
                        Region = reader.IsDBNull(8) ? ctx.Region : reader.GetString(8)
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting campaigns from PostgreSQL for {Tenant}", ctx.TenantName);
            }
            return list;
        }

        public async Task<List<AuditLogDto>> GetAuditLogsAsync(AuthUserContext ctx, int page = 1, int pageSize = 50, CancellationToken ct = default)
        {
            var list = new List<AuditLogDto>();
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 200);
            try
            {
                ct.ThrowIfCancellationRequested();
                await using var conn = await CreateOpenConnectionAsync(ctx, ct);
                var query = @"
                    SELECT log_id, action, table_name, COALESCE(details::text, '{}'), COALESCE(region, 'Info'), performed_at
                    FROM audit_log
                    ORDER BY performed_at DESC
                    LIMIT @pageSize OFFSET @offset;";

                await using var cmd = new NpgsqlCommand(query, conn);
                cmd.Parameters.AddWithValue("pageSize", pageSize);
                cmd.Parameters.AddWithValue("offset", (page - 1) * pageSize);
                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    list.Add(new AuditLogDto
                    {
                        LogId = reader.GetInt32(0),
                        Action = reader.GetString(1),
                        EntityType = reader.GetString(2),
                        Description = reader.GetString(3),
                        Severity = reader.IsDBNull(4) ? "Info" : reader.GetString(4),
                        CreatedAt = FormatRelativeTime(reader.GetDateTime(5))
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting audit logs from PostgreSQL for {Tenant}", ctx.TenantName);
            }
            return list;
        }

        private static string FormatRelativeTime(DateTime dateTime)
        {
            var diff = DateTime.UtcNow - dateTime.ToUniversalTime();
            if (diff.TotalMinutes < 1) return "Just now";
            if (diff.TotalMinutes < 60) return $"{(int)diff.TotalMinutes} mins ago";
            if (diff.TotalHours < 24) return $"{(int)diff.TotalHours} hours ago";
            if (diff.TotalDays < 7) return $"{(int)diff.TotalDays} days ago";
            return dateTime.ToString("MMM dd");
        }

        public async Task EnsureCustomReportsTableAsync(AuthUserContext ctx, CancellationToken ct = default)
        {
            try
            {
                await using var conn = await CreateOpenConnectionAsync(ctx, ct);
                const string sql = @"
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
                    ALTER TABLE custom_reports ADD COLUMN IF NOT EXISTS server_report_name VARCHAR(255);";
                await using var cmd = new NpgsqlCommand(sql, conn);
                await cmd.ExecuteNonQueryAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ensuring custom_reports table for {Tenant}", ctx.TenantName);
            }
        }

        public async Task RegisterCustomReportAsync(AuthUserContext ctx, string reportName, string? description, string? category = "Analytics Reports", string? serverReportName = null, CancellationToken ct = default)
        {
            try
            {
                await EnsureCustomReportsTableAsync(ctx, ct);
                await using var conn = await CreateOpenConnectionAsync(ctx, ct);
                var finalServerName = string.IsNullOrWhiteSpace(serverReportName) ? $"{ctx.TenantName}_{reportName.Trim()}" : serverReportName.Trim();
                const string sql = @"
                    INSERT INTO custom_reports (report_name, server_report_name, category_name, tenant_name, tenant_id, owner_email, description, updated_at)
                    VALUES (@reportName, @serverReportName, @categoryName, @tenantName, @tenantId, @ownerEmail, @description, CURRENT_TIMESTAMP)
                    ON CONFLICT (tenant_name, report_name)
                    DO UPDATE SET
                        server_report_name = EXCLUDED.server_report_name,
                        description = EXCLUDED.description,
                        category_name = EXCLUDED.category_name,
                        updated_at = CURRENT_TIMESTAMP;";

                await using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("reportName", reportName.Trim());
                cmd.Parameters.AddWithValue("serverReportName", finalServerName);
                cmd.Parameters.AddWithValue("categoryName", string.IsNullOrWhiteSpace(category) ? "Analytics Reports" : category.Trim());
                cmd.Parameters.AddWithValue("tenantName", ctx.TenantName);
                cmd.Parameters.AddWithValue("tenantId", ctx.TenantId);
                cmd.Parameters.AddWithValue("ownerEmail", ctx.Email);
                cmd.Parameters.AddWithValue("description", (object?)description ?? DBNull.Value);
                await cmd.ExecuteNonQueryAsync(ct);
                _logger.LogInformation("Custom report {ReportName} (server: {ServerName}) registered for tenant {Tenant}", reportName, finalServerName, ctx.TenantName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error registering custom report {ReportName} for {Tenant}", reportName, ctx.TenantName);
            }
        }

        public async Task<List<CustomReportDto>> GetCustomReportsAsync(AuthUserContext ctx, CancellationToken ct = default)
        {
            var list = new List<CustomReportDto>();
            try
            {
                await EnsureCustomReportsTableAsync(ctx, ct);
                await using var conn = await CreateOpenConnectionAsync(ctx, ct);
                const string sql = @"
                    SELECT id, report_name, category_name, tenant_name, tenant_id, owner_email, description, created_at, COALESCE(server_report_name, report_name)
                    FROM custom_reports
                    WHERE tenant_name = @tenantName
                    ORDER BY created_at DESC;";

                await using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("tenantName", ctx.TenantName);
                await using var reader = await cmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct))
                {
                    list.Add(new CustomReportDto
                    {
                        Id = reader.GetInt32(0),
                        ReportName = reader.GetString(1),
                        CategoryName = reader.GetString(2),
                        TenantName = reader.GetString(3),
                        TenantId = reader.GetInt32(4),
                        OwnerEmail = reader.GetString(5),
                        Description = reader.IsDBNull(6) ? null : reader.GetString(6),
                        CreatedAt = reader.GetDateTime(7),
                        ServerReportName = reader.GetString(8)
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching custom reports from PostgreSQL for {Tenant}", ctx.TenantName);
            }
            return list;
        }

        public async Task<bool> DeleteCustomReportAsync(AuthUserContext ctx, string reportName, CancellationToken ct = default)
        {
            try
            {
                await using var conn = await CreateOpenConnectionAsync(ctx, ct);
                const string sql = @"
                    DELETE FROM custom_reports
                    WHERE tenant_name = @tenantName AND report_name = @reportName;";

                await using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("tenantName", ctx.TenantName);
                cmd.Parameters.AddWithValue("reportName", reportName.Trim());
                var affected = await cmd.ExecuteNonQueryAsync(ct);
                return affected > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting custom report {ReportName} for {Tenant}", reportName, ctx.TenantName);
                return false;
            }
        }

        public async Task EnsureTenantSchedulesTableAsync(AuthUserContext ctx, CancellationToken ct = default)
        {
            try
            {
                await using var conn = await CreateOpenConnectionAsync(ctx, ct);
                const string sql = @"
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
                await using var cmd = new NpgsqlCommand(sql, conn);
                await cmd.ExecuteNonQueryAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ensuring tenant_schedules table for {Tenant}", ctx.TenantName);
            }
        }

        public async Task RegisterTenantScheduleAsync(AuthUserContext ctx, string scheduleId, string scheduleName, string? serverScheduleName, string? itemId, string? itemName, string? itemType, string? categoryName, string? description, string? exportType, string? recurrenceType, bool isEnabled, CancellationToken ct = default)
        {
            try
            {
                await EnsureTenantSchedulesTableAsync(ctx, ct);
                await using var conn = await CreateOpenConnectionAsync(ctx, ct);
                var finalServerName = string.IsNullOrWhiteSpace(serverScheduleName) ? $"{ctx.TenantName}_{scheduleName.Trim()}" : serverScheduleName.Trim();
                const string sql = @"
                    INSERT INTO tenant_schedules (schedule_id, schedule_name, server_schedule_name, item_id, item_name, item_type, category_name, tenant_name, tenant_id, owner_email, description, export_type, recurrence_type, is_enabled, updated_at)
                    VALUES (@scheduleId, @scheduleName, @serverScheduleName, @itemId, @itemName, @itemType, @categoryName, @tenantName, @tenantId, @ownerEmail, @description, @exportType, @recurrenceType, @isEnabled, CURRENT_TIMESTAMP)
                    ON CONFLICT (tenant_name, schedule_name)
                    DO UPDATE SET
                        schedule_id = EXCLUDED.schedule_id,
                        server_schedule_name = EXCLUDED.server_schedule_name,
                        item_id = EXCLUDED.item_id,
                        item_name = EXCLUDED.item_name,
                        item_type = EXCLUDED.item_type,
                        category_name = EXCLUDED.category_name,
                        description = EXCLUDED.description,
                        export_type = EXCLUDED.export_type,
                        recurrence_type = EXCLUDED.recurrence_type,
                        is_enabled = EXCLUDED.is_enabled,
                        updated_at = CURRENT_TIMESTAMP;";

                await using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("scheduleId", scheduleId.Trim());
                cmd.Parameters.AddWithValue("scheduleName", scheduleName.Trim());
                cmd.Parameters.AddWithValue("serverScheduleName", finalServerName);
                cmd.Parameters.AddWithValue("itemId", (object?)itemId ?? DBNull.Value);
                cmd.Parameters.AddWithValue("itemName", (object?)itemName ?? DBNull.Value);
                cmd.Parameters.AddWithValue("itemType", string.IsNullOrWhiteSpace(itemType) ? "Report" : itemType.Trim());
                cmd.Parameters.AddWithValue("categoryName", (object?)categoryName ?? DBNull.Value);
                cmd.Parameters.AddWithValue("tenantName", ctx.TenantName);
                cmd.Parameters.AddWithValue("tenantId", ctx.TenantId);
                cmd.Parameters.AddWithValue("ownerEmail", ctx.Email);
                cmd.Parameters.AddWithValue("description", (object?)description ?? DBNull.Value);
                cmd.Parameters.AddWithValue("exportType", (object?)exportType ?? DBNull.Value);
                cmd.Parameters.AddWithValue("recurrenceType", (object?)recurrenceType ?? DBNull.Value);
                cmd.Parameters.AddWithValue("isEnabled", isEnabled);
                await cmd.ExecuteNonQueryAsync(ct);
                _logger.LogInformation("Tenant schedule {ScheduleName} (server: {ServerName}) registered for tenant {Tenant}", scheduleName, finalServerName, ctx.TenantName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error registering tenant schedule {ScheduleName} for {Tenant}", scheduleName, ctx.TenantName);
            }
        }

        public async Task<List<TenantScheduleDto>> GetTenantSchedulesAsync(AuthUserContext ctx, CancellationToken ct = default)
        {
            var list = new List<TenantScheduleDto>();
            try
            {
                await EnsureTenantSchedulesTableAsync(ctx, ct);
                await using var conn = await CreateOpenConnectionAsync(ctx, ct);
                const string sql = @"
                    SELECT id, schedule_id, schedule_name, server_schedule_name, item_id, item_name, item_type, category_name, tenant_name, tenant_id, owner_email, description, export_type, recurrence_type, is_enabled, created_at, updated_at
                    FROM tenant_schedules
                    WHERE tenant_name = @tenantName
                    ORDER BY created_at DESC;";

                await using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("tenantName", ctx.TenantName);
                await using var reader = await cmd.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct))
                {
                    list.Add(new TenantScheduleDto
                    {
                        Id = reader.GetInt32(0),
                        ScheduleId = reader.GetString(1),
                        ScheduleName = reader.GetString(2),
                        ServerScheduleName = reader.IsDBNull(3) ? null : reader.GetString(3),
                        ItemId = reader.IsDBNull(4) ? null : reader.GetString(4),
                        ItemName = reader.IsDBNull(5) ? null : reader.GetString(5),
                        ItemType = reader.GetString(6),
                        CategoryName = reader.IsDBNull(7) ? null : reader.GetString(7),
                        TenantName = reader.GetString(8),
                        TenantId = reader.GetInt32(9),
                        OwnerEmail = reader.GetString(10),
                        Description = reader.IsDBNull(11) ? null : reader.GetString(11),
                        ExportType = reader.IsDBNull(12) ? null : reader.GetString(12),
                        RecurrenceType = reader.IsDBNull(13) ? null : reader.GetString(13),
                        IsEnabled = reader.GetBoolean(14),
                        CreatedAt = reader.GetDateTime(15),
                        UpdatedAt = reader.GetDateTime(16)
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching tenant schedules from PostgreSQL for {Tenant}", ctx.TenantName);
            }
            return list;
        }

        public async Task<bool> DeleteTenantScheduleAsync(AuthUserContext ctx, string scheduleIdOrName, CancellationToken ct = default)
        {
            try
            {
                await using var conn = await CreateOpenConnectionAsync(ctx, ct);
                const string sql = @"
                    DELETE FROM tenant_schedules
                    WHERE tenant_name = @tenantName AND (schedule_id = @idOrName OR schedule_name = @idOrName OR server_schedule_name = @idOrName);";

                await using var cmd = new NpgsqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("tenantName", ctx.TenantName);
                cmd.Parameters.AddWithValue("idOrName", scheduleIdOrName.Trim());
                var affected = await cmd.ExecuteNonQueryAsync(ct);
                return affected > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting tenant schedule {ScheduleIdOrName} for {Tenant}", scheduleIdOrName, ctx.TenantName);
                return false;
            }
        }
    }
}
