using Microsoft.AspNetCore.Mvc;
using BoldAdhocEmbed.Server.Services;
using BoldAdhocEmbed.Server.Models;
using BoldAdhocEmbed.Server.Validators;

namespace BoldAdhocEmbed.Server.Controllers
{
    /// <summary>
    /// Reports API endpoints for retrieving and managing reports
    /// All operations respect user permissions through RLS
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class ReportsController : BaseController
    {
        private readonly IBoldReportsService _boldReportsService;
        private readonly BoldReportsSettings _settings;
        private readonly ICacheService _cacheService;

        public ReportsController(
            IBoldReportsService boldReportsService,
            ILogger<ReportsController> logger,
            BoldReportsSettings settings,
            ICacheService cacheService)
            : base(logger)
        {
            _boldReportsService = boldReportsService ?? throw new ArgumentNullException(nameof(boldReportsService));
            _settings = settings ?? throw new ArgumentNullException(nameof(settings));
            _cacheService = cacheService ?? throw new ArgumentNullException(nameof(cacheService));
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
                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    Logger.LogWarning("No token provided in Authorization header for viewer settings");
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var reportRootUrl = _settings.ReportRootUrl;
                var reportsSiteIdentifier = _settings.ReportsSiteIdentifier;

                var viewerSettings = new
                {
                    token = token,
                    serviceUrl = $"{reportRootUrl}/reportservice/api/Viewer",
                    serverUrl = $"{reportRootUrl}/api/site/{reportsSiteIdentifier}",
                    reportRootUrl = reportRootUrl
                };

                Logger.LogInformation("Viewer settings retrieved successfully");
                return Ok(ApiResponse<dynamic>.SuccessResponse((dynamic)viewerSettings, "Viewer settings retrieved successfully"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error retrieving viewer settings");
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to retrieve viewer settings"));
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

                // Try to get from cache first
                var requestToken = GetTokenFromRequest();
                var userEmail = GetEmailFromToken(requestToken) ?? "manoranjan.rajendran@syncfusion.com";
                var cacheKey = $"report-tree-{userEmail}";
                var cachedTree = await _cacheService.GetAsync<dynamic>(cacheKey);
                
                if (cachedTree != null)
                {
                    Logger.LogInformation("Report tree retrieved from cache");
                    return Ok(ApiResponse<dynamic>.SuccessResponse(cachedTree, "Report tree retrieved successfully"));
                }

                var reports = await _boldReportsService.GetReportsAsync(token);
                
                // Group reports by category
                var tree = reports
                    .GroupBy(r => r.CategoryName ?? "Uncategorized")
                    .Select(g => new
                    {
                        Id = g.Key.ToLower().Replace(" ", "-"),
                        Name = g.Key,
                        Reports = g.Select(r => new
                        {
                            r.Id,
                            r.Name,
                            r.Description,
                            r.CanRead,
                            r.CanWrite,
                            CreatedById = r.CreatedById,
                            IsPublic = r.IsPublic
                        }).ToList()
                    })
                    .ToList();

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
                    var userEmail = GetEmailFromToken(requestToken) ?? "manoranjan.rajendran@syncfusion.com";
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
