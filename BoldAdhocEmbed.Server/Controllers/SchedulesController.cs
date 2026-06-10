using Microsoft.AspNetCore.Mvc;
using BoldAdhocEmbed.Server.Services;
using Newtonsoft.Json;
using BoldAdhocEmbed.Server.Models;

namespace BoldAdhocEmbed.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SchedulesController : ControllerBase
    {
        private readonly IBoldReportsService _boldReportsService;
        private readonly ILogger<SchedulesController> _logger;

        public SchedulesController(
            IBoldReportsService boldReportsService,
            ILogger<SchedulesController> logger)
        {
            _boldReportsService = boldReportsService ?? throw new ArgumentNullException(nameof(boldReportsService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Extract token from Authorization header (Bearer token format)
        /// </summary>
        private string GetTokenFromRequest()
        {
            var authHeader = Request.Headers["Authorization"].ToString();
            if (string.IsNullOrEmpty(authHeader))
            {
                return null;
            }

            // Format: "Bearer eyJ0eXAi..."
            if (authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                return authHeader.Substring("Bearer ".Length).Trim();
            }

            return authHeader;
        }

        [HttpGet]
        [HttpGet("GetSchedules")]
        public async Task<ActionResult<ApiResponse<dynamic>>> GetSchedules()
        {
            try
            {
                // Get token from the authenticated user's request
                // User will only see schedules they have access to (RLS)
                var token = GetTokenFromRequest();
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogWarning("No token provided in Authorization header for GetSchedules");
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
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
                    categoryName = x.s.CategoryName,
                    itemId = x.s.ItemId,
                    itemType = x.s.ItemType,
                    enabled = x.s.Enabled ?? x.d?.IsEnabled,
                    exportType = x.s.ExportType ?? x.d?.ExportTypeCode,
                    // Detail fields
                    reportName = x.d?.ReportName,
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
                }).ToList();

                _logger.LogInformation("Retrieved {ScheduleCount} schedules for authenticated user", enriched.Count);
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
                var token = GetTokenFromRequest();
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
                var token = GetTokenFromRequest();
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

                // Get token from the authenticated user's request
                // User must have permissions to create schedules
                var token = GetTokenFromRequest();
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogWarning("No token provided for creating schedule");
                    return Unauthorized(ApiResponse.UnauthorizedResponse());
                }

                // Log the incoming payload as JSON so we can inspect fields (acts like a breakpoint)
                try
                {
                    // Log raw JSON received for better debugging
                    var raw = payload.GetRawText();
                    _logger.LogInformation("Create schedule payload received: {Payload}", raw);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to serialize schedule payload for logging");
                }

                // Forward the raw JSON string to the service so it is posted unchanged
                var (ok, statusCode, respBody) = await _boldReportsService.CreateScheduleAsync(token, payload.GetRawText());
                if (!ok || statusCode < 200 || statusCode >= 300)
                {
                    _logger.LogWarning("Failed to create schedule - external API returned {StatusCode}: {Response}", statusCode, respBody);
                    var message = string.IsNullOrWhiteSpace(respBody) ? "Failed to create schedule - you may not have permission" : respBody;
                    return StatusCode(502, ApiResponse.ErrorResponse("External API Error", message));
                }

                _logger.LogInformation("Successfully created schedule for authenticated user");
                return Ok(ApiResponse.SuccessResponse("Schedule created successfully"));
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

                // Get token from the authenticated user's request
                var token = GetTokenFromRequest();
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogWarning("No token provided for updating schedule {ScheduleId}", id);
                    return Unauthorized(ApiResponse.UnauthorizedResponse());
                }

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

                // Forward raw JSON to Bold Reports service to perform update
                var (ok, statusCode, respBody) = await _boldReportsService.UpdateScheduleAsync(token, id, payload.GetRawText());
                if (!ok || statusCode < 200 || statusCode >= 300)
                {
                    _logger.LogWarning("Failed to update schedule - external API returned {StatusCode}: {Response}", statusCode, respBody);
                    var message = string.IsNullOrWhiteSpace(respBody) ? "Failed to update schedule - you may not have permission" : respBody;
                    return StatusCode(502, ApiResponse.ErrorResponse("External API Error", message));
                }

                _logger.LogInformation("Successfully updated schedule {ScheduleId}", id);
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

                // Get token from the authenticated user's request
                var token = GetTokenFromRequest();
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogWarning("No token provided for deleting schedule {ScheduleId}", id);
                    return Unauthorized(ApiResponse.UnauthorizedResponse());
                }

                var ok = await _boldReportsService.DeleteScheduleAsync(token, id);
                if (!ok)
                {
                    _logger.LogWarning("Failed to delete schedule {ScheduleId} - external API returned failure or user may not have permission", id);
                    return StatusCode(502, ApiResponse.ErrorResponse("External API Error", "Failed to delete schedule - you may not have permission"));
                }

                _logger.LogInformation("Successfully deleted schedule {ScheduleId}", id);
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
                var token = GetTokenFromRequest();
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
