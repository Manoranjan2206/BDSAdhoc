using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using BoldAdhocEmbed.Server.Services;
using BoldAdhocEmbed.Server.Models;
using BoldAdhocEmbed.Server.Validators;

namespace BoldAdhocEmbed.Server.Controllers
{
    /// <summary>
    /// Dashboards API endpoints. Bracketed behind [Authorize] so the
    /// [Authorize] policy supplies the validated JWT identity that
    /// <see cref="IAuthenticatedUser"/> reads. No client-supplied
    /// X-User-* headers are honored.
    /// </summary>
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class DashboardsController : BaseController
    {
        private readonly IBoldBIDashboardService _dashboardService;
        private readonly ICacheService _cacheService;
        private readonly IBoldReportsService _boldReportsService;
        private readonly IUserStore _userStore;
        private readonly IAuthenticatedUser _auth;

        public DashboardsController(
            IBoldBIDashboardService dashboardService,
            ILogger<DashboardsController> logger,
            ICacheService cacheService,
            IBoldReportsService boldReportsService,
            IUserStore userStore,
            IAuthenticatedUser auth)
            : base(logger)
        {
            _dashboardService = dashboardService ?? throw new ArgumentNullException(nameof(dashboardService));
            _cacheService = cacheService ?? throw new ArgumentNullException(nameof(cacheService));
            _boldReportsService = boldReportsService ?? throw new ArgumentNullException(nameof(boldReportsService));
            _userStore = userStore ?? throw new ArgumentNullException(nameof(userStore));
            _auth = auth ?? throw new ArgumentNullException(nameof(auth));
        }

        /// <summary>
        /// Resolve the <see cref="AppUser"/> for the current request, falling
        /// back to a minimal stub when no RBAC user matches (e.g. service-to-
        /// service calls). The same fallback is used by the Bold Reports
        /// embed-token flow so both products stay aligned.
        /// </summary>
        private AppUser ResolveAppUserForBiAuth(string email)
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                throw new UnauthorizedAccessException(
                    "Authenticated context missing email claim.");
            }

            var existing = _userStore.Get(email.Trim());
            if (existing != null && existing.IsActive) return existing;

            // No header fallback. Build a derived AppUser from validated
            // claims only. If admin/region/tenant are missing the BI side
            // cannot sign a meaningful embed_custom_attribute and the call
            // must be rejected.
            var auth = _auth.GetAuthContext()
                ?? throw new UnauthorizedAccessException(
                    "Authenticated context missing.");
            return new AppUser
            {
                Id = auth.Email!,
                Email = auth.Email,
                Name = auth.Email,
                Role = auth.Role,
                TenantId = auth.TenantId,
                TenantName = auth.TenantName,
                Region = auth.Region,
                IsActive = true,
            };
        }

        /// <summary>
        /// Distinct regions across all active users â€” used to build the
        /// multi-value <c>Region IN(...)</c> clause for Admins so a single
        /// embed shows every region instead of being scoped to one.
        /// </summary>
        private IEnumerable<string> GetAllRegions()
        {
            return _userStore.GetAll()
                .Where(u => u != null && u.IsActive)
                .Select(u => u.Region)
                .Where(r => !string.IsNullOrWhiteSpace(r))
                .Select(r => r.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        /// <summary>
        /// Get Bold BI token for dashboard operations
        /// This token is used to authenticate subsequent dashboard API requests
        /// </summary>
        /// <param name="request">Token request with user email</param>
        /// <returns>Authentication token with expiration time</returns>
        [HttpPost("token")]
        public async Task<IActionResult> GetToken([FromBody] GetTokenRequest request)
        {
            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.UserEmail))
                {
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse("Invalid Request", "UserEmail is required"));
                }

                // Validate email format to prevent cache poisoning / abuse
                if (!RequestValidator.ValidateEmail(request.UserEmail).Count.Equals(0))
                {
                    var masked = request.UserEmail.Length > 10
                        ? request.UserEmail.Substring(0, 10) + "..."
                        : request.UserEmail;
                    Logger.LogWarning("Invalid email format on dashboard token request: {Email}", masked);
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse(
                        "Invalid Request", "UserEmail must be a valid email address"));
                }

                // Sanitize and bound the cache key length to keep the cache shallow.
                var safeEmail = RequestValidator.SanitizeCacheKey(request.UserEmail, 200);
                var cacheKey = $"dashboard-token-{safeEmail}";
                var cachedToken = await _cacheService.GetAsync<string>(cacheKey);
                
                if (!string.IsNullOrEmpty(cachedToken))
                {
                    Logger.LogInformation("Dashboard token retrieved from cache for {UserEmail}", request.UserEmail);
                    return Ok(ApiResponse<dynamic>.SuccessResponse(
                        (dynamic)new { token = cachedToken, expiresIn = 10000 },
                        "Dashboard token retrieved from cache"
                    ));
                }

                var token = await _dashboardService.GetTokenAsync(request.UserEmail);
                if (string.IsNullOrEmpty(token))
                {
                    Logger.LogWarning("Failed to generate dashboard token for {UserEmail}", request.UserEmail);
                    return StatusCode(503, ApiResponse<dynamic>.ErrorResponse(
                        "Dashboard Service Unavailable",
                        "Bold BI service is not responding. Please try again later."));
                }

                // Cache token for 2 hours
                await _cacheService.SetAsync(cacheKey, token, TimeSpan.FromHours(2));

                return Ok(ApiResponse<dynamic>.SuccessResponse(
                    (dynamic)new { token = token, expiresIn = 10000 },
                    "Dashboard token generated successfully"
                ));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error generating dashboard token");
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to generate dashboard token"));
            }
        }

        /// <summary>
        /// Get list of dashboards the user has access to
        /// </summary>
        /// <returns>List of available dashboards</returns>
        [HttpGet("list")]
        public async Task<IActionResult> GetDashboards()
        {
            try
            {
                var requestToken = GetTokenFromRequest();
                var userEmail = _auth.GetAuthContext()?.Email;

                // Check cache first
                var cacheKey = $"dashboards-list-{userEmail}";
                var cachedDashboards = await _cacheService.GetAsync<dynamic>(cacheKey);
                if (cachedDashboards != null)
                {
                    Logger.LogInformation("Dashboards list retrieved from cache for {Email}", userEmail);
                    return Ok(ApiResponse<dynamic>.SuccessResponse(cachedDashboards, "Dashboards retrieved successfully"));
                }

                var token = await _dashboardService.GetTokenAsync(userEmail);
                if (string.IsNullOrEmpty(token))
                {
                    Logger.LogWarning("Failed to get token for dashboard list retrieval");
                    // Return 503 Service Unavailable instead of 401, so frontend doesn't log out
                    return StatusCode(503, ApiResponse<dynamic>.ErrorResponse(
                        "Dashboard Service Unavailable",
                        "Bold BI service is not responding. Please try again later."));
                }

                var dashboards = await _dashboardService.GetDashboardsAsync(token);

                try
                {
                    // 1. Get BI User ID (with cache)
                    var biUserCacheKey = $"bi-user-id-{userEmail}";
                    var biUserId = await _cacheService.GetAsync<string>(biUserCacheKey);
                    if (string.IsNullOrEmpty(biUserId))
                    {
                        biUserId = await _dashboardService.GetUserIdByEmailAsync(token, userEmail);
                        if (!string.IsNullOrEmpty(biUserId))
                        {
                            await _cacheService.SetAsync(biUserCacheKey, biUserId, TimeSpan.FromDays(1));
                        }
                    }

                    // 2. Get Reports User ID (with cache)
                    var reportsUserCacheKey = $"reports-user-id-{userEmail}";
                    var reportsUserId = await _cacheService.GetAsync<string>(reportsUserCacheKey);
                    if (string.IsNullOrEmpty(reportsUserId))
                    {
                        var reportsToken = await GetBoldReportsTokenAsync(_boldReportsService);
                        if (!string.IsNullOrEmpty(reportsToken))
                        {
                            var reportsUser = await _boldReportsService.GetUserAsync(reportsToken, userEmail);
                            if (reportsUser != null && !string.IsNullOrEmpty(reportsUser.Id))
                            {
                                reportsUserId = reportsUser.Id;
                                await _cacheService.SetAsync(reportsUserCacheKey, reportsUserId, TimeSpan.FromDays(1));
                            }
                        }
                    }

                    // 3. Map OwnerId if both IDs are available
                    if (!string.IsNullOrEmpty(biUserId) && !string.IsNullOrEmpty(reportsUserId))
                    {
                        Logger.LogInformation("Mapping dashboard OwnerId for user {Email}: BI ID = {BiId}, Reports ID = {ReportsId}", userEmail, biUserId, reportsUserId);
                        foreach (var d in dashboards)
                        {
                            if (string.Equals(d.OwnerId, biUserId, StringComparison.OrdinalIgnoreCase))
                            {
                                d.OwnerId = reportsUserId;
                            }
                        }
                    }
                }
                catch (Exception mapEx)
                {
                    Logger.LogWarning(mapEx, "Error mapping dashboard owner ID for user {Email}", userEmail);
                }

                Logger.LogInformation("Retrieved {DashboardCount} dashboards", dashboards.Count);
                
                // Cache for 5 minutes
                await _cacheService.SetAsync(cacheKey, (dynamic)dashboards, TimeSpan.FromMinutes(5));

                return Ok(ApiResponse<dynamic>.SuccessResponse((dynamic)dashboards, "Dashboards retrieved successfully"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error retrieving dashboards");
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to retrieve dashboards"));
            }
        }

        /// <summary>
        /// Get specific dashboard details
        /// </summary>
        /// <param name="id">Dashboard ID</param>
        /// <returns>Dashboard details</returns>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetDashboard(string id)
        {
            try
            {
                if (!ValidateRequired(id, "Dashboard ID", out var errorMsg))
                {
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse("Invalid Request", errorMsg));
                }

                var requestToken = GetTokenFromRequest();
                var userEmail = _auth.GetAuthContext()?.Email;
                var token = await _dashboardService.GetTokenAsync(userEmail);

                if (string.IsNullOrEmpty(token))
                {
                    Logger.LogWarning("Failed to get token for dashboard {DashboardId}", id);
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var dashboard = await _dashboardService.GetDashboardAsync(token, id);
                if (dashboard == null)
                {
                    Logger.LogWarning("Dashboard not found: {DashboardId}", id);
                    return NotFound(ApiResponse<dynamic>.ErrorResponse("Not Found", $"Dashboard '{id}' not found"));
                }

                Logger.LogInformation("Dashboard {DashboardId} retrieved successfully", id);
                return Ok(ApiResponse<dynamic>.SuccessResponse((dynamic)dashboard, "Dashboard retrieved successfully"));
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error retrieving dashboard {DashboardId}", id);
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to retrieve dashboard"));
            }
        }

        /// <summary>
        /// Get embed configuration for a specific dashboard, including a
        /// server-minted <c>embedToken</c> so the browser can embed the
        /// dashboard via <c>BoldBI.create({ embedToken })</c> with no
        /// additional authorize handshake. The logged-in caller's email /
        /// tenant / region are signed into the embed token along with the
        /// dashboard id; admins receive a multi-value Region IN(...) list so
        /// the dashboard renders rows for every region.
        /// </summary>
        [HttpGet("{id}/config")]
        public async Task<IActionResult> GetEmbedConfig(string id)
        {
            try
            {
                if (!ValidateRequired(id, "Dashboard ID", out var errorMsg))
                {
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse("Invalid Request", errorMsg));
                }

                // Resolve the caller so the embed token reflects whoever is
                // actually logged in, not the static site-default user.
                var requestToken = GetTokenFromRequest();
                var callerEmail = GetEmailFromToken(requestToken);
                var appUser = ResolveAppUserForBiAuth(callerEmail ?? string.Empty);
                IEnumerable<string>? adminRegions = string.Equals(appUser.Role, "Admin", StringComparison.OrdinalIgnoreCase)
                    ? GetAllRegions()
                    : null;

                var settings = HttpContext.RequestServices.GetRequiredService<BoldBISettings>();

                // Server-mint the embed_token; if signing/BI is unavailable the
                // service returns null and we'll fall back to the SDK handshake
                // (clients can opt back into authorizationServer).
                var biConfig = await _dashboardService.GetEmbedConfigAsync(
                    id, appUser, adminRegions, appUser.Email, settings.ServerUrl);

                if (biConfig == null)
                {
                    return StatusCode(502, ApiResponse<dynamic>.ErrorResponse(
                        "Failed to generate Bold BI embed configuration",
                        "Bold BI service unavailable"));
                }

                // Shape the response with explicit casing so the client can
                // rely on lowercase camelCase keys (BoldBI SDK + axios).
                var payload = new
                {
                    dashboardId = biConfig.DashboardId,
                    serverUrl = biConfig.ServerUrl,
                    siteIdentifier = biConfig.SiteIdentifier,
                    environment = biConfig.Environment,
                    userEmail = biConfig.UserEmail,
                    embedType = biConfig.EmbedType ?? "component",
                    expirationTime = biConfig.ExpirationTime,
                    embedToken = biConfig.EmbedToken ?? string.Empty
                };

                Logger.LogInformation(
                    "Embed config (with embedToken {HasToken}) generated for dashboard {DashboardId} as {Email}",
                    !string.IsNullOrEmpty(payload.embedToken), id, payload.userEmail);

                return Ok(payload);
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error generating embed config for dashboard {DashboardId}", id);
                return StatusCode(500, ApiResponse<dynamic>.ErrorResponse(ex.Message, "Failed to generate embed configuration"));
            }
        }

        /// <summary>
        /// Get authorization token for dashboard embedding
        /// This endpoint is called by the Bold BI embedded SDK during dashboard loading
        /// </summary>
        /// <param name="embedQuerString">Embed query string from SDK</param>
        /// <returns>Authorization token</returns>
        [HttpPost("authorize")]
        [Consumes("application/json")]
        public async Task<IActionResult> AuthorizeDashboard([FromBody] object embedQuerString)
        {
            try
            {
                if (embedQuerString == null)
                {
                    return BadRequest(new { error = "Request body is required" });
                }

                var embedClass = JsonConvert.DeserializeObject<EmbedClass>(embedQuerString.ToString() ?? "");
                if (embedClass == null || string.IsNullOrWhiteSpace(embedClass.embedQuerString))
                {
                    Logger.LogWarning("Authorization request missing embedQuerString");
                    return BadRequest(new { error = "embedQuerString is required" });
                }

                var requestToken = GetTokenFromRequest();
                var userEmail = GetEmailFromToken(requestToken)
                    ?? HttpContext.RequestServices.GetRequiredService<BoldBISettings>()?.UserEmail;
                if (string.IsNullOrEmpty(userEmail))
                {
                    return Unauthorized(new { error = "Authenticated user required to sign embed_custom_attribute" });
                }

                // Resolve RBAC user + admin region list so the BI authorize
                // handshake can sign embed_custom_attribute (databaseName,
                // Region) into the embed token. Non-admins get their own
                // single region; admins get a multi-value IN(...) list.
                var appUser = ResolveAppUserForBiAuth(userEmail);
                IEnumerable<string>? adminRegions = string.Equals(appUser.Role, "Admin", StringComparison.OrdinalIgnoreCase)
                    ? GetAllRegions()
                    : null;

                Logger.LogInformation("Authorizing dashboard for user {UserEmail} (role={Role}, tenant={Tenant}, region={Region}) with query: {EmbedQueryString}",
                    userEmail, appUser.Role, appUser.TenantName, appUser.Region, embedClass.embedQuerString);

                var authToken = await _dashboardService.GetAuthorizationTokenAsync(
                    embedClass.embedQuerString,
                    userEmail,
                    embedClass.dashboardServerApiUrl,
                    appUser,
                    adminRegions
                );

                if (string.IsNullOrEmpty(authToken))
                {
                    Logger.LogWarning("Authorization failed - no token returned");
                    return StatusCode(500, new { error = "Failed to authorize dashboard embedding" });
                }

                Logger.LogInformation("Dashboard authorization successful for user {UserEmail}", userEmail);
                return Content(authToken, "text/plain");
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error authorizing dashboard");
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }

    /// <summary>
    /// Request model for getting dashboard token
    /// </summary>
    public class GetTokenRequest
    {
        /// <summary>
        /// User email address
        /// </summary>
        public string UserEmail { get; set; } = string.Empty;
    }

    /// <summary>
    /// Model for dashboard embed authorization
    /// </summary>
    public class EmbedClass
    {
        /// <summary>
        /// Embed query string from Bold BI SDK
        /// </summary>
        public string embedQuerString { get; set; } = string.Empty;

        /// <summary>
        /// Dashboard server API URL
        /// </summary>
        public string dashboardServerApiUrl { get; set; } = string.Empty;
    }
}

