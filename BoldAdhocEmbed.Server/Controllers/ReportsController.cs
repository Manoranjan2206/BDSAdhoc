using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using BoldAdhocEmbed.Server.Services;
using BoldAdhocEmbed.Server.Models;
using BoldAdhocEmbed.Server.Validators;

namespace BoldAdhocEmbed.Server.Controllers
{
    /// <summary>
    /// Reports API endpoints for retrieving and managing reports.
    /// All operations respect user permissions through RLS enforced by
    /// Bold Reports; identity is derived from validated JWT claims.
    /// </summary>
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class ReportsController : BaseController
    {
        private readonly IBoldReportsService _boldReportsService;
        private readonly BoldReportsSettings _settings;
        private readonly ICacheService _cacheService;
        private readonly IAuthenticatedUser _auth;
        private readonly ICrmDataService _crmDataService;

        private static readonly HashSet<string> StandardReportNames = new(StringComparer.OrdinalIgnoreCase)
        {
            "Product Sales Breakdown",
            "Deal Products Pipeline Analysis Report",
            "Sales Reps Performance Report",
            "Campaign Performance Report",
            "Monthly Revenue Report",
            "Audit Trail Report",
            "Contact Details Report"
        };

        public ReportsController(
            IBoldReportsService boldReportsService,
            ILogger<ReportsController> logger,
            BoldReportsSettings settings,
            ICacheService cacheService,
            IAuthenticatedUser auth,
            ICrmDataService crmDataService)
            : base(logger)
        {
            _boldReportsService = boldReportsService ?? throw new ArgumentNullException(nameof(boldReportsService));
            _settings = settings ?? throw new ArgumentNullException(nameof(settings));
            _cacheService = cacheService ?? throw new ArgumentNullException(nameof(cacheService));
            _auth = auth ?? throw new ArgumentNullException(nameof(auth));
            _crmDataService = crmDataService ?? throw new ArgumentNullException(nameof(crmDataService));
        }

        /// <summary>
        /// Get Bold Reports viewer settings with authentication token
        /// Includes service URLs and configuration for embedding reports
        /// </summary>
        /// <returns>Viewer settings with token and URLs</returns>
        [HttpGet("viewer-settings")]
        public async Task<IActionResult> GetViewerSettings()
        {
            try
            {
                // The widget consumes the embed_token different from the
                // server-side API access token used by /items, /users, etc.
                //   - embed_token  : minted via the embed_token JSON grant
                //                    flow; sent verbatim as "embedToken" to
                //                    boldReportViewer({ embedToken })
                //   - api token    : minted via password grant; sent as
                //                    "Authorization: Bearer <jwt>" on every
                //                    server-side HttpClient call below
                //
                // Resolve the identity strictly from the validated local JWT.
                // The Reports service then uses the caller email plus the
                // configured Reports admin password to mint the user-scoped
                // embed token (with embed_secret as its first attempt).
                var auth = _auth.GetAuthContext();
                if (auth == null || string.IsNullOrWhiteSpace(auth.Email))
                {
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var callerEmail = auth.Email;
                var cacheKey = $"bold-reports-embed-token-{callerEmail}";
                var embedToken = await _cacheService.GetAsync<string>(cacheKey);

                if (string.IsNullOrEmpty(embedToken))
                {
                    var user = new AppUser
                    {
                        Email = auth.Email,
                        TenantId = auth.TenantId,
                        TenantName = auth.TenantName,
                        Role = auth.Role,
                        Region = auth.Region,
                    };
                    embedToken = await _boldReportsService.GetEmbedTokenAsync(user);
                    if (string.IsNullOrEmpty(embedToken))
                    {
                        Logger.LogWarning(
                            "embed_token grant failed for caller {Email}; ensure BoldReports:EmbedSecret "
                            + "(or BOLD_REPORTS_SECRET env var) is set and matches the site's embed secret.",
                            callerEmail);
                        return StatusCode(503, ApiResponse<dynamic>.ErrorResponse(
                            "Embed token not configured",
                            "Server is missing BoldReports:EmbedSecret or the Reports site rejected the embed_token grant."));
                    }

                    await _cacheService.SetAsync(cacheKey, embedToken, TimeSpan.FromHours(12));
                }

                var reportRootUrl = _settings.ReportRootUrl;
                var reportsSiteIdentifier = _settings.ReportsSiteIdentifier;

                var viewerSettings = new
                {
                    token = embedToken,
                    serviceUrl = $"{reportRootUrl}/reportservice/api/Viewer",
                    serverUrl = $"{reportRootUrl}/api/site/{reportsSiteIdentifier}",
                    reportRootUrl = reportRootUrl
                };

                Logger.LogInformation(
                    "Viewer settings retrieved for caller {Email} (embedToken length={Len})",
                    callerEmail, embedToken.Length);
                return Ok(ApiResponse<dynamic>.SuccessResponse((dynamic)viewerSettings, "Viewer settings retrieved successfully"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error retrieving viewer settings");
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to retrieve viewer settings"));
            }
        }

        /// <summary>
        /// Get Bold Reports embed token with CustomAttributes
        /// Includes database name, organization, and tenant information for RLS
        /// </summary>
        /// <returns>Embed token for use with Bold Reports viewer</returns>
        [HttpGet("embed-token")]
        public async Task<IActionResult> GetEmbedToken()
        {
            try
            {
                // Identity is taken strictly from validated JWT claims; client-supplied
                // X-User-* headers were a complete trust bypass and are no
                // longer honored.
                var auth = _auth.GetAuthContext();
                if (auth == null)
                {
                    Logger.LogWarning("Embed token request without authenticated context");
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var cacheKey = $"bold-reports-embed-token-{auth.Email}";
                var embedToken = await _cacheService.GetAsync<string>(cacheKey);

                if (string.IsNullOrEmpty(embedToken))
                {
                    // Create user context
                    var user = new AppUser
                    {
                        Email = auth.Email,
                        TenantId = auth.TenantId,
                        TenantName = auth.TenantName,
                        Role = auth.Role,
                        Region = auth.Region,
                    };

                    embedToken = await _boldReportsService.GetEmbedTokenAsync(user);
                    if (string.IsNullOrEmpty(embedToken))
                    {
                        Logger.LogWarning("Failed to generate embed token for user: {Email}", user.Email);
                        return StatusCode(500, ApiResponse<dynamic>.ErrorResponse("Failed to generate embed token"));
                    }

                    await _cacheService.SetAsync(cacheKey, embedToken, TimeSpan.FromHours(12));
                }

                var reportRootUrl = _settings.ReportRootUrl;
                var reportsSiteIdentifier = _settings.ReportsSiteIdentifier;

                var response = new
                {
                    embedToken = embedToken,
                    serviceUrl = $"{reportRootUrl}/reportservice/api/Viewer",
                    serverUrl = $"{reportRootUrl}/api/site/{reportsSiteIdentifier}"
                };

                Logger.LogInformation("Embed token generated successfully for user: {Email}", auth.Email);
                return Ok(ApiResponse<dynamic>.SuccessResponse((dynamic)response, "Embed token generated successfully"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error generating embed token");
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to generate embed token"));
            }
        }

        /// <summary>
        /// Get report tree grouped by categories
        /// Only returns reports the user has access to (RLS enforced)
        /// </summary>
        /// <returns>Array of report categories with reports</returns>
        [HttpGet("tree")]
        public async Task<IActionResult> GetReportTree()
        {
            try
            {
                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    Logger.LogWarning("No token provided in Authorization header for report tree");
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                // Fetch reports and surface upstream failures instead of silently
                // returning 200 with an empty array — that previously masked
                // 4xx/5xx calls to the Bold Reports site.
                var (reports, sourceStatus, sourceBody) = await _boldReportsService.GetReportsWithStatusAsync(token);
                if (sourceStatus is null or >= 400)
                {
                    Logger.LogError(
                        "Bold Reports items fetch failed upstream. Status={Status} Body={Body}",
                        sourceStatus, sourceBody);
                    var detail = $"Upstream Bold Reports items fetch failed with status {(sourceStatus?.ToString() ?? "n/a")}";
                    if (!string.IsNullOrWhiteSpace(sourceBody))
                    {
                        // Trim huge payloads and surface the upstream error verbatim
                        // so the UI / logs can show *why* it failed (401 invalid token,
                        // 403 no access, 500 server error, etc.).
                        detail += $" | body: {(sourceBody.Length > 300 ? sourceBody.Substring(0, 300) + "…" : sourceBody)}";
                    }
                    return StatusCode(
                        StatusCodes.Status502BadGateway,
                        ApiResponse<dynamic>.ErrorResponse(detail, "Bold Reports service unavailable")
                    );
                }
                
                var nowIso = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");

                var authUser = _auth.GetAuthContext();
                var userEmail = authUser?.Email ?? "";
                var userRole = authUser?.Role ?? "";
                var tenantName = authUser?.TenantName ?? "";
                var tenantDomain = userEmail.Contains('@') ? userEmail.Substring(userEmail.IndexOf('@') + 1).ToLowerInvariant() : "";
                var isAdmin = string.Equals(userRole, "Admin", StringComparison.OrdinalIgnoreCase);

                var cacheKey = $"report_tree_{tenantName}_{userEmail}";

                // We only ever surface the "Analytics Reports" category from server.
                var analyticsReports = reports.Where(r => string.Equals(r.CategoryName, "Analytics Reports", StringComparison.OrdinalIgnoreCase)).ToList();

                // Standard template reports
                var standardReports = analyticsReports.Where(r => StandardReportNames.Contains(r.Name?.Trim() ?? "")).ToList();

                // Custom / User-copied reports: any report not in the standard set
                var customReports = analyticsReports.Where(r => !StandardReportNames.Contains(r.Name?.Trim() ?? "")).ToList();

                // Fetch registered custom reports for the caller's tenant from PostgreSQL
                List<CustomReportDto> dbCustomReports = new();
                if (authUser != null && !string.IsNullOrEmpty(tenantName))
                {
                    try
                    {
                        dbCustomReports = await _crmDataService.GetCustomReportsAsync(authUser);
                    }
                    catch (Exception ex)
                    {
                        Logger.LogWarning(ex, "Failed to load custom reports from DB for tenant {Tenant}, falling back to metadata tags", tenantName);
                    }
                }
                // Build lookup dictionaries from caller tenant's PostgreSQL database
                var dbByServerName = new Dictionary<string, CustomReportDto>(StringComparer.OrdinalIgnoreCase);
                var dbByName = new Dictionary<string, CustomReportDto>(StringComparer.OrdinalIgnoreCase);
                foreach (var cr in dbCustomReports)
                {
                    if (!string.IsNullOrWhiteSpace(cr.ServerReportName))
                    {
                        dbByServerName[cr.ServerReportName.Trim()] = cr;
                    }
                    if (!string.IsNullOrWhiteSpace(cr.ReportName))
                    {
                        dbByName[cr.ReportName.Trim()] = cr;
                        var expectedPrefix = $"{tenantName}_{cr.ReportName.Trim()}";
                        if (!dbByServerName.ContainsKey(expectedPrefix))
                        {
                            dbByServerName[expectedPrefix] = cr;
                        }
                    }
                }

                // Map to keep track of matched DB metadata for each server report
                var serverToDbMap = new Dictionary<string, CustomReportDto>(StringComparer.OrdinalIgnoreCase);

                // Domain / Tenant Isolation check: strictly ensure reports only show for their domain
                bool BelongsToCallerDomain(BoldReport r)
                {
                    var name = r.Name?.Trim() ?? "";
                    var desc = r.Description ?? "";

                    // CRITICAL RULE 1: If explicitly tagged for a DIFFERENT tenant, strictly exclude!
                    if (!string.IsNullOrEmpty(desc) && desc.Contains("[Tenant:", StringComparison.OrdinalIgnoreCase))
                    {
                        if (string.IsNullOrEmpty(tenantName) || !desc.Contains($"[Tenant: {tenantName}]", StringComparison.OrdinalIgnoreCase))
                        {
                            return false;
                        }
                    }

                    // CRITICAL RULE 2: If explicitly tagged with an owner email from another domain, strictly exclude!
                    if (!string.IsNullOrEmpty(desc) && desc.Contains("[Owner:", StringComparison.OrdinalIgnoreCase))
                    {
                        if (!string.IsNullOrEmpty(tenantDomain) && !desc.Contains($"@{tenantDomain}", StringComparison.OrdinalIgnoreCase))
                        {
                            return false;
                        }
                    }

                    // 1. Matched by ServerReportName (e.g. AlphaCorp_test)
                    if (dbByServerName.TryGetValue(name, out var matchedByServer))
                    {
                        serverToDbMap[name] = matchedByServer;
                        return true;
                    }

                    // 2. Matched by tenant prefix (e.g. r.Name starts with $"{tenantName}_")
                    if (!string.IsNullOrEmpty(tenantName) && name.StartsWith($"{tenantName}_", StringComparison.OrdinalIgnoreCase))
                    {
                        var cleanPart = name.Substring(tenantName.Length + 1);
                        if (dbByName.TryGetValue(cleanPart, out var matchedClean))
                        {
                            serverToDbMap[name] = matchedClean;
                        }
                        return true;
                    }

                    // 3. Matched in caller tenant's PostgreSQL database by report_name (e.g. legacy 'Test')
                    // ONLY if description did not fail the cross-tenant checks above
                    if (dbByName.TryGetValue(name, out var matchedByName))
                    {
                        serverToDbMap[name] = matchedByName;
                        return true;
                    }

                    // 4. Explicit tenant tag matching caller's tenant
                    if (!string.IsNullOrEmpty(tenantName) && desc.Contains($"[Tenant: {tenantName}]", StringComparison.OrdinalIgnoreCase))
                    {
                        return true;
                    }

                    // 5. Explicit owner tag with matching domain (e.g. @alphacorp.com)
                    if (!string.IsNullOrEmpty(tenantDomain) && desc.Contains($"@{tenantDomain}", StringComparison.OrdinalIgnoreCase))
                    {
                        return true;
                    }

                    return false;
                }

                // Filter custom reports: ONLY reports belonging to the caller's domain
                var domainCustomReports = customReports.Where(BelongsToCallerDomain).ToList();

                // Within the tenant:
                // Admins see all reports belonging to their domain.
                // Non-admins see reports they created OR reports created without specific personal owner restriction in their domain.
                var myReports = domainCustomReports.Where(r =>
                    isAdmin ||
                    (!string.IsNullOrEmpty(userEmail) && r.Description != null && r.Description.Contains($"[Owner: {userEmail}]", StringComparison.OrdinalIgnoreCase)) ||
                    (r.Description == null || !r.Description.Contains("[Owner:"))
                ).ToList();

                // Split standard reports into distinct groups:
                // 1. Sales Analytics: Product Sales Breakdown, Deal Products Pipeline Analysis Report, Sales Reps Performance Report
                var salesReports = standardReports.Where(r => 
                    r.Name.Contains("Sales", StringComparison.OrdinalIgnoreCase) || 
                    r.Name.Contains("Deal", StringComparison.OrdinalIgnoreCase) || 
                    r.Name.Contains("Pipeline", StringComparison.OrdinalIgnoreCase)
                ).ToList();

                // 2. Marketing & Finance Analytics: Campaign Performance Report, Monthly Revenue Report
                var financeMarketingReports = standardReports.Where(r => 
                    r.Name.Contains("Revenue", StringComparison.OrdinalIgnoreCase) || 
                    r.Name.Contains("Campaign", StringComparison.OrdinalIgnoreCase) ||
                    r.Name.Contains("Finance", StringComparison.OrdinalIgnoreCase) ||
                    r.Name.Contains("Financial", StringComparison.OrdinalIgnoreCase) ||
                    r.Name.Contains("Marketing", StringComparison.OrdinalIgnoreCase)
                ).ToList();

                // 3. System & Operational Reports: Audit Trail Report, Contact Details Report
                var systemOperationalReports = standardReports.Where(r => 
                    r.Name.Contains("Audit", StringComparison.OrdinalIgnoreCase) || 
                    r.Name.Contains("Contact", StringComparison.OrdinalIgnoreCase)
                ).ToList();

                var restructured = new List<(string Id, string Name, IEnumerable<BoldAdhocEmbed.Server.Services.BoldReport> Reports)>();

                // Prominently add "My Reports" at the top if any exist for this user/tenant
                if (myReports.Any())
                {
                    restructured.Add(("my-reports", "My Reports", myReports));
                }

                if (isAdmin)
                {
                    // Admin sees all groups with all reports
                    if (salesReports.Any()) restructured.Add(("sales-analytics", "Sales Analytics", salesReports));
                    if (financeMarketingReports.Any()) restructured.Add(("marketing-finance-analytics", "Marketing & Finance Analytics", financeMarketingReports));
                    if (systemOperationalReports.Any()) restructured.Add(("system-operational-reports", "System & Operational Reports", systemOperationalReports));
                }
                else if (string.Equals(userRole, "Sales", StringComparison.OrdinalIgnoreCase))
                {
                    if (salesReports.Any()) restructured.Add(("sales-analytics", "Sales Analytics", salesReports));
                }
                else if (string.Equals(userRole, "Finance", StringComparison.OrdinalIgnoreCase))
                {
                    if (financeMarketingReports.Any()) restructured.Add(("marketing-finance-analytics", "Marketing & Finance Analytics", financeMarketingReports));
                }
                else if (string.Equals(userRole, "Operations", StringComparison.OrdinalIgnoreCase) || string.Equals(userRole, "Support", StringComparison.OrdinalIgnoreCase))
                {
                    if (systemOperationalReports.Any()) restructured.Add(("system-operational-reports", "System & Operational Reports", systemOperationalReports));
                }
                else
                {
                    if (salesReports.Any()) restructured.Add(("sales-analytics", "Sales Analytics", salesReports));
                    if (financeMarketingReports.Any()) restructured.Add(("marketing-finance-analytics", "Marketing & Finance Analytics", financeMarketingReports));
                    if (systemOperationalReports.Any()) restructured.Add(("system-operational-reports", "System & Operational Reports", systemOperationalReports));
                }

                object tree = restructured.Select(g => new
                {
                    Id = g.Id,
                    Name = g.Name,
                    Reports = g.Reports.Select(r =>
                    {
                        string displayName = r.Name;
                        string serverReportName = r.Name;
                        string desc;

                        if (serverToDbMap.TryGetValue(r.Name, out var dbItem))
                        {
                            displayName = !string.IsNullOrWhiteSpace(dbItem.ReportName) ? dbItem.ReportName : displayName;
                            serverReportName = !string.IsNullOrWhiteSpace(dbItem.ServerReportName) ? dbItem.ServerReportName : r.Name;
                            desc = CleanDescription(!string.IsNullOrWhiteSpace(dbItem.Description) ? dbItem.Description : r.Description);
                        }
                        else
                        {
                            if (!string.IsNullOrEmpty(tenantName) && displayName.StartsWith($"{tenantName}_", StringComparison.OrdinalIgnoreCase))
                            {
                                displayName = displayName.Substring(tenantName.Length + 1);
                            }
                            desc = CleanDescription(r.Description);
                        }

                        return new
                        {
                            r.Id,
                            Name = displayName,
                            ServerReportName = serverReportName,
                            Description = desc,
                            CategoryName = g.Name,
                            r.CanRead,
                            r.CanWrite,
                            CreatedById = r.CreatedById,
                            IsPublic = r.IsPublic,
                            ModifiedDate = !string.IsNullOrEmpty(r.ModifiedDate) ? r.ModifiedDate : (!string.IsNullOrEmpty(r.ModifiedDateString) ? r.ModifiedDateString : (!string.IsNullOrEmpty(r.CreatedDate) ? r.CreatedDate : nowIso)),
                            CreatedDate = !string.IsNullOrEmpty(r.CreatedDate) ? r.CreatedDate : nowIso,
                            ModifiedDateString = !string.IsNullOrEmpty(r.ModifiedDateString) ? r.ModifiedDateString : (!string.IsNullOrEmpty(r.ModifiedDate) ? r.ModifiedDate : nowIso)
                        };
                    }).ToList()
                }).ToList();

                // Cache for 5 minutes
                await _cacheService.SetAsync(cacheKey, (dynamic)tree, TimeSpan.FromMinutes(5));

                Logger.LogInformation("Report tree retrieved successfully with {ReportCount} reports", reports.Count);
                return Ok(ApiResponse<dynamic>.SuccessResponse((dynamic)tree, "Report tree retrieved successfully"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error retrieving report tree");
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to retrieve report tree"));
            }
        }

        /// <summary>
        /// Get specific report details
        /// </summary>
        /// <param name="id">Report ID</param>
        /// <returns>Report details</returns>
        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<BoldReport>>> GetReport(string id)
        {
            try
            {
                if (!ValidateRequired(id, "Report ID", out var errorMsg))
                {
                    return BadRequest(ApiResponse<BoldReport>.ErrorResponse(errorMsg));
                }

                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    Logger.LogWarning("No token provided for getting report {ReportId}", id);
                    return Unauthorized(ApiResponse<BoldReport>.UnauthorizedResponse());
                }

                var reports = await _boldReportsService.GetReportsAsync(token);
                var report = reports.FirstOrDefault(r => r.Id == id);

                if (report == null)
                {
                    Logger.LogWarning("Report not found or access denied for report {ReportId}", id);
                    return NotFound(ApiResponse<BoldReport>.ErrorResponse(
                        $"Report with ID '{id}' not found or you don't have access",
                        "Report not accessible"
                    ));
                }

                Logger.LogInformation("Report {ReportId} retrieved successfully", id);
                return Ok(ApiResponse<BoldReport>.SuccessResponse(report, "Report retrieved successfully"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error retrieving report {ReportId}", id);
                return StatusCode(500, ApiResponse<BoldReport>.ErrorResponse(ex.Message, "Failed to retrieve report"));
            }
        }

        /// <summary>
        /// Export report to specified format
        /// </summary>
        /// <param name="request">Export request with Report ID and format</param>
        /// <returns>File stream with exported report</returns>
        [HttpPost("export")]
        public async Task<ActionResult> ExportReport([FromBody] ExportReportRequest request)
        {
            try
            {
                if (request == null)
                {
                    Logger.LogWarning("Invalid export request: request body is null");
                    return BadRequest(ApiResponse.ErrorResponse("Request body is required"));
                }

                if (string.IsNullOrEmpty(request?.ReportId))
                {
                    Logger.LogWarning("Invalid export request: missing ReportId");
                    return BadRequest(ApiResponse.ErrorResponse("Invalid Request", "ReportId is required"));
                }

                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    Logger.LogWarning("No token provided for exporting report {ReportId}", request.ReportId);
                    return Unauthorized(ApiResponse.UnauthorizedResponse());
                }

                var fileContent = await _boldReportsService.ExportReportAsync(
                    token,
                    request.ReportId,
                    request.ExportType ?? "PDF"
                );

                if (fileContent == null || fileContent.Length == 0)
                {
                    Logger.LogWarning("Report export returned no content for report {ReportId}", request.ReportId);
                    return NotFound(ApiResponse.ErrorResponse("Export Failed", "Report export returned no content or access denied"));
                }

                var contentType = (request.ExportType ?? "PDF").ToUpper() switch
                {
                    "PDF" => "application/pdf",
                    "EXCEL" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "CSV" => "text/csv",
                    _ => "application/octet-stream"
                };

                var fileName = $"report-{request.ReportId}.{(request.ExportType ?? "pdf").ToLower()}";
                Logger.LogInformation("Successfully exported report {ReportId} as {ExportType}", request.ReportId, request.ExportType);
                
                return File(fileContent, contentType, fileName);
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error exporting report");
                return StatusCode(500, ApiResponse.ErrorResponse(ex.Message, "Failed to export report"));
            }
        }

        /// <summary>
        /// Delete a report by name and optional category
        /// </summary>
        [HttpPost("Delete")]
        public async Task<IActionResult> Delete([FromBody] DeleteReportRequest request)
        {
            try
            {
                if (request == null || string.IsNullOrEmpty(request?.Name))
                {
                    Logger.LogWarning("Invalid delete request: request body is null or missing Name");
                    return BadRequest(ApiResponse.ErrorResponse("Invalid Request", "Name is required"));
                }

                var cleanName = request.Name.Trim();
                if (cleanName.Contains('/'))
                {
                    cleanName = cleanName.Split('/').Last().Trim();
                }

                // Strictly protect against deleting standard multi-tenant template reports
                if (StandardReportNames.Contains(cleanName))
                {
                    Logger.LogWarning("Blocked attempt to delete standard template report: {ReportName}", cleanName);
                    return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.ErrorResponse(
                        "Shared template reports cannot be deleted",
                        "Deleting shared reports affects all tenants and users. Deletion of standard reports is forbidden."
                    ));
                }

                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    Logger.LogWarning("No token provided for deleting report {ReportName}", request.Name);
                    return Unauthorized(ApiResponse.UnauthorizedResponse());
                }

                var deleted = await _boldReportsService.DeleteReportAsync(token, request.Name, request.Category);
                if (deleted)
                {
                    var authUser = _auth.GetAuthContext();
                    if (authUser != null)
                    {
                        await _crmDataService.DeleteCustomReportAsync(authUser, cleanName);
                        await _cacheService.RemoveAsync($"report_tree_{authUser.TenantName}_{authUser.Email}");
                        await _cacheService.RemoveAsync($"report-tree-{authUser.Email}");
                    }

                    Logger.LogInformation("Report {ReportName} deleted successfully", request.Name);
                    return Ok(ApiResponse<bool>.SuccessResponse(true, "Report deleted successfully"));
                }
                else
                {
                    Logger.LogWarning("Failed to delete report {ReportName}", request.Name);
                    return StatusCode(502, ApiResponse.ErrorResponse("Failed to delete report", "External API Error"));
                }
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error deleting report {ReportName}", request?.Name);
                return StatusCode(500, ApiResponse.ErrorResponse(ex.Message, "Failed to delete report"));
            }
        }

        private static string CleanDescription(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return "";
            var cleaned = System.Text.RegularExpressions.Regex.Replace(raw, @"\[Tenant:\s*[^\]]+\]", "");
            cleaned = System.Text.RegularExpressions.Regex.Replace(cleaned, @"\[Owner:\s*[^\]]+\]", "").Trim();
            return cleaned;
        }

        /// <summary>
        /// Register or update a custom report's tenant ownership in PostgreSQL
        /// </summary>
        [HttpPost("register")]
        public async Task<IActionResult> RegisterReport([FromBody] RegisterReportRequest request)
        {
            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.ReportName))
                {
                    return BadRequest(ApiResponse<bool>.ErrorResponse("Report name is required"));
                }

                var authUser = _auth.GetAuthContext();
                if (authUser == null)
                {
                    return Unauthorized(ApiResponse<bool>.UnauthorizedResponse());
                }

                var serverName = !string.IsNullOrWhiteSpace(request.ServerReportName)
                    ? request.ServerReportName.Trim()
                    : $"{authUser.TenantName}_{request.ReportName.Trim()}";

                await _crmDataService.RegisterCustomReportAsync(
                    authUser,
                    request.ReportName.Trim(),
                    request.Description,
                    request.Category ?? "Analytics Reports",
                    serverName
                );

                await _cacheService.RemoveAsync($"report_tree_{authUser.TenantName}_{authUser.Email}");
                Logger.LogInformation("Report {ReportName} (server: {ServerName}) registered to tenant {Tenant} by {Email}",
                    request.ReportName, serverName, authUser.TenantName, authUser.Email);

                return Ok(ApiResponse<bool>.SuccessResponse(true, "Report registered to tenant successfully"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error registering report {ReportName}", request?.ReportName);
                return StatusCode(500, ApiResponse<bool>.ErrorResponse(ex.Message, "Failed to register report"));
            }
        }
    }

    /// <summary>
    /// Request model for registering reports to a tenant
    /// </summary>
    public class RegisterReportRequest
    {
        public string ReportName { get; set; } = string.Empty;
        public string? ServerReportName { get; set; }
        public string? Category { get; set; } = "Analytics Reports";
        public string? Description { get; set; }
    }

    /// <summary>
    /// Request model for exporting reports
    /// </summary>
    public class ExportReportRequest
    {
        /// <summary>
        /// Report identifier
        /// </summary>
        public string? ReportId { get; set; }

        /// <summary>
        /// Export format (PDF, EXCEL, CSV)
        /// </summary>
        public string? ExportType { get; set; }
    }

    /// <summary>
    /// Request model for deleting reports
    /// </summary>
    public class DeleteReportRequest
    {
        /// <summary>
        /// Report name or serverPath
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// Optional category name used to build serverPath
        /// </summary>
        public string? Category { get; set; }
    }
}
