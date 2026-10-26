using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using BoldAdhocEmbed.Server.Services;
using BoldAdhocEmbed.Server.Models;
using BoldAdhocEmbed.Server.Validators;
using BoldAdhocEmbed.Server.Services.ReportBuilder;

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
        private readonly Services.ReportBuilder.IDatasetCatalogService _datasetCatalog;
        private readonly Services.ReportBuilder.IRdlGenerator _rdlGenerator;
        private readonly Services.QuickEdit.IBoldItemsClient _itemsClient;

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
            ICrmDataService crmDataService,
            Services.ReportBuilder.IDatasetCatalogService datasetCatalog,
            Services.ReportBuilder.IRdlGenerator rdlGenerator,
            Services.QuickEdit.IBoldItemsClient itemsClient)
            : base(logger)
        {
            _boldReportsService = boldReportsService ?? throw new ArgumentNullException(nameof(boldReportsService));
            _settings = settings ?? throw new ArgumentNullException(nameof(settings));
            _cacheService = cacheService ?? throw new ArgumentNullException(nameof(cacheService));
            _auth = auth ?? throw new ArgumentNullException(nameof(auth));
            _crmDataService = crmDataService ?? throw new ArgumentNullException(nameof(crmDataService));
            _datasetCatalog = datasetCatalog ?? throw new ArgumentNullException(nameof(datasetCatalog));
            _rdlGenerator = rdlGenerator ?? throw new ArgumentNullException(nameof(rdlGenerator));
            _itemsClient = itemsClient ?? throw new ArgumentNullException(nameof(itemsClient));
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

                var callerEmail = BaseController.MapToTenantEmail(auth.Email, auth.TenantName);
                var cacheKey = $"bold-reports-embed-token-{callerEmail}";
                var embedToken = await _cacheService.GetAsync<string>(cacheKey);

                if (string.IsNullOrEmpty(embedToken))
                {
                    var user = new AppUser
                    {
                        Email = callerEmail,
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
                var rawEmail = authUser?.Email ?? "";
                var userRole = authUser?.Role ?? "";
                var tenantName = authUser?.TenantName ?? "";
                var userEmail = BaseController.MapToTenantEmail(rawEmail, tenantName);
                var tenantDomain = userEmail.Contains('@') ? userEmail.Substring(userEmail.IndexOf('@') + 1).ToLowerInvariant() : "alphacorp.com";
                var isAdmin = string.Equals(userRole, "Admin", StringComparison.OrdinalIgnoreCase);

                var cacheKey = $"report_tree_{tenantName}_{userEmail}";

                // Standard template reports
                var standardReports = reports.Where(r =>
                    string.Equals(r.CategoryName, "Analytics Reports", StringComparison.OrdinalIgnoreCase) &&
                    StandardReportNames.Contains(r.Name?.Trim() ?? "")
                ).ToList();

                var sanitizedUser = BoldReportsService.SanitizeCategoryName(userEmail);

                // Custom / User-copied reports: any report not in the standard set
                var customReports = reports.Where(r =>
                    !(string.Equals(r.CategoryName, "Analytics Reports", StringComparison.OrdinalIgnoreCase) &&
                      StandardReportNames.Contains(r.Name?.Trim() ?? ""))
                ).ToList();

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
                    var cat = r.CategoryName?.Trim() ?? "";

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

                    // Rule 0: Matched by nested category (e.g. CategoryName is tenantName, sanitizedUser, or tenantName/sanitizedUser)
                    if (!string.IsNullOrEmpty(tenantName) && (
                        string.Equals(cat, tenantName, StringComparison.OrdinalIgnoreCase) ||
                        cat.StartsWith($"{tenantName}/", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(cat, sanitizedUser, StringComparison.OrdinalIgnoreCase)))
                    {
                        if (dbByName.TryGetValue(name, out var matchedCatName))
                        {
                            serverToDbMap[name] = matchedCatName;
                        }
                        return true;
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
                // "My Reports" = every report whose Bold Reports category name
                // equals the caller's email. This is the authoritative filter:
                // the Bold Reports category IS the user's "My Reports" folder.
                //
                // IMPORTANT: this MUST filter over the full, unfiltered `reports`
                // list — NOT `domainCustomReports`. `domainCustomReports` has
                // already been narrowed by BelongsToCallerDomain(), which only
                // keeps reports carrying an [Owner: {email}] / [Tenant: ...]
                // description tag (or a DB match). Only 3 of alpha1's 9 reports
                // carry that tag, so filtering the narrowed list silently hid 6.
                // Membership in the per-email category is the sole source of
                // truth here — no created-by, owner-tag, or domain filtering.
                // This matches the /api/reports/my endpoint exactly so the
                // sidebar tree and the toolbar toggle always agree.
                var myReports = reports.Where(r =>
                    !string.IsNullOrEmpty(userEmail) &&
                    !string.IsNullOrEmpty(r.CategoryName) &&
                    string.Equals(r.CategoryName.Trim(), userEmail.Trim(),
                        StringComparison.OrdinalIgnoreCase)
                ).ToList();

                var restructured = new List<(string Id, string Name, IEnumerable<BoldAdhocEmbed.Server.Services.BoldReport> Reports)>();

                // 1. Prominently add "My Reports" at the top if any exist for this user/tenant
                if (myReports.Any())
                {
                    restructured.Add(("my-reports", "My Reports", myReports));
                }

                // 2. Consolidate ALL standard reports into "System Reports"
                if (standardReports.Any())
                {
                    restructured.Add(("system-reports", "System Reports", standardReports));
                }

                object tree = restructured.Select(g => new
                {
                    Id = g.Id,
                    Name = g.Name,
                    Reports = g.Reports.Select(r =>
                    {
                        string displayName = r.Name;
                        string serverReportName = r.Name;
                        string serverCategory = r.CategoryName ?? "Analytics Reports";
                        string desc;

                        if (serverToDbMap.TryGetValue(r.Name, out var dbItem))
                        {
                            displayName = !string.IsNullOrWhiteSpace(dbItem.ReportName) ? dbItem.ReportName : displayName;
                            serverReportName = !string.IsNullOrWhiteSpace(dbItem.ServerReportName) ? dbItem.ServerReportName : r.Name;
                            serverCategory = !string.IsNullOrWhiteSpace(dbItem.CategoryName) ? dbItem.CategoryName : serverCategory;
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

                        // For standard reports in System Reports, ensure server category is Analytics Reports
                        if (string.Equals(g.Name, "System Reports", StringComparison.OrdinalIgnoreCase))
                        {
                            serverCategory = "Analytics Reports";
                        }
                        else if (!string.IsNullOrEmpty(tenantName) && 
                                 !string.Equals(serverCategory, "Analytics Reports", StringComparison.OrdinalIgnoreCase))
                        {
                            if (!serverCategory.StartsWith($"{tenantName}/", StringComparison.OrdinalIgnoreCase) &&
                                !string.Equals(serverCategory, tenantName, StringComparison.OrdinalIgnoreCase))
                            {
                                serverCategory = $"{tenantName}/{serverCategory}";
                            }
                        }

                        // For "My Reports", all users can delete their own reports by default
                        var canDelete = string.Equals(g.Name, "My Reports", StringComparison.OrdinalIgnoreCase);

                        return new
                        {
                            r.Id,
                            ReportId = r.Id,
                            ReportPath = r.Id,
                            Name = displayName,
                            ServerReportName = serverReportName,
                            ServerCategory = serverCategory,
                            Description = desc,
                            CategoryName = g.Name,
                            r.CanRead,
                            r.CanWrite,
                            CanDelete = canDelete,
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
        /// Get parameter definitions for a report using Bold Reports v5.0 API
        /// </summary>
        [HttpGet("{id}/parameters")]
        public async Task<IActionResult> GetReportParameters(string id)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(id))
                {
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse("Report ID is required"));
                }

                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var parameters = await _boldReportsService.GetReportParametersAsync(token, id.Trim());
                return Ok(ApiResponse<dynamic>.SuccessResponse(parameters, "Parameters retrieved successfully"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error retrieving parameters for report {ReportId}", id);
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to retrieve parameters"));
            }
        }

        /// <summary>
        /// Get cascading parameter values using Bold Reports v5.0 API
        /// </summary>
        [HttpGet("{id}/cascading-parameters")]
        public async Task<IActionResult> GetCascadingReportParameters(string id, [FromQuery] string filterParameters)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(id))
                {
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse("Report ID is required"));
                }

                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var cascading = await _boldReportsService.GetCascadingReportParametersAsync(token, id.Trim(), filterParameters ?? "{}");
                return Ok(ApiResponse<dynamic>.SuccessResponse(cascading, "Cascading parameters retrieved successfully"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error retrieving cascading parameters for report {ReportId}", id);
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to retrieve cascading parameters"));
            }
        }

        /// <summary>
        /// Export report using Bold Reports v5.0 API with parameters support (Items_ExportReportV3)
        /// </summary>
        [HttpPost("export-v3")]
        public async Task<IActionResult> ExportReportV3([FromBody] ExportReportV3Request request)
        {
            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.ReportId))
                {
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse("ReportId is required"));
                }

                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var (fileContent, contentType, fileName) = await _boldReportsService.ExportReportV3Async(
                    token,
                    request.ReportId.Trim(),
                    request.ServerPath,
                    request.ExportType ?? "PDF",
                    request.FilterParameters,
                    request.ReportName
                );

                if (fileContent == null || fileContent.Length == 0)
                {
                    return StatusCode(502, ApiResponse<dynamic>.ErrorResponse("Export failed or returned empty content from Bold Reports server"));
                }

                Response.Headers.Append("Content-Disposition", $"attachment; filename=\"{fileName}\"");
                return File(fileContent, contentType, fileName);
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error exporting report v3 for {ReportId}", request?.ReportId);
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to export report"));
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

                var deleted = await _boldReportsService.DeleteReportAsync(token, request.Name, request.Category, request.Id);
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

        /// <summary>
        /// Ensures that the parent Tenant category and the nested User subcategory
        /// exist in Bold Reports, returning the full category path (e.g. "AlphaCorp/alpha1alphacorpcom").
        /// </summary>
        [HttpPost("ensure-category")]
        public async Task<IActionResult> EnsureCategory()
        {
            try
            {
                var authUser = _auth.GetAuthContext();
                if (authUser == null || string.IsNullOrWhiteSpace(authUser.Email))
                {
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var tenantName = !string.IsNullOrWhiteSpace(authUser.TenantName) ? authUser.TenantName : "AlphaCorp";
                var (ok, path, tenantCatId, userCatId, err) = await _boldReportsService.EnsureNestedUserCategoryAsync(token, tenantName, authUser.Email);

                var sanitizedUser = BoldReportsService.SanitizeCategoryName(authUser.Email);

                return Ok(ApiResponse<dynamic>.SuccessResponse(new
                {
                    categoryPath = path,
                    tenantCategory = tenantName,
                    userSubcategory = sanitizedUser,
                    tenantCategoryId = tenantCatId,
                    userCategoryId = userCatId
                }, "Nested category verified"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error ensuring nested category");
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to ensure category"));
            }
        }

        // ---------------------------------------------------------------- New Report builder

        /// <summary>
        /// Lists the shared datasets available for building a new report.
        /// Filtered to the same allow-list the full designer enforces.
        /// </summary>
        [HttpGet("datasets")]
        public async Task<IActionResult> GetDatasets()
        {
            try
            {
                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var datasets = await _datasetCatalog.ListDatasetsAsync(token);
                return Ok(ApiResponse<dynamic>.SuccessResponse(datasets, "Datasets retrieved"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error listing datasets");
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to list datasets"));
            }
        }

        /// <summary>
        /// Returns the columns (fields) of a shared dataset so the wizard can
        /// present a checklist of columns to include in the new report.
        /// </summary>
        [HttpGet("datasets/{id}/fields")]
        public async Task<IActionResult> GetDatasetFields(string id)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(id))
                {
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse("Dataset id is required"));
                }

                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var detail = await _datasetCatalog.GetDatasetDetailAsync(token, id);
                if (detail == null)
                {
                    return NotFound(ApiResponse<dynamic>.ErrorResponse(
                        $"Dataset '{id}' not found or has no readable definition", "Dataset not available"));
                }

                return Ok(ApiResponse<dynamic>.SuccessResponse(detail, "Dataset fields retrieved"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error retrieving dataset fields for {Id}", id);
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to retrieve dataset fields"));
            }
        }

        /// <summary>
        /// Generates a plain-tablix RDL from the selected dataset + columns,
        /// creates it as a report in the caller's per-user "My Reports"
        /// folder, registers it in the tenant DB, and returns the new item's
        /// id + serverPath so the client can preview it in the existing
        /// viewer flow.
        /// </summary>
        [HttpPost("build")]
        public async Task<IActionResult> BuildReport([FromBody] BuildReportRequest request)
        {
            try
            {
                if (request == null
                    || string.IsNullOrWhiteSpace(request.DatasetId)
                    || string.IsNullOrWhiteSpace(request.ReportName)
                    || request.Columns == null || request.Columns.Count == 0)
                {
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse(
                        "DatasetId, ReportName and at least one column are required"));
                }

                var authUser = _auth.GetAuthContext();
                if (authUser == null || string.IsNullOrWhiteSpace(authUser.Email))
                {
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                // 1. Resolve the dataset so we bind the generated report to a
                //    real shared dataset + its data source. We also use the
                //    dataset's own field metadata to type each selected column.
                var detail = await _datasetCatalog.GetDatasetDetailAsync(token, request.DatasetId);
                if (detail == null)
                {
                    return NotFound(ApiResponse<dynamic>.ErrorResponse(
                        $"Dataset '{request.DatasetId}' not found", "Dataset not available"));
                }

                var typeByName = detail.Columns
                    .GroupBy(c => c.Name, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(g => g.Key, g => g.First().TypeName, StringComparer.OrdinalIgnoreCase);

                // Keep only columns that actually exist in the dataset,
                // preserving the order the user selected them in.
                var selectedFields = request.Columns
                    .Where(c => !string.IsNullOrWhiteSpace(c) && typeByName.ContainsKey(c.Trim()))
                    .Select(c => new Services.ReportBuilder.ReportField
                    {
                        Name = c.Trim(),
                        TypeName = typeByName[c.Trim()],
                    })
                    .ToList();

                if (selectedFields.Count == 0)
                {
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse(
                        "None of the selected columns exist in the dataset"));
                }

                // 2. Generate the RDL.
                var tenantName = !string.IsNullOrWhiteSpace(authUser.TenantName) ? authUser.TenantName : "AlphaCorp";
                var cleanName = request.ReportName.Trim();
                var serverReportName = cleanName.StartsWith($"{tenantName}_", StringComparison.OrdinalIgnoreCase)
                    ? cleanName.Substring(tenantName.Length + 1)
                    : cleanName;

                var rdl = _rdlGenerator.Generate(new Services.ReportBuilder.ReportGenerationRequest
                {
                    ReportName = serverReportName,
                    SharedDataSetId = detail.Id,
                    DataSetName = detail.Name,
                    DataSourceId = detail.DataSourceId ?? string.Empty,
                    Fields = selectedFields,
                    Filters = request.Filters ?? new(),
                    Sorts = request.Sorts ?? new(),
                });

                // 3. Resolve the per-user "My Reports" folder (their email is
                //    the category name in Bold Reports). We deliberately use the
                //    simpler ResolveCategoryIdAsync path (same one
                //    CustomizeService uses) instead of EnsureNestedUserCategoryAsync:
                //    that one requires a parent "tenant" category to exist, which
                //    isn't always present on this site, and silently returned null
                //    → empty CategoryId → "Current request is empty." 400.
                var categoryPath = authUser.Email;
                var categoryId = await _itemsClient.ResolveCategoryIdAsync(token, categoryPath);
                if (string.IsNullOrWhiteSpace(categoryId))
                {
                    return StatusCode(StatusCodes.Status502BadGateway,
                        ApiResponse<dynamic>.ErrorResponse(
                            $"Could not resolve or create a Bold Reports category named '{categoryPath}'.",
                            "Failed to create report"));
                }

                // 4. Build description with the tenant/owner tags the tree
                //    builder relies on to scope reports to this user.
                var description = request.Description?.Trim() ?? string.Empty;
                if (!description.Contains("[Tenant:", StringComparison.OrdinalIgnoreCase))
                    description = $"[Tenant: {tenantName}] {description}".Trim();
                if (!description.Contains("[Owner:", StringComparison.OrdinalIgnoreCase))
                    description = $"[Owner: {authUser.Email}] {description}".Trim();

                // 5. Create the report in Bold Reports.
                var created = await _itemsClient.CreateReportAsync(
                    token,
                    serverPath: string.Empty,
                    categoryId: categoryId ?? string.Empty,
                    description: description,
                    reportName: serverReportName,
                    rdlBytes: System.Text.Encoding.UTF8.GetBytes(rdl));

                if (!created.Success)
                {
                    Logger.LogWarning("BuildReport create failed status={Status} error={Error}",
                        created.StatusCode, created.Error);
                    return StatusCode(StatusCodes.Status502BadGateway,
                        ApiResponse<dynamic>.ErrorResponse(
                            created.Error ?? "Create failed", "Failed to create report"));
                }

                // 6. Register in tenant DB so it shows under My Reports.
                try
                {
                    await _crmDataService.RegisterCustomReportAsync(
                        authUser, serverReportName, description, categoryPath, serverReportName);
                    await _cacheService.RemoveAsync($"report_tree_{authUser.TenantName}_{authUser.Email}");
                }
                catch (Exception ex)
                {
                    Logger.LogWarning(ex, "BuildReport: tenant DB register failed for {Report}", serverReportName);
                }

                var serverPath = $"/{categoryPath}/{serverReportName}".Replace("//", "/");
                return Ok(ApiResponse<dynamic>.SuccessResponse(new
                {
                    itemId = created.ItemId,
                    reportName = serverReportName,
                    categoryName = categoryPath,
                    serverPath,
                }, "Report created"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error building report {ReportName}", request?.ReportName);
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to build report"));
            }
        }

        // ---------------------------------------------------------------- My Reports (server-side list)

        /// <summary>
        /// Dedicated endpoint for the "My Reports" view.
        ///
        /// Pulls every report from Bold Reports v1.0 /items?itemtype=Report
        /// and returns the subset whose CategoryName equals the caller's
        /// email (case-insensitive, trimmed). Server-side filter — no
        /// client-side scope toggle over the full tree payload.
        ///
        /// Matches the requirement: "list all available reports in the
        /// category whose name is the user email".
        /// </summary>
        [HttpGet("my")]
        public async Task<IActionResult> GetMyReports()
        {
            try
            {
                var authUser = _auth.GetAuthContext();
                if (authUser == null || string.IsNullOrWhiteSpace(authUser.Email))
                {
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var sessionUser = authUser.Email.Trim();

                var (allReports, sourceStatus, sourceBody) =
                    await _boldReportsService.GetReportsWithStatusAsync(token);

                if (sourceStatus is null or >= 400)
                {
                    Logger.LogWarning(
                        "GetMyReports upstream failed. status={Status} body={Body}",
                        sourceStatus, sourceBody);
                    var detail = $"Bold Reports items fetch failed with status {sourceStatus?.ToString() ?? "n/a"}";
                    if (!string.IsNullOrWhiteSpace(sourceBody))
                        detail += $" | body: {(sourceBody.Length > 300 ? sourceBody.Substring(0, 300) + "…" : sourceBody)}";
                    return StatusCode(
                        StatusCodes.Status502BadGateway,
                        ApiResponse<dynamic>.ErrorResponse(detail, "My Reports unavailable"));
                }

                // Server-side filter: every report whose CategoryName
                // exactly equals the caller's email. Matches the
                // "category name is equal to the user email" requirement.
                var userReports = allReports
                    .Where(r => !string.IsNullOrWhiteSpace(r.CategoryName)
                                && string.Equals(r.CategoryName.Trim(), sessionUser,
                                    StringComparison.OrdinalIgnoreCase))
                    .ToList();

                var nowIso = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ");
                var reports = userReports.Select(r => new
                {
                    id = r.Id,
                    reportId = r.Id,
                    reportPath = r.Id,
                    name = r.Name,
                    serverReportName = r.Name,
                    serverCategory = r.CategoryName,
                    description = r.Description ?? string.Empty,
                    categoryName = sessionUser,
                    r.CanRead,
                    r.CanWrite,
                    createdById = r.CreatedById,
                    isPublic = r.IsPublic,
                    modifiedDate = !string.IsNullOrEmpty(r.ModifiedDate) ? r.ModifiedDate : nowIso,
                    createdDate = !string.IsNullOrEmpty(r.CreatedDate) ? r.CreatedDate : nowIso,
                }).ToList();

                return Ok(ApiResponse<dynamic>.SuccessResponse(new
                {
                    categoryName = sessionUser,
                    count = reports.Count,
                    reports,
                }, "My Reports retrieved"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error retrieving My Reports");
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to retrieve My Reports"));
            }
        }
    }

    /// <summary>
    /// Request model for building a new report from a shared dataset.
    /// </summary>
    public class BuildReportRequest
    {
        public string DatasetId { get; set; } = string.Empty;
        public string ReportName { get; set; } = string.Empty;
        public string? Description { get; set; }
        /// <summary>Field names to include, in display order.</summary>
        public List<string> Columns { get; set; } = new();
        // Optional. Tablix-level filters + matching report parameters.
        public List<ReportFilter> Filters { get; set; } = new();
        // Optional. Tablix-level sort expressions.
        public List<ReportSort> Sorts { get; set; } = new();
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
    /// Request model for v5.0 export report with parameters (Items_ExportReportV3)
    /// </summary>
    public class ExportReportV3Request
    {
        public string ReportId { get; set; } = string.Empty;
        public string? ReportName { get; set; }
        public string? ServerPath { get; set; }
        public string ExportType { get; set; } = "PDF";
        public Dictionary<string, List<string>>? FilterParameters { get; set; }
    }

    /// <summary>
    /// Request model for deleting reports. Per the Bold Reports v1.0
    /// REST spec, items are deleted by ItemId (GUID) — not by
    /// Name/Category. Name + Category are kept as a fallback so older
    /// callers and the v5.0 serverPath-based delete still work.
    /// </summary>
    public class DeleteReportRequest
    {
        /// <summary>
        /// Bold Reports ItemId (GUID). Preferred — used directly against
        /// the v1.0 endpoint: DELETE /api/site/{tenant}/v1.0/items/{id}.
        /// </summary>
        public string? Id { get; set; }

        /// <summary>
        /// Report name (used as fallback when Id is missing).
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        /// Optional category name (used together with Name as fallback).
        /// </summary>
        public string? Category { get; set; }
    }
}
