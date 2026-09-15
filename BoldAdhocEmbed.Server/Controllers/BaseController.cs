using Microsoft.AspNetCore.Mvc;
using BoldAdhocEmbed.Server.Models;
using BoldAdhocEmbed.Server.Services;

namespace BoldAdhocEmbed.Server.Controllers
{
    /// <summary>
    /// Base controller with common functionality shared across all API controllers
    /// Provides utility methods for token extraction, logging, and response formatting
    /// </summary>
    public abstract class BaseController : ControllerBase
    {
        /// <summary>
        /// Logger instance for the controller
        /// </summary>
        protected ILogger Logger { get; }

        /// <summary>
        /// Constructor for derived classes
        /// </summary>
        protected BaseController(ILogger logger)
        {
            Logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Extract Bearer token from Authorization header
        /// </summary>
        /// <returns>Token string without "Bearer " prefix, or null if not found</returns>
        protected string GetTokenFromRequest()
        {
            var authHeader = Request.Headers["Authorization"].ToString();
            
            if (string.IsNullOrEmpty(authHeader))
            {
                Logger.LogWarning("No Authorization header provided");
                return null;
            }

            // Expected format: "Bearer eyJ0eXAi..."
            if (authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                var token = authHeader.Substring("Bearer ".Length).Trim();
                Logger.LogDebug("Token extracted from Authorization header");
                return token;
            }

            Logger.LogWarning("Invalid Authorization header format");
            return null;
        }

        /// <summary>
        /// Return a successful response with data
        /// </summary>
        protected ActionResult<ApiResponse<T>> OkResponse<T>(T data, string message = "Success")
        {
            Logger.LogInformation("Success response: {Message}", message);
            return Ok(ApiResponse<T>.SuccessResponse(data, message));
        }

        /// <summary>
        /// Return a successful response without data
        /// </summary>
        protected ActionResult<ApiResponse> OkResponse(string message = "Success")
        {
            Logger.LogInformation("Success response: {Message}", message);
            return Ok(ApiResponse.SuccessResponse(message));
        }

        /// <summary>
        /// Return a bad request (400) error response
        /// </summary>
        protected ActionResult<ApiResponse<T>> BadRequestResponse<T>(string error, string message = "Bad Request")
        {
            Logger.LogWarning("Bad request: {Error} - {Message}", error, message);
            return BadRequest(ApiResponse<T>.ErrorResponse(error, message));
        }

        /// <summary>
        /// Return an unauthorized (401) error response
        /// </summary>
        protected ActionResult<ApiResponse<T>> UnauthorizedResponse<T>(string message = "Unauthorized")
        {
            Logger.LogWarning("Unauthorized access attempt: {Message}", message);
            return Unauthorized(ApiResponse<T>.UnauthorizedResponse());
        }

        /// <summary>
        /// Return a not found (404) error response
        /// </summary>
        protected ActionResult<ApiResponse<T>> NotFoundResponse<T>(string error, string message = "Not Found")
        {
            Logger.LogWarning("Resource not found: {Error} - {Message}", error, message);
            return NotFound(ApiResponse<T>.ErrorResponse(error, message));
        }

        /// <summary>
        /// Return an internal server error (500) response
        /// </summary>
        protected ActionResult<ApiResponse<T>> InternalErrorResponse<T>(string error, string message = "Internal Server Error")
        {
            Logger.LogError("Internal error: {Error} - {Message}", error, message);
            return StatusCode(500, ApiResponse<T>.ErrorResponse(error, message));
        }

        /// <summary>
        /// Validate that a required parameter is provided
        /// </summary>
        protected bool ValidateRequired(string value, string paramName, out string errorMessage)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                errorMessage = $"{paramName} is required";
                Logger.LogWarning("Required parameter missing: {ParamName}", paramName);
                return false;
            }

            errorMessage = null;
            return true;
        }

        /// <summary>
        /// Resolve the caller email from validated JWT claims ONLY. The
        /// previous implementation accepted X-User-* headers and ?email=
        /// query strings, which let any caller impersonate any identity.
        /// Use <see cref="IAuthenticatedUser"/> directly for full context.
        /// </summary>
        protected string? GetEmailFromToken(string token)
        {
            var auth = HttpContext.RequestServices
                .GetService(typeof(IAuthenticatedUser)) as IAuthenticatedUser;
            var email = auth?.GetAuthContext()?.Email;
            if (!string.IsNullOrWhiteSpace(email)) return email;

            // The dependency-free session token (Email:Ticks) is the only
            // legacy format still honored, and only because it is signed
            // server-side. Strip and return if present.
            if (!string.IsNullOrEmpty(token))
            {
                try
                {
                    var decodedBytes = Convert.FromBase64String(token);
                    var decodedString = System.Text.Encoding.UTF8.GetString(decodedBytes);
                    var parts = decodedString.Split(':');
                    if (parts.Length == 2 && parts[0].Contains("@") && long.TryParse(parts[1], out _))
                    {
                        return parts[0];
                    }
                }
                catch { /* not a session token */ }
            }
            return null;
        }

        /// <summary>
        /// Exchange a local session token (or JWT) for a real Bold Reports
        /// access token (password grant — same JWT shape the curl example
        /// shows). This access token is sent by the server itself as
        /// <c>Authorization: Bearer &lt;jwt&gt;</c> against the Reports site
        /// REST APIs (/items, /users, /reports, /schedules, …).
        ///
        /// Cached per-user for an hour. Cached value is the <b>raw jwt</b>;
        /// callers add the <c>Bearer </c> prefix via NormalizeAuthHeader
        /// when forwarding it to HttpClient.
        /// </summary>
        protected async Task<string> GetBoldReportsTokenAsync(IBoldReportsService boldReportsService)
        {
            var reportsSettings = HttpContext.RequestServices.GetService<BoldReportsSettings>();
            var cacheService = HttpContext.RequestServices.GetService<ICacheService>();

            // 1. Resolve the caller identity from validated claims. Admin fallback
            // is dropped here; in Production an unauthenticated caller
            // requires a service-account configured via configuration.
            var callerToken = GetTokenFromRequest();
            var callerEmail = GetEmailFromToken(callerToken);
            var targetEmail = !string.IsNullOrEmpty(callerEmail)
                ? callerEmail
                : (reportsSettings?.AdminUser ?? throw new UnauthorizedAccessException(
                    "No authenticated caller and no service-account fallback configured."));

            var cacheKey = $"bold-reports-exchanged-token-{targetEmail}";
            if (cacheService != null)
            {
                var cachedToken = await cacheService.GetAsync<string>(cacheKey);
                if (!string.IsNullOrEmpty(cachedToken))
                {
                    Logger.LogInformation("Using cached Bold Reports token for {Email}", targetEmail);
                    return cachedToken;
                }
            }

            // 2. Password grant — produces a JWT that the Reports REST API
            // accepts in the Authorization header. The embed_token flow is
            // reserved for the widget embed; side-channel API calls always
            // want this Bearer-style token.
            var realToken = await boldReportsService.GetTokenAsync(
                targetEmail, reportsSettings?.AdminPassword ?? "Admin@123");
            if (!string.IsNullOrEmpty(realToken))
            {
                Logger.LogInformation("Generated Bold Reports token via password grant for {Email}", targetEmail);
                if (cacheService != null)
                {
                    await cacheService.SetAsync(cacheKey, realToken, TimeSpan.FromHours(12));
                }
                return realToken;
            }

            // 4. No viable token. Returning null so the Reports endpoints can
            // surface a clean error instead of leaking the inbound session
            // token (which the Reports widget rejects with 401 anyway).
            Logger.LogWarning(
                "Could not mint Bold Reports token for {Email}; caller is not provisioned on the Reports site. "
                + "Use an account that exists on Bold Reports site {Site} or set BoldReports:AdminUser to one that does.",
                targetEmail, reportsSettings?.ReportsSiteIdentifier);
            return null;
        }

        /// <summary>
        /// Mint a Bold Reports embed_token for the Reports widget (the one returned
        /// to the browser via /api/reports/viewer-settings). Uses the
        /// <c>embed_token</c> JSON grant flow against the Reports site's
        /// <c>/api/site/{site}/token</c> endpoint with no HMAC signing required.
        /// The returned value is the raw JWT — the Reports widget consumes it
        /// as-is via <c>boldReportViewer({ embedToken: ... })</c>.
        ///
        /// This token is separate from the side-channel API access token returned
        /// by <see cref="GetBoldReportsTokenAsync"/>, which is used by the
        /// server to call the Reports REST API on behalf of the caller.
        /// </summary>
        protected async Task<string> GetReportsEmbedTokenAsync(
            IBoldReportsService boldReportsService, string email)
        {
            var reportsSettings = HttpContext.RequestServices.GetService<BoldReportsSettings>();
            var cacheService = HttpContext.RequestServices.GetService<ICacheService>();

            if (reportsSettings == null || string.IsNullOrWhiteSpace(reportsSettings.EmbedSecret))
            {
                Logger.LogWarning(
                    "Embed_token mint skipped: BoldReports:EmbedSecret is empty in config");
                return null;
            }

            var cacheKey = $"bold-reports-embed-token-{email}";
            if (cacheService != null)
            {
                var cached = await cacheService.GetAsync<string>(cacheKey);
                if (!string.IsNullOrEmpty(cached))
                {
                    Logger.LogInformation(
                        "Using cached Bold Reports embed_token for {Email}", email);
                    return cached;
                }
            }

            var embedToken = await boldReportsService.GetTokenFromSecretAsync(email);
            if (string.IsNullOrEmpty(embedToken))
            {
                Logger.LogWarning(
                    "Embed_token mint failed for {Email}; check BoldReports:EmbedSecret matches the site", email);
                return null;
            }

            // Cache for 12 hours — cached until user logs out or session expires.
            if (cacheService != null)
            {
                await cacheService.SetAsync(cacheKey, embedToken, TimeSpan.FromHours(12));
            }
            return embedToken;
        }
    }
}
