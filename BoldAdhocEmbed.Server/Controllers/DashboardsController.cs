using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using BoldAdhocEmbed.Server.Services;
using BoldAdhocEmbed.Server.Models;

namespace BoldAdhocEmbed.Server.Controllers
{
    /// <summary>
    /// Dashboards API endpoints for managing and embedding Bold BI dashboards
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class DashboardsController : BaseController
    {
        private readonly IBoldBIDashboardService _dashboardService;
        private readonly ICacheService _cacheService;

        public DashboardsController(
            IBoldBIDashboardService dashboardService,
            ILogger<DashboardsController> logger,
            ICacheService cacheService)
            : base(logger)
        {
            _dashboardService = dashboardService ?? throw new ArgumentNullException(nameof(dashboardService));
            _cacheService = cacheService ?? throw new ArgumentNullException(nameof(cacheService));
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

                // Try cache first
                var cacheKey = $"dashboard-token-{request.UserEmail}";
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
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
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
                var userEmail = User.FindFirst("email")?.Value ?? "manoranjan.rajendran@syncfusion.com";

                var token = await _dashboardService.GetTokenAsync(userEmail);
                if (string.IsNullOrEmpty(token))
                {
                    Logger.LogWarning("Failed to get token for dashboard list retrieval");
                    return Unauthorized(ApiResponse<dynamic>.UnauthorizedResponse());
                }

                var dashboards = await _dashboardService.GetDashboardsAsync(token);

                Logger.LogInformation("Retrieved {DashboardCount} dashboards", dashboards.Count);
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

                var userEmail = User.FindFirst("email")?.Value ?? "manoranjan.rajendran@syncfusion.com";
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
        /// Get embed configuration for a specific dashboard
        /// This configuration is used by the client to embed and display the dashboard
        /// </summary>
        /// <param name="id">Dashboard ID</param>
        /// <returns>Embed configuration</returns>
        [HttpGet("{id}/config")]
        public IActionResult GetEmbedConfig(string id)
        {
            try
            {
                if (!ValidateRequired(id, "Dashboard ID", out var errorMsg))
                {
                    return BadRequest(ApiResponse<dynamic>.ErrorResponse("Invalid Request", errorMsg));
                }

                var settings = HttpContext.RequestServices.GetRequiredService<BoldBISettings>();
                
                var config = new
                {
                    DashboardId = id,
                    ServerUrl = settings.ServerUrl,
                    SiteIdentifier = settings.SiteIdentifier,
                    Environment = settings.Environment,
                    UserEmail = settings.UserEmail,
                    EmbedType = "component",
                    ExpirationTime = 10000
                };

                Logger.LogInformation("Embed config generated for dashboard {DashboardId}", id);
                return Ok(config);
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

                var userEmail = HttpContext.RequestServices.GetRequiredService<BoldBISettings>()?.UserEmail 
                    ?? "manoranjan.rajendran@syncfusion.com";

                Logger.LogInformation("Authorizing dashboard for user {UserEmail} with query: {EmbedQueryString}", userEmail, embedClass.embedQuerString);

                var authToken = await _dashboardService.GetAuthorizationTokenAsync(
                    embedClass.embedQuerString,
                    userEmail,
                    embedClass.dashboardServerApiUrl
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
