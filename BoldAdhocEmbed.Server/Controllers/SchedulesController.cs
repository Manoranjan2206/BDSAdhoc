using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BoldAdhocEmbed.Server.Services;
using Newtonsoft.Json;
using BoldAdhocEmbed.Server.Models;
using System.Text.RegularExpressions;

namespace BoldAdhocEmbed.Server.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class SchedulesController : BaseController
    {
        private readonly IBoldReportsService _boldReportsService;
        private readonly IBoldBIDashboardService _boldBIDashboardService;
        private readonly ILogger<SchedulesController> _logger;
        private readonly ICacheService _cacheService;
        private readonly IAuthenticatedUser _auth;
        private readonly ICrmDataService _crmDataService;

        private static readonly string[] KnownTenants = { "AlphaCorp", "BetaSolutions", "GammaIndustries", "DeltaEnterprises" };

        public SchedulesController(
            IBoldReportsService boldReportsService,
            IBoldBIDashboardService boldBIDashboardService,
            ILogger<SchedulesController> logger,
            ICacheService cacheService,
            IAuthenticatedUser auth,
            ICrmDataService crmDataService)
            : base(logger)
        {
            _boldReportsService = boldReportsService ?? throw new ArgumentNullException(nameof(boldReportsService));
            _boldBIDashboardService = boldBIDashboardService ?? throw new ArgumentNullException(nameof(boldBIDashboardService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _cacheService = cacheService ?? throw new ArgumentNullException(nameof(cacheService));
            _auth = auth ?? throw new ArgumentNullException(nameof(auth));
            _crmDataService = crmDataService ?? throw new ArgumentNullException(nameof(crmDataService));
        }

        private string ResolveTenantName(AuthUserContext? auth)
        {
            if (!string.IsNullOrWhiteSpace(auth?.TenantName)) return auth.TenantName;
            var email = auth?.Email ?? "";
            if (email.Contains("alpha", StringComparison.OrdinalIgnoreCase)) return "AlphaCorp";
            if (email.Contains("beta", StringComparison.OrdinalIgnoreCase)) return "BetaSolutions";
            if (email.Contains("gamma", StringComparison.OrdinalIgnoreCase)) return "GammaIndustries";
            if (email.Contains("delta", StringComparison.OrdinalIgnoreCase)) return "DeltaEnterprises";
            return "AlphaCorp";
        }

        private static string StripTenantPrefix(string name, string tenantName)
        {
            if (string.IsNullOrWhiteSpace(name)) return "";
            if (name.StartsWith($"{tenantName}_", StringComparison.OrdinalIgnoreCase))
            {
                return name.Substring(tenantName.Length + 1);
            }
            foreach (var t in KnownTenants)
            {
                if (name.StartsWith($"{t}_", StringComparison.OrdinalIgnoreCase))
                {
                    return name.Substring(t.Length + 1);
                }
            }
            return name;
        }

        private static string StripTenantTags(string? description)
        {
            if (string.IsNullOrWhiteSpace(description)) return "";
            var cleaned = Regex.Replace(description, @"\[Tenant:[^\]]*\]", "", RegexOptions.IgnoreCase);
            cleaned = Regex.Replace(cleaned, @"\[Owner:[^\]]*\]", "", RegexOptions.IgnoreCase);
            return cleaned.Trim();
        }

        [HttpGet]
        [HttpGet("GetSchedules")]
        public async Task<ActionResult<ApiResponse<dynamic>>> GetSchedules()
        {
            try
            {
                var authUser = _auth.GetAuthContext();
                var userEmail = authUser?.Email ?? "";
                var tenantName = ResolveTenantName(authUser);

                // Get token from the authenticated user's request
                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogWarning("No token provided in Authorization header for GetSchedules");
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                // Check cache first (tenant-isolated cache key)
                var cacheKey = $"schedules-list-{tenantName}-{userEmail}";
                var cachedSchedules = await _cacheService.GetAsync<dynamic>(cacheKey);
                if (cachedSchedules != null)
                {
                    _logger.LogInformation("Enriched schedules list retrieved from cache for tenant {Tenant}", tenantName);
                    return Ok(ApiResponse<dynamic>.SuccessResponse(cachedSchedules, "Retrieved schedules"));
                }

                // Fetch registered schedules from PostgreSQL for this tenant
                List<TenantScheduleDto> dbSchedules = new();
                if (authUser != null)
                {
                    try
                    {
                        dbSchedules = await _crmDataService.GetTenantSchedulesAsync(authUser);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to load tenant schedules from DB for {Tenant}", tenantName);
                    }
                }

                var dbScheduleIds = new HashSet<string>(dbSchedules.Select(s => s.ScheduleId).Where(s => !string.IsNullOrEmpty(s)), StringComparer.OrdinalIgnoreCase);
                var dbScheduleNames = new HashSet<string>(dbSchedules.Select(s => s.ScheduleName).Where(s => !string.IsNullOrEmpty(s)), StringComparer.OrdinalIgnoreCase);
                var dbServerScheduleNames = new HashSet<string>(dbSchedules.Select(s => s.ServerScheduleName ?? "").Where(s => !string.IsNullOrEmpty(s)), StringComparer.OrdinalIgnoreCase);

                bool BelongsToTenant(string? name, string? desc, string? id, List<string>? recipients)
                {
                    var n = name ?? "";
                    var d = desc ?? "";
                    var i = id ?? "";

                    // 1. Explicit tag in description
                    if (d.Contains($"[Tenant: {tenantName}]", StringComparison.OrdinalIgnoreCase))
                        return true;

                    // 2. Name starts with this tenant's prefix
                    if (n.StartsWith($"{tenantName}_", StringComparison.OrdinalIgnoreCase))
                        return true;

                    // 3. Registered in this tenant's PostgreSQL database
                    if ((!string.IsNullOrEmpty(i) && dbScheduleIds.Contains(i)) ||
                        (!string.IsNullOrEmpty(n) && (dbScheduleNames.Contains(n) || dbServerScheduleNames.Contains(n))))
                        return true;

                    // 4. Tagged for another tenant -> STRICTLY EXCLUDE
                    if (d.Contains("[Tenant:", StringComparison.OrdinalIgnoreCase))
                        return false;

                    if (KnownTenants.Any(t => !string.Equals(t, tenantName, StringComparison.OrdinalIgnoreCase) && n.StartsWith($"{t}_", StringComparison.OrdinalIgnoreCase)))
                        return false;

                    // 5. Check recipients email domain if available
                    if (recipients != null && recipients.Count > 0)
                    {
                        var tenantLower = tenantName.ToLowerInvariant();
                        if (recipients.Any(r => r.ToLowerInvariant().Contains(tenantLower)))
                            return true;
                        // If recipients belong to another tenant, exclude
                        if (recipients.Any(r => KnownTenants.Any(kt => !string.Equals(kt, tenantName, StringComparison.OrdinalIgnoreCase) && r.ToLowerInvariant().Contains(kt.ToLowerInvariant()))))
                            return false;
                    }

                    // 6. Legacy untagged schedule: only assign to AlphaCorp if caller is AlphaCorp
                    if (string.Equals(tenantName, "AlphaCorp", StringComparison.OrdinalIgnoreCase))
                        return true;

                    return false;
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

                var enriched = new List<dynamic>();

                foreach (var x in results)
                {
                    var schedName = x.s.Name ?? x.d?.ScheduleName ?? "";
                    var schedDesc = x.s.Description ?? x.d?.Description ?? "";
                    var schedId = x.s.Id ?? x.d?.ScheduleId ?? "";
                    var recipientsList = x.d?.ExternalRecipientsList;

                    if (!BelongsToTenant(schedName, schedDesc, schedId, recipientsList))
                    {
                        continue;
                    }

                    var displayName = StripTenantPrefix(schedName, tenantName);
                    var cleanDesc = StripTenantTags(schedDesc);

                    enriched.Add(new
                    {
                        id = x.s.Id,
                        name = displayName,
                        serverScheduleName = schedName,
                        description = cleanDesc,
                        categoryName = x.s.CategoryName ?? "Reports Schedules",
                        itemId = x.s.ItemId,
                        itemType = "Report",
                        enabled = x.s.Enabled ?? x.d?.IsEnabled,
                        exportType = x.s.ExportType ?? x.d?.ExportTypeCode,
                        reportName = StripTenantPrefix(x.d?.ReportName ?? x.s.Name ?? "", tenantName),
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
                        },
                        externalRecipientsList = x.d?.ExternalRecipientsList ?? new List<string>()
                    });
                }

                // 2. Fetch Dashboard Schedules
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

                                if (!BelongsToTenant(bsName, bsDescription, bsId, null))
                                {
                                    continue;
                                }

                                var displayName = StripTenantPrefix(bsName, tenantName);
                                var cleanDesc = StripTenantTags(bsDescription);

                                enriched.Add(new
                                {
                                    id = bsId,
                                    name = displayName,
                                    serverScheduleName = bsName,
                                    description = cleanDesc,
                                    categoryName = "Dashboard Schedules",
                                    itemId = bsItemId,
                                    itemType = "Dashboard",
                                    enabled = bsEnabled,
                                    exportType = bsExportType,
                                    reportName = StripTenantPrefix(bsItemName, tenantName),
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
                                    },
                                    externalRecipientsList = new List<string>()
                                });
                            }
                        }
                    }
                }
                catch (Exception biEx)
                {
                    _logger.LogWarning(biEx, "Failed to fetch/merge Bold BI dashboard schedules");
                }

                // 3. Fallback: ensure any schedules saved in PostgreSQL for this tenant are represented
                var returnedIds = new HashSet<string>(enriched.Select(e => ((object)e.id)?.ToString() ?? ""), StringComparer.OrdinalIgnoreCase);
                var returnedNames = new HashSet<string>(enriched.Select(e => ((object)e.name)?.ToString() ?? ""), StringComparer.OrdinalIgnoreCase);

                foreach (var dbs in dbSchedules)
                {
                    if (!returnedIds.Contains(dbs.ScheduleId) && !returnedNames.Contains(dbs.ScheduleName))
                    {
                        enriched.Add(new
                        {
                            id = dbs.ScheduleId,
                            name = dbs.ScheduleName,
                            serverScheduleName = dbs.ServerScheduleName,
                            description = dbs.Description ?? "",
                            categoryName = dbs.CategoryName ?? (dbs.ItemType == "Dashboard" ? "Dashboard Schedules" : "Reports Schedules"),
                            itemId = dbs.ItemId,
                            itemType = dbs.ItemType,
                            enabled = dbs.IsEnabled,
                            exportType = dbs.ExportType ?? "Pdf",
                            reportName = dbs.ItemName ?? dbs.ScheduleName,
                            recurrenceType = dbs.RecurrenceType ?? "Daily",
                            recurrenceTypeId = 0,
                            nextSchedule = string.Empty,
                            startDate = string.Empty,
                            endDate = string.Empty,
                            neverEnd = true,
                            recipients = new
                            {
                                users = 0,
                                groups = 0,
                                external = 0
                            },
                            externalRecipientsList = new List<string>()
                        });
                    }
                }

                _logger.LogInformation("Retrieved {ScheduleCount} tenant-isolated schedules for tenant {Tenant}", enriched.Count, tenantName);

                // Cache for 5 minutes per tenant
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

                var authUser = _auth.GetAuthContext();
                var tenantName = ResolveTenantName(authUser);

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
                    Name = StripTenantPrefix(schedule.Name ?? schedule.ScheduleName ?? "", tenantName),
                    ServerScheduleName = schedule.Name ?? schedule.ScheduleName,
                    Description = StripTenantTags(schedule.Description),
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
                    schedule.NextSchedule,
                    schedule.ExternalRecipientsList
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

        /// <summary>
        /// Create schedule using v5.0 API with tenant isolation
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

                var authUser = _auth.GetAuthContext();
                var userEmail = authUser?.Email ?? "";
                var tenantName = ResolveTenantName(authUser);

                var dict = JsonConvert.DeserializeObject<Dictionary<string, object>>(payload.GetRawText())
                           ?? new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);

                // Resolve clean schedule name and server schedule name
                string cleanScheduleName = "";
                if (dict.TryGetValue("Name", out var nVal) && nVal != null)
                {
                    cleanScheduleName = nVal.ToString()!.Trim();
                }
                else if (dict.TryGetValue("ScheduleName", out var snVal) && snVal != null)
                {
                    cleanScheduleName = snVal.ToString()!.Trim();
                }

                if (string.IsNullOrWhiteSpace(cleanScheduleName))
                {
                    return BadRequest(ApiResponse.ErrorResponse("Invalid Request", "Schedule Name is required"));
                }

                cleanScheduleName = StripTenantPrefix(cleanScheduleName, tenantName);
                var serverScheduleName = $"{tenantName}_{cleanScheduleName}";
                dict["Name"] = serverScheduleName;
                if (dict.ContainsKey("ScheduleName")) dict["ScheduleName"] = serverScheduleName;

                // Read description & inject tenant metadata tags
                string originalDesc = "";
                if (dict.TryGetValue("Description", out var dVal) && dVal != null)
                {
                    originalDesc = StripTenantTags(dVal.ToString());
                }
                var serverDescription = $"[Tenant: {tenantName}] [Owner: {userEmail}] {originalDesc}".Trim();
                dict["Description"] = serverDescription;

                // Item info
                string itemType = "Report";
                if (dict.TryGetValue("ItemType", out var itVal) && itVal != null)
                {
                    itemType = itVal.ToString()!;
                }
                bool isDashboard = string.Equals(itemType, "Dashboard", StringComparison.OrdinalIgnoreCase);

                string? itemId = dict.TryGetValue("ItemId", out var idVal) ? idVal?.ToString() : null;
                string? exportType = dict.TryGetValue("ExportType", out var expVal) ? expVal?.ToString() : "Pdf";
                string? scheduleType = dict.TryGetValue("ScheduleType", out var stVal) ? stVal?.ToString() : "Daily";
                bool isEnabled = true;
                if (dict.TryGetValue("Enabled", out var enVal) && enVal is bool b) isEnabled = b;
                // Ensure ExternalRecipientsList has at least one valid recipient
                var recipients = new List<string>();
                if (dict.TryGetValue("ExternalRecipientsList", out var erObj) && erObj != null)
                {
                    if (erObj is Newtonsoft.Json.Linq.JArray ja)
                    {
                        recipients = ja.Select(x => x.ToString().Trim()).Where(x => !string.IsNullOrEmpty(x)).ToList();
                    }
                    else if (erObj is IEnumerable<object> eo)
                    {
                        recipients = eo.Select(x => x?.ToString()?.Trim() ?? "").Where(x => !string.IsNullOrEmpty(x)).ToList();
                    }
                    else if (erObj is string es && !string.IsNullOrWhiteSpace(es))
                    {
                        recipients.AddRange(es.Split(',').Select(x => x.Trim()).Where(x => !string.IsNullOrEmpty(x)));
                    }
                }
                if (recipients.Count == 0 && !string.IsNullOrWhiteSpace(userEmail))
                {
                    recipients.Add(userEmail);
                }
                dict["ExternalRecipientsList"] = recipients;

                // Remove empty UserList and GroupList so upstream API doesn't fail with "Invalid recipients list."
                if (dict.TryGetValue("UserList", out var ulVal))
                {
                    if (ulVal is Newtonsoft.Json.Linq.JArray ulJa && ulJa.Count == 0) dict.Remove("UserList");
                    else if (ulVal is System.Collections.ICollection ulColl && ulColl.Count == 0) dict.Remove("UserList");
                }
                if (dict.TryGetValue("GroupList", out var glVal))
                {
                    if (glVal is Newtonsoft.Json.Linq.JArray glJa && glJa.Count == 0) dict.Remove("GroupList");
                    else if (glVal is System.Collections.ICollection glColl && glColl.Count == 0) dict.Remove("GroupList");
                }

                // Format recurrence schedule sub-object according to ScheduleType
                if (string.Equals(scheduleType, "Weekly", StringComparison.OrdinalIgnoreCase))
                {
                    dict.Remove("HourlySchedule");
                    dict.Remove("DailySchedule");
                    dict.Remove("MonthlySchedule");
                    dict.Remove("YearlySchedule");
                    if (!dict.ContainsKey("WeeklySchedule") || dict["WeeklySchedule"] == null)
                    {
                        dict["WeeklySchedule"] = new Dictionary<string, object>
                        {
                            ["RecurrenceWeeks"] = 1,
                            ["RecurrenceDays"] = new[] { "Monday" }
                        };
                    }
                }
                else if (string.Equals(scheduleType, "Hourly", StringComparison.OrdinalIgnoreCase))
                {
                    dict.Remove("DailySchedule");
                    dict.Remove("WeeklySchedule");
                    dict.Remove("MonthlySchedule");
                    dict.Remove("YearlySchedule");
                    if (!dict.ContainsKey("HourlySchedule") || dict["HourlySchedule"] == null)
                    {
                        dict["HourlySchedule"] = new Dictionary<string, object>
                        {
                            ["ScheduleInterval"] = "01:00"
                        };
                    }
                }
                else if (string.Equals(scheduleType, "Monthly", StringComparison.OrdinalIgnoreCase))
                {
                    dict.Remove("HourlySchedule");
                    dict.Remove("DailySchedule");
                    dict.Remove("WeeklySchedule");
                    dict.Remove("YearlySchedule");
                    if (!dict.ContainsKey("MonthlySchedule") || dict["MonthlySchedule"] == null)
                    {
                        dict["MonthlySchedule"] = new Dictionary<string, object>
                        {
                            ["RecurrenceType"] = "DayRecurrence",
                            ["DayRecurrence"] = new Dictionary<string, object>
                            {
                                ["DayInterval"] = 1,
                                ["MonthInterval"] = 1
                            }
                        };
                    }
                }
                else // Daily default
                {
                    dict.Remove("HourlySchedule");
                    dict.Remove("WeeklySchedule");
                    dict.Remove("MonthlySchedule");
                    dict.Remove("YearlySchedule");
                    if (!dict.ContainsKey("DailySchedule") || dict["DailySchedule"] == null)
                    {
                        dict["DailySchedule"] = new Dictionary<string, object>
                        {
                            ["RecurrenceType"] = "EveryNdays",
                            ["EveryNdays"] = 1,
                            ["EveryWeekday"] = false
                        };
                    }
                }

                dict["IsEmailAttachment"] = true;
                dict["IsSendAsMail"] = true;

                var finalJson = JsonConvert.SerializeObject(dict);
                _logger.LogInformation("Creating tenant schedule for {Tenant}: ServerName={ServerName}, Payload={Payload}", tenantName, serverScheduleName, finalJson);

                string createdScheduleId = serverScheduleName;

                if (isDashboard)
                {
                    var biToken = await _boldBIDashboardService.GetTokenAsync(userEmail);
                    if (string.IsNullOrEmpty(biToken))
                    {
                        return Unauthorized(ApiResponse.ErrorResponse("Unauthorized to access Dashboard Service"));
                    }

                    var (ok, statusCode, respBody) = await _boldBIDashboardService.CreateScheduleAsync(biToken, finalJson);
                    if (!ok || statusCode < 200 || statusCode >= 300)
                    {
                        _logger.LogWarning("Failed to create dashboard schedule - external API returned {StatusCode}: {Response}", statusCode, respBody);
                        var message = string.IsNullOrWhiteSpace(respBody) ? "Failed to create dashboard schedule - you may not have permission" : respBody;
                        return StatusCode(502, ApiResponse.ErrorResponse("External API Error", message));
                    }

                    try
                    {
                        var parsed = JsonConvert.DeserializeObject<dynamic>(respBody);
                        if (parsed?.ScheduleId != null) createdScheduleId = parsed.ScheduleId.ToString();
                        else if (parsed?.Id != null) createdScheduleId = parsed.Id.ToString();
                    }
                    catch { }
                }
                else
                {
                    var token = await GetBoldReportsTokenAsync(_boldReportsService);
                    if (string.IsNullOrEmpty(token))
                    {
                        _logger.LogWarning("No token provided for creating schedule");
                        return Unauthorized(ApiResponse.UnauthorizedResponse());
                    }

                    var (ok, statusCode, respBody) = await _boldReportsService.CreateScheduleAsync(token, finalJson);
                    if (!ok || statusCode < 200 || statusCode >= 300)
                    {
                        _logger.LogWarning("Failed to create schedule - external API returned {StatusCode}: {Response}", statusCode, respBody);
                        var message = string.IsNullOrWhiteSpace(respBody) ? "Failed to create schedule - you may not have permission" : respBody;
                        return StatusCode(502, ApiResponse.ErrorResponse("External API Error", message));
                    }

                    try
                    {
                        var parsed = JsonConvert.DeserializeObject<dynamic>(respBody);
                        if (parsed?.ScheduleId != null) createdScheduleId = parsed.ScheduleId.ToString();
                        else if (parsed?.Id != null) createdScheduleId = parsed.Id.ToString();
                    }
                    catch { }
                }

                // Register schedule in PostgreSQL database for this tenant
                if (authUser != null)
                {
                    try
                    {
                        await _crmDataService.RegisterTenantScheduleAsync(
                            authUser,
                            scheduleId: createdScheduleId,
                            scheduleName: cleanScheduleName,
                            serverScheduleName: serverScheduleName,
                            itemId: itemId,
                            itemName: originalDesc,
                            itemType: itemType,
                            categoryName: isDashboard ? "Dashboard Schedules" : "Reports Schedules",
                            description: originalDesc,
                            exportType: exportType,
                            recurrenceType: scheduleType,
                            isEnabled: isEnabled
                        );
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to register schedule in DB for tenant {Tenant}", tenantName);
                    }
                }

                // Invalidate schedules cache for this tenant
                var cacheKey = $"schedules-list-{tenantName}-{userEmail}";
                await _cacheService.RemoveAsync(cacheKey);

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

                var authUser = _auth.GetAuthContext();
                var userEmail = authUser?.Email ?? "";
                var tenantName = ResolveTenantName(authUser);

                var dict = JsonConvert.DeserializeObject<Dictionary<string, object>>(payload.GetRawText())
                           ?? new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);

                string cleanScheduleName = "";
                if (dict.TryGetValue("Name", out var nVal) && nVal != null)
                {
                    cleanScheduleName = StripTenantPrefix(nVal.ToString()!.Trim(), tenantName);
                }
                var serverScheduleName = $"{tenantName}_{cleanScheduleName}";
                dict["Name"] = serverScheduleName;
                if (dict.ContainsKey("ScheduleName")) dict["ScheduleName"] = serverScheduleName;

                string originalDesc = "";
                if (dict.TryGetValue("Description", out var dVal) && dVal != null)
                {
                    originalDesc = StripTenantTags(dVal.ToString());
                }
                dict["Description"] = $"[Tenant: {tenantName}] [Owner: {userEmail}] {originalDesc}".Trim();

                string itemType = "Report";
                if (dict.TryGetValue("ItemType", out var itVal) && itVal != null) itemType = itVal.ToString()!;
                bool isDashboard = string.Equals(itemType, "Dashboard", StringComparison.OrdinalIgnoreCase);

                string? itemId = dict.TryGetValue("ItemId", out var idVal) ? idVal?.ToString() : null;
                string? exportType = dict.TryGetValue("ExportType", out var expVal) ? expVal?.ToString() : "Pdf";
                string? scheduleType = dict.TryGetValue("ScheduleType", out var stVal) ? stVal?.ToString() : "Daily";
                bool isEnabled = true;
                if (dict.TryGetValue("Enabled", out var enVal) && enVal is bool b) isEnabled = b;
                // Ensure ExternalRecipientsList has at least one valid recipient
                var recipients = new List<string>();
                if (dict.TryGetValue("ExternalRecipientsList", out var erObj) && erObj != null)
                {
                    if (erObj is Newtonsoft.Json.Linq.JArray ja)
                    {
                        recipients = ja.Select(x => x.ToString().Trim()).Where(x => !string.IsNullOrEmpty(x)).ToList();
                    }
                    else if (erObj is IEnumerable<object> eo)
                    {
                        recipients = eo.Select(x => x?.ToString()?.Trim() ?? "").Where(x => !string.IsNullOrEmpty(x)).ToList();
                    }
                    else if (erObj is string es && !string.IsNullOrWhiteSpace(es))
                    {
                        recipients.AddRange(es.Split(',').Select(x => x.Trim()).Where(x => !string.IsNullOrEmpty(x)));
                    }
                }
                if (recipients.Count == 0 && !string.IsNullOrWhiteSpace(userEmail))
                {
                    recipients.Add(userEmail);
                }
                dict["ExternalRecipientsList"] = recipients;

                if (dict.TryGetValue("UserList", out var ulVal))
                {
                    if (ulVal is Newtonsoft.Json.Linq.JArray ulJa && ulJa.Count == 0) dict.Remove("UserList");
                    else if (ulVal is System.Collections.ICollection ulColl && ulColl.Count == 0) dict.Remove("UserList");
                }
                if (dict.TryGetValue("GroupList", out var glVal))
                {
                    if (glVal is Newtonsoft.Json.Linq.JArray glJa && glJa.Count == 0) dict.Remove("GroupList");
                    else if (glVal is System.Collections.ICollection glColl && glColl.Count == 0) dict.Remove("GroupList");
                }

                if (string.Equals(scheduleType, "Weekly", StringComparison.OrdinalIgnoreCase))
                {
                    dict.Remove("HourlySchedule");
                    dict.Remove("DailySchedule");
                    dict.Remove("MonthlySchedule");
                    dict.Remove("YearlySchedule");
                    if (!dict.ContainsKey("WeeklySchedule") || dict["WeeklySchedule"] == null)
                    {
                        dict["WeeklySchedule"] = new Dictionary<string, object>
                        {
                            ["RecurrenceWeeks"] = 1,
                            ["RecurrenceDays"] = new[] { "Monday" }
                        };
                    }
                }
                else if (string.Equals(scheduleType, "Hourly", StringComparison.OrdinalIgnoreCase))
                {
                    dict.Remove("DailySchedule");
                    dict.Remove("WeeklySchedule");
                    dict.Remove("MonthlySchedule");
                    dict.Remove("YearlySchedule");
                    if (!dict.ContainsKey("HourlySchedule") || dict["HourlySchedule"] == null)
                    {
                        dict["HourlySchedule"] = new Dictionary<string, object>
                        {
                            ["ScheduleInterval"] = "01:00"
                        };
                    }
                }
                else if (string.Equals(scheduleType, "Monthly", StringComparison.OrdinalIgnoreCase))
                {
                    dict.Remove("HourlySchedule");
                    dict.Remove("DailySchedule");
                    dict.Remove("WeeklySchedule");
                    dict.Remove("YearlySchedule");
                    if (!dict.ContainsKey("MonthlySchedule") || dict["MonthlySchedule"] == null)
                    {
                        dict["MonthlySchedule"] = new Dictionary<string, object>
                        {
                            ["RecurrenceType"] = "DayRecurrence",
                            ["DayRecurrence"] = new Dictionary<string, object>
                            {
                                ["DayInterval"] = 1,
                                ["MonthInterval"] = 1
                            }
                        };
                    }
                }
                else
                {
                    dict.Remove("HourlySchedule");
                    dict.Remove("WeeklySchedule");
                    dict.Remove("MonthlySchedule");
                    dict.Remove("YearlySchedule");
                    if (!dict.ContainsKey("DailySchedule") || dict["DailySchedule"] == null)
                    {
                        dict["DailySchedule"] = new Dictionary<string, object>
                        {
                            ["RecurrenceType"] = "EveryNdays",
                            ["EveryNdays"] = 1,
                            ["EveryWeekday"] = false
                        };
                    }
                }

                dict["IsEmailAttachment"] = true;
                dict["IsSendAsMail"] = true;

                var finalJson = JsonConvert.SerializeObject(dict);

                if (isDashboard)
                {
                    var biToken = await _boldBIDashboardService.GetTokenAsync(userEmail);
                    if (string.IsNullOrEmpty(biToken))
                    {
                        return Unauthorized(ApiResponse.ErrorResponse("Unauthorized to access Dashboard Service"));
                    }

                    var (ok, statusCode, respBody) = await _boldBIDashboardService.UpdateScheduleAsync(biToken, id, finalJson);
                    if (!ok || statusCode < 200 || statusCode >= 300)
                    {
                        _logger.LogWarning("Failed to update dashboard schedule - external API returned {StatusCode}: {Response}", statusCode, respBody);
                        var message = string.IsNullOrWhiteSpace(respBody) ? "Failed to update dashboard schedule - you may not have permission" : respBody;
                        return StatusCode(502, ApiResponse.ErrorResponse("External API Error", message));
                    }
                }
                else
                {
                    var token = await GetBoldReportsTokenAsync(_boldReportsService);
                    if (string.IsNullOrEmpty(token))
                    {
                        _logger.LogWarning("No token provided for updating schedule {ScheduleId}", id);
                        return Unauthorized(ApiResponse.UnauthorizedResponse());
                    }

                    var (ok, statusCode, respBody) = await _boldReportsService.UpdateScheduleAsync(token, id, finalJson);
                    if (!ok || statusCode < 200 || statusCode >= 300)
                    {
                        _logger.LogWarning("Failed to update schedule - external API returned {StatusCode}: {Response}", statusCode, respBody);
                        var message = string.IsNullOrWhiteSpace(respBody) ? "Failed to update schedule - you may not have permission" : respBody;
                        return StatusCode(502, ApiResponse.ErrorResponse("External API Error", message));
                    }
                }

                // Update in PostgreSQL database
                if (authUser != null)
                {
                    try
                    {
                        await _crmDataService.RegisterTenantScheduleAsync(
                            authUser,
                            scheduleId: id,
                            scheduleName: cleanScheduleName,
                            serverScheduleName: serverScheduleName,
                            itemId: itemId,
                            itemName: originalDesc,
                            itemType: itemType,
                            categoryName: isDashboard ? "Dashboard Schedules" : "Reports Schedules",
                            description: originalDesc,
                            exportType: exportType,
                            recurrenceType: scheduleType,
                            isEnabled: isEnabled
                        );
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to update schedule in DB for tenant {Tenant}", tenantName);
                    }
                }

                // Invalidate schedules cache for this tenant
                var cacheKey = $"schedules-list-{tenantName}-{userEmail}";
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

                var authUser = _auth.GetAuthContext();
                var userEmail = authUser?.Email ?? "";
                var tenantName = ResolveTenantName(authUser);

                var ok = false;
                var token = await GetBoldReportsTokenAsync(_boldReportsService);
                if (!string.IsNullOrEmpty(token))
                {
                    ok = await _boldReportsService.DeleteScheduleAsync(token, id);
                }

                if (!ok)
                {
                    var biToken = await _boldBIDashboardService.GetTokenAsync(userEmail);
                    if (!string.IsNullOrEmpty(biToken))
                    {
                        ok = await _boldBIDashboardService.DeleteScheduleAsync(biToken, id);
                    }
                }

                // Also delete from PostgreSQL
                if (authUser != null)
                {
                    try
                    {
                        await _crmDataService.DeleteTenantScheduleAsync(authUser, id);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to delete schedule {Id} from DB for {Tenant}", id, tenantName);
                    }
                }

                // Invalidate schedules cache for this tenant
                var cacheKey = $"schedules-list-{tenantName}-{userEmail}";
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
}
