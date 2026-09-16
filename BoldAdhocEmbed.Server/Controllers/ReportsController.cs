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

        public ReportsController(
            IBoldReportsService boldReportsService,
            ILogger<ReportsController> logger,
            BoldReportsSettings settings,
            ICacheService cacheService,
            IAuthenticatedUser auth)
            : base(logger)
        {
            _boldReportsService = boldReportsService ?? throw new ArgumentNullException(nameof(boldReportsService));
            _settings = settings ?? throw new ArgumentNullException(nameof(settings));
            _cacheService = cacheService ?? throw new ArgumentNullException(nameof(cacheService));
            _auth = auth ?? throw new ArgumentNullException(nameof(auth));
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

                var cacheKey = $"report_tree_{token}";

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

                // We only ever surface the "Analytics Reports" category to any user.
                var analyticsReports = reports.Where(r => string.Equals(r.CategoryName, "Analytics Reports", StringComparison.OrdinalIgnoreCase)).ToList();

                // Split the 7 reports in "Analytics Reports" into distinct groups:
                // 1. Sales Analytics: Product Sales Breakdown, Deal Products Pipeline Analysis Report, Sales Reps Performance Report
                var salesReports = analyticsReports.Where(r => 
                    r.Name.Contains("Sales", StringComparison.OrdinalIgnoreCase) || 
                    r.Name.Contains("Deal", StringComparison.OrdinalIgnoreCase) || 
                    r.Name.Contains("Pipeline", StringComparison.OrdinalIgnoreCase)
                ).ToList();

                // 2. Marketing & Finance Analytics: Campaign Performance Report, Monthly Revenue Report
                var financeMarketingReports = analyticsReports.Where(r => 
                    r.Name.Contains("Revenue", StringComparison.OrdinalIgnoreCase) || 
                    r.Name.Contains("Campaign", StringComparison.OrdinalIgnoreCase) ||
                    r.Name.Contains("Finance", StringComparison.OrdinalIgnoreCase) ||
                    r.Name.Contains("Financial", StringComparison.OrdinalIgnoreCase) ||
                    r.Name.Contains("Marketing", StringComparison.OrdinalIgnoreCase)
                ).ToList();

                // 3. System & Operational Reports: Audit Trail Report, Contact Details Report
                var systemOperationalReports = analyticsReports.Where(r => 
                    r.Name.Contains("Audit", StringComparison.OrdinalIgnoreCase) || 
                    r.Name.Contains("Contact", StringComparison.OrdinalIgnoreCase)
                ).ToList();

                // 4. Other Analytics: any remaining reports in Analytics Reports
                var otherReports = analyticsReports
                    .Except(salesReports)
                    .Except(financeMarketingReports)
                    .Except(systemOperationalReports)
                    .ToList();

                var userRole = _auth.GetAuthContext()?.Role;
                var restructured = new List<(string Id, string Name, IEnumerable<BoldAdhocEmbed.Server.Services.BoldReport> Reports)>();

                if (string.Equals(userRole, "Admin", StringComparison.OrdinalIgnoreCase))
                {
                    // Admin sees all groups with all 7 reports
                    if (salesReports.Any()) restructured.Add(("sales-analytics", "Sales Analytics", salesReports));
                    if (financeMarketingReports.Any()) restructured.Add(("marketing-finance-analytics", "Marketing & Finance Analytics", financeMarketingReports));
                    if (systemOperationalReports.Any()) restructured.Add(("system-operational-reports", "System & Operational Reports", systemOperationalReports));
                    if (otherReports.Any()) restructured.Add(("other-analytics", "Other Analytics", otherReports));
                }
                else if (string.Equals(userRole, "Sales", StringComparison.OrdinalIgnoreCase))
                {
                    // Sales users see ONLY Sales related reports among the 7 reports
                    if (salesReports.Any()) restructured.Add(("sales-analytics", "Sales Analytics", salesReports));
                }
                else if (string.Equals(userRole, "Finance", StringComparison.OrdinalIgnoreCase))
                {
                    // Finance users see ONLY Marketing & Finance Analytics
                    if (financeMarketingReports.Any()) restructured.Add(("marketing-finance-analytics", "Marketing & Finance Analytics", financeMarketingReports));
                }
                else if (string.Equals(userRole, "Operations", StringComparison.OrdinalIgnoreCase) || string.Equals(userRole, "Support", StringComparison.OrdinalIgnoreCase))
                {
                    // Operations / Support see ONLY System & Operational Reports
                    if (systemOperationalReports.Any()) restructured.Add(("system-operational-reports", "System & Operational Reports", systemOperationalReports));
                }
                else
                {
                    // Manager and other non-admin roles see relevant groups
                    if (salesReports.Any()) restructured.Add(("sales-analytics", "Sales Analytics", salesReports));
                    if (financeMarketingReports.Any()) restructured.Add(("marketing-finance-analytics", "Marketing & Finance Analytics", financeMarketingReports));
                    if (systemOperationalReports.Any()) restructured.Add(("system-operational-reports", "System & Operational Reports", systemOperationalReports));
                    if (otherReports.Any()) restructured.Add(("other-analytics", "Other Analytics", otherReports));
                }

                object tree = restructured.Select(g => new
                {
                    Id = g.Id,
                    Name = g.Name,
                    Reports = g.Reports.Select(r => new
                    {
                        r.Id,
                        r.Name,
                        r.Description,
                        CategoryName = r.CategoryName ?? "Analytics Reports",
                        r.CanRead,
                        r.CanWrite,
                        CreatedById = r.CreatedById,
                        IsPublic = r.IsPublic,
                        ModifiedDate = !string.IsNullOrEmpty(r.ModifiedDate) ? r.ModifiedDate : (!string.IsNullOrEmpty(r.ModifiedDateString) ? r.ModifiedDateString : (!string.IsNullOrEmpty(r.CreatedDate) ? r.CreatedDate : nowIso)),
                        CreatedDate = !string.IsNullOrEmpty(r.CreatedDate) ? r.CreatedDate : nowIso,
                        ModifiedDateString = !string.IsNullOrEmpty(r.ModifiedDateString) ? r.ModifiedDateString : (!string.IsNullOrEmpty(r.ModifiedDate) ? r.ModifiedDate : nowIso)
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

                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    Logger.LogWarning("No token provided for deleting report {ReportName}", request.Name);
                    return Unauthorized(ApiResponse.UnauthorizedResponse());
                }

                var deleted = await _boldReportsService.DeleteReportAsync(token, request.Name, request.Category);
                if (deleted)
                {
                    var requestToken = GetTokenFromRequest();
                    var userEmail = GetEmailFromToken(requestToken);
                    if (string.IsNullOrEmpty(userEmail))
                    {
                        return Unauthorized(ApiResponse<bool>.UnauthorizedResponse());
                    }
                    var cacheKey = $"report-tree-{userEmail}";
                    await _cacheService.RemoveAsync(cacheKey);

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
