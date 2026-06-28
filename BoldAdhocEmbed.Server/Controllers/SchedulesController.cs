using Microsoft.AspNetCore.Mvc;
using BoldAdhocEmbed.Server.Services;
using Newtonsoft.Json;
using BoldAdhocEmbed.Server.Models;

namespace BoldAdhocEmbed.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SchedulesController : BaseController
    {
        private readonly IBoldReportsService _boldReportsService;
        private readonly IBoldBIDashboardService _boldBIDashboardService;
        private readonly ILogger<SchedulesController> _logger;
        private readonly ICacheService _cacheService;

        public SchedulesController(
            IBoldReportsService boldReportsService,
            IBoldBIDashboardService boldBIDashboardService,
            ILogger<SchedulesController> logger,
            ICacheService cacheService)
            : base(logger)
        {
            _boldReportsService = boldReportsService ?? throw new ArgumentNullException(nameof(boldReportsService));
            _boldBIDashboardService = boldBIDashboardService ?? throw new ArgumentNullException(nameof(boldBIDashboardService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _cacheService = cacheService ?? throw new ArgumentNullException(nameof(cacheService));
        }

        [HttpGet]
        [HttpGet("GetSchedules")]
        public async Task<ActionResult<ApiResponse<dynamic>>> GetSchedules()
        {
            try
            {
                // Get token from the authenticated user's request
                // User will only see schedules they have access to (RLS)
                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogWarning("No token provided in Authorization header for GetSchedules");
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                // Check cache first
                var requestToken = GetTokenFromRequest();
                var userEmail = GetEmailFromToken(requestToken) ?? "manoranjan.rajendran@syncfusion.com";
                var cacheKey = $"schedules-list-{userEmail}";
                var cachedSchedules = await _cacheService.GetAsync<dynamic>(cacheKey);
                if (cachedSchedules != null)
                {
                    _logger.LogInformation("Enriched schedules list retrieved from cache");
                    return Ok(ApiResponse<dynamic>.SuccessResponse(cachedSchedules, "Retrieved schedules"));
                }

                var schedules = await _boldReportsService.GetSchedulesAsync(token);
                schedules ??= new List<BoldSchedule>();

                // Fetch details for each schedule in parallel and enrich
                var tasks = schedules.Select(async s =>
                {
                    var idOrName = s.Id ?? s.Name ?? string.Empty;
                    var d = await _boldReportsService.GetScheduleDetailAsync(token, idOrName);
                    return new { s, d };
                }).ToList();

                var results = await Task.WhenAll(tasks);

                var enriched = results.Select(x => new
                {
                    id = x.s.Id,
                    name = x.s.Name ?? x.d?.ScheduleName,
                    description = x.s.Description,
                    categoryName = x.s.CategoryName ?? "Reports Schedules",
                    itemId = x.s.ItemId,
                    itemType = "Report",
                    enabled = x.s.Enabled ?? x.d?.IsEnabled,
                    exportType = x.s.ExportType ?? x.d?.ExportTypeCode,
                    // Detail fields
                    reportName = x.d?.ReportName ?? x.s.Name,
                    recurrenceType = x.d?.RecurrenceType,
                    recurrenceTypeId = x.d?.RecurrenceTypeId,
                    nextSchedule = x.d?.NextSchedule,
                    startDate = x.d?.StartDate,
                    endDate = x.d?.EndDate,
                    neverEnd = x.d?.NeverEnd,
                    recipients = new
                    {
                        users = x.d?.UserList?.Count ?? 0,
                        groups = x.d?.GroupList?.Count ?? 0,
                        external = x.d?.ExternalRecipientsList?.Count ?? 0
                    }
                }).Cast<dynamic>().ToList();

                // 2. Fetch Dashboard Schedules (new logic)
                try
                {
                    var biToken = await _boldBIDashboardService.GetTokenAsync(userEmail);
                    if (!string.IsNullOrEmpty(biToken))
                    {
                        var biSchedules = await _boldBIDashboardService.GetSchedulesAsync(biToken);
                        if (biSchedules != null && biSchedules.Count > 0)
                        {
                            foreach (var bs in biSchedules)
                            {
                                string bsId = bs.Id?.ToString() ?? bs.ScheduleId?.ToString() ?? string.Empty;
                                string bsName = bs.Name?.ToString() ?? bs.ScheduleName?.ToString() ?? string.Empty;
                                string bsDescription = bs.Description?.ToString() ?? string.Empty;
                                string bsItemId = bs.ItemId?.ToString() ?? bs.DashboardId?.ToString() ?? string.Empty;
                                string bsItemName = bs.ItemName?.ToString() ?? bs.DashboardName?.ToString() ?? bsName;
                                bool bsEnabled = bs.IsEnabled != null ? (bool)bs.IsEnabled : (bs.Enabled != null ? (bool)bs.Enabled : true);
                                string bsExportType = bs.ExportType?.ToString() ?? bs.ExportTypeCode?.ToString() ?? "Pdf";
                                string bsRecurrenceType = bs.RecurrenceType?.ToString() ?? bs.ScheduleType?.ToString() ?? "Hourly";
                                string bsNextSchedule = bs.NextSchedule?.ToString() ?? string.Empty;
                                string bsStartDate = bs.StartDate?.ToString() ?? bs.StartTime?.ToString() ?? string.Empty;
                                string bsEndDate = bs.EndDate?.ToString() ?? string.Empty;
                                bool bsNeverEnd = bs.NeverEnd != null ? (bool)bs.NeverEnd : true;

                                enriched.Add(new
                                {
                                    id = bsId,
                                    name = bsName,
                                    description = bsDescription,
                                    categoryName = "Dashboard Schedules",
                                    itemId = bsItemId,
                                    itemType = "Dashboard",
                                    enabled = bsEnabled,
                                    exportType = bsExportType,
                                    reportName = bsItemName,
                                    recurrenceType = bsRecurrenceType,
                                    recurrenceTypeId = 0,
                                    nextSchedule = bsNextSchedule,
                                    startDate = bsStartDate,
                                    endDate = bsEndDate,
                                    neverEnd = bsNeverEnd,
                                    recipients = new
                                    {
                                        users = 0,
                                        groups = 0,
                                        external = 0
                                    }
                                });
                            }
                        }
                    }
                }
                catch (Exception biEx)
                {
                    _logger.LogWarning(biEx, "Failed to fetch/merge Bold BI dashboard schedules");
                }

                _logger.LogInformation("Retrieved {ScheduleCount} schedules for authenticated user", enriched.Count);
                
                // Cache for 5 minutes
                await _cacheService.SetAsync(cacheKey, (dynamic)enriched, TimeSpan.FromMinutes(5));

                return Ok(ApiResponse<dynamic>.SuccessResponse(enriched, $"Retrieved {enriched.Count} schedules"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving schedules");
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to retrieve schedules"));
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<dynamic>>> GetSchedule(string id)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(id))
                {
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse("Invalid Request", "Schedule ID is required"));
                }

                // Get token from the authenticated user's request
                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogWarning("No token provided for getting schedule {ScheduleId}", id);
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var schedule = await _boldReportsService.GetScheduleDetailAsync(token, id);
                if (schedule == null)
                {
                    _logger.LogWarning("Schedule not found or access denied: {ScheduleId}", id);
                    return NotFound(ApiResponse<dynamic>.ErrorResponse("Not Found", $"Schedule with ID '{id}' not found or you don't have access"));
                }

                var scheduleData = new
                {
                    schedule.Id,
                    schedule.Name,
                    schedule.Description,
                    schedule.CategoryName,
                    schedule.ItemId,
                    schedule.ItemType,
                    schedule.Enabled,
                    ExportType = schedule.ExportType ?? schedule.ExportTypeCode,
                    RecurrenceType = schedule.RecurrenceType,
                    schedule.StartDate,
                    schedule.NeverEnd,
                    schedule.EndAfterOccurrence,
                    schedule.EndDate,
                    schedule.NextSchedule
                };

                _logger.LogInformation("Schedule {ScheduleId} retrieved successfully", id);
                return Ok(ApiResponse<dynamic>.SuccessResponse(scheduleData, "Schedule retrieved successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving schedule {ScheduleId}", id);
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to retrieve schedule"));
            }
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse>> CreateSchedule([FromBody] CreateScheduleRequest request)
        {
            try
            {
                // Get token from the authenticated user's request
                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogWarning("No token provided for creating schedule");
                    return Unauthorized(ApiResponse.UnauthorizedResponse());
                }

                // Placeholder: legacy route not used
                return StatusCode(501, ApiResponse.ErrorResponse("Not Implemented", "Use /api/schedules/Create for v5.0 schedule creation"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in CreateSchedule");
                return StatusCode(500, ApiResponse.ErrorResponse(ex.Message, "Failed to create schedule"));
            }
        }

        /// <summary>
        /// Create schedule using v5.0 API
        /// User must have permissions to create schedules (RLS enforced by Bold Reports)
        /// </summary>
        [HttpPost("Create")]
        public async Task<ActionResult<ApiResponse>> Create([FromBody] System.Text.Json.JsonElement payload)
        {
            try
            {
                if (payload.ValueKind == System.Text.Json.JsonValueKind.Null || payload.ValueKind == System.Text.Json.JsonValueKind.Undefined)
                {
                    return BadRequest(ApiResponse.ErrorResponse("Invalid Request", "Schedule payload is required"));
                }

                var requestToken = GetTokenFromRequest();
                var userEmail = GetEmailFromToken(requestToken) ?? "manoranjan.rajendran@syncfusion.com";

                // Log the incoming payload as JSON so we can inspect fields
                try
                {
                    var raw = payload.GetRawText();
                    _logger.LogInformation("Create schedule payload received: {Payload}", raw);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to serialize schedule payload for logging");
                }

                // Check if it is a dashboard schedule
                bool isDashboard = false;
                if (payload.TryGetProperty("ItemType", out var itemTypeProp) || payload.TryGetProperty("itemType", out itemTypeProp))
                {
                    var val = itemTypeProp.GetString();
                    if (string.Equals(val, "Dashboard", StringComparison.OrdinalIgnoreCase))
                    {
                        isDashboard = true;
                    }
                }

                if (isDashboard)
                {
                    var biToken = await _boldBIDashboardService.GetTokenAsync(userEmail);
                    if (string.IsNullOrEmpty(biToken))
                    {
                        return Unauthorized(ApiResponse.ErrorResponse("Unauthorized to access Dashboard Service"));
                    }

                    var (ok, statusCode, respBody) = await _boldBIDashboardService.CreateScheduleAsync(biToken, payload.GetRawText());
                    if (!ok || statusCode < 200 || statusCode >= 300)
                    {
                        _logger.LogWarning("Failed to create dashboard schedule - external API returned {StatusCode}: {Response}", statusCode, respBody);
                        var message = string.IsNullOrWhiteSpace(respBody) ? "Failed to create dashboard schedule - you may not have permission" : respBody;
                        return StatusCode(502, ApiResponse.ErrorResponse("External API Error", message));
                    }

                    _logger.LogInformation("Successfully created dashboard schedule for authenticated user");
                    
                    // Invalidate schedules cache
                    var cacheKey = $"schedules-list-{userEmail}";
                    await _cacheService.RemoveAsync(cacheKey);

                    return Ok(ApiResponse.SuccessResponse("Dashboard schedule created successfully"));
                }
                else
                {
                    var token = await GetBoldReportsTokenAsync(_boldReportsService);
                    if (string.IsNullOrEmpty(token))
                    {
                        _logger.LogWarning("No token provided for creating schedule");
                        return Unauthorized(ApiResponse.UnauthorizedResponse());
                    }

                    var (ok, statusCode, respBody) = await _boldReportsService.CreateScheduleAsync(token, payload.GetRawText());
                    if (!ok || statusCode < 200 || statusCode >= 300)
                    {
                        _logger.LogWarning("Failed to create schedule - external API returned {StatusCode}: {Response}", statusCode, respBody);
                        var message = string.IsNullOrWhiteSpace(respBody) ? "Failed to create schedule - you may not have permission" : respBody;
                        return StatusCode(502, ApiResponse.ErrorResponse("External API Error", message));
                    }

                    _logger.LogInformation("Successfully created schedule for authenticated user");
                    
                    // Invalidate schedules cache
                    var cacheKey = $"schedules-list-{userEmail}";
                    await _cacheService.RemoveAsync(cacheKey);

                    return Ok(ApiResponse.SuccessResponse("Schedule created successfully"));
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating schedule");
                return StatusCode(500, ApiResponse.ErrorResponse(ex.Message, "Failed to create schedule"));
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse>> UpdateSchedule(string id, [FromBody] System.Text.Json.JsonElement payload)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(id))
                {
                    return BadRequest(ApiResponse.ErrorResponse("Invalid Request", "Schedule ID is required"));
                }

                if (payload.ValueKind == System.Text.Json.JsonValueKind.Null || payload.ValueKind == System.Text.Json.JsonValueKind.Undefined)
                {
                    return BadRequest(ApiResponse.ErrorResponse("Invalid Request", "Schedule payload is required"));
                }

                var requestToken = GetTokenFromRequest();
                var userEmail = GetEmailFromToken(requestToken) ?? "manoranjan.rajendran@syncfusion.com";

                // Log payload for debugging similar to Create
                try
                {
                    var raw = payload.GetRawText();
                    _logger.LogInformation("Update schedule payload received for {ScheduleId}: {Payload}", id, raw);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to serialize update payload for logging");
                }

                // Check if it is a dashboard schedule
                bool isDashboard = false;
                if (payload.TryGetProperty("ItemType", out var itemTypeProp) || payload.TryGetProperty("itemType", out itemTypeProp))
                {
                    var val = itemTypeProp.GetString();
                    if (string.Equals(val, "Dashboard", StringComparison.OrdinalIgnoreCase))
                    {
                        isDashboard = true;
                    }
                }

                if (isDashboard)
                {
                    var biToken = await _boldBIDashboardService.GetTokenAsync(userEmail);
                    if (string.IsNullOrEmpty(biToken))
                    {
                        return Unauthorized(ApiResponse.ErrorResponse("Unauthorized to access Dashboard Service"));
                    }

                    var (ok, statusCode, respBody) = await _boldBIDashboardService.UpdateScheduleAsync(biToken, id, payload.GetRawText());
                    if (!ok || statusCode < 200 || statusCode >= 300)
                    {
                        _logger.LogWarning("Failed to update dashboard schedule - external API returned {StatusCode}: {Response}", statusCode, respBody);
                        var message = string.IsNullOrWhiteSpace(respBody) ? "Failed to update dashboard schedule - you may not have permission" : respBody;
                        return StatusCode(502, ApiResponse.ErrorResponse("External API Error", message));
                    }

                    _logger.LogInformation("Successfully updated dashboard schedule {ScheduleId}", id);
                }
                else
                {
                    var token = await GetBoldReportsTokenAsync(_boldReportsService);
                    if (string.IsNullOrEmpty(token))
                    {
                        _logger.LogWarning("No token provided for updating schedule {ScheduleId}", id);
                        return Unauthorized(ApiResponse.UnauthorizedResponse());
                    }

                    var (ok, statusCode, respBody) = await _boldReportsService.UpdateScheduleAsync(token, id, payload.GetRawText());
                    if (!ok || statusCode < 200 || statusCode >= 300)
                    {
                        _logger.LogWarning("Failed to update schedule - external API returned {StatusCode}: {Response}", statusCode, respBody);
                        var message = string.IsNullOrWhiteSpace(respBody) ? "Failed to update schedule - you may not have permission" : respBody;
                        return StatusCode(502, ApiResponse.ErrorResponse("External API Error", message));
                    }

                    _logger.LogInformation("Successfully updated schedule {ScheduleId}", id);
                }
                
                // Invalidate schedules cache
                var cacheKey = $"schedules-list-{userEmail}";
                await _cacheService.RemoveAsync(cacheKey);

                return Ok(ApiResponse.SuccessResponse("Schedule updated successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating schedule {ScheduleId}", id);
                return StatusCode(500, ApiResponse.ErrorResponse(ex.Message, "Failed to update schedule"));
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse>> DeleteSchedule(string id)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(id))
                {
                    return BadRequest(ApiResponse.ErrorResponse("Invalid Request", "Schedule ID is required"));
                }

                var requestToken = GetTokenFromRequest();
                var userEmail = GetEmailFromToken(requestToken) ?? "manoranjan.rajendran@syncfusion.com";

                var ok = false;
                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (!string.IsNullOrEmpty(token))
                {
                    ok = await _boldReportsService.DeleteScheduleAsync(token, id);
                }

                if (!ok)
                {
                    // Fallback: try deleting from Bold BI dashboard schedules
                    var biToken = await _boldBIDashboardService.GetTokenAsync(userEmail);
                    if (!string.IsNullOrEmpty(biToken))
                    {
                        ok = await _boldBIDashboardService.DeleteScheduleAsync(biToken, id);
                    }
                }

                if (!ok)
                {
                    _logger.LogWarning("Failed to delete schedule {ScheduleId} - external API returned failure or user may not have permission", id);
                    return StatusCode(502, ApiResponse.ErrorResponse("External API Error", "Failed to delete schedule - you may not have permission"));
                }

                _logger.LogInformation("Successfully deleted schedule {ScheduleId}", id);
                
                // Invalidate schedules cache
                var cacheKey = $"schedules-list-{userEmail}";
                await _cacheService.RemoveAsync(cacheKey);

                return Ok(ApiResponse.SuccessResponse("Schedule deleted successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting schedule {ScheduleId}", id);
                return StatusCode(500, ApiResponse.ErrorResponse(ex.Message, "Failed to delete schedule"));
            }
        }

        /// <summary>
        /// Run schedule immediately
        /// User must have permissions to run the schedule (RLS enforced by Bold Reports)
        /// </summary>
        [HttpPost("RunNow/{id}")]
        public async Task<ActionResult<ApiResponse>> RunNow(string id)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(id))
                {
                    return BadRequest(ApiResponse.ErrorResponse("Invalid Request", "Schedule ID is required"));
                }

                // Get token from the authenticated user's request
                // User must have permissions to run the schedule
                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogWarning("No token provided for running schedule {ScheduleId}", id);
                    return Unauthorized(ApiResponse.UnauthorizedResponse());
                }

                var ok = await _boldReportsService.RunScheduleNowAsync(token, id);
                if (!ok)
                {
                    _logger.LogWarning("Failed to trigger schedule run for {ScheduleId} - user may not have permission", id);
                    return StatusCode(502, ApiResponse.ErrorResponse("External API Error", "Failed to trigger schedule run - you may not have permission"));
                }

                _logger.LogInformation("Successfully triggered schedule run for {ScheduleId}", id);
                return Ok(ApiResponse.SuccessResponse("Schedule run started successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error running schedule {ScheduleId}", id);
                return StatusCode(500, ApiResponse.ErrorResponse(ex.Message, "Failed to run schedule"));
            }
        }
    }

    public class CreateScheduleRequest
    {
        public string ReportName { get; set; }
        public string Frequency { get; set; }
        public string Recipients { get; set; }
    }

    public class UpdateScheduleRequest
    {
        public string ReportName { get; set; }
        public string Frequency { get; set; }
        public string Recipients { get; set; }
        public string Status { get; set; }
    }
}
