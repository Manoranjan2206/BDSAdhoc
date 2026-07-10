using Microsoft.AspNetCore.Mvc;
using BoldAdhocEmbed.Server.Models;
using BoldAdhocEmbed.Server.Services;

namespace BoldAdhocEmbed.Server.Controllers
{
    /// <summary>
    /// Base controller with common functionality shared across all API controllers
    /// Provides utility methods for token extraction, logging, and response formatting
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
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
        /// Extract user email from either a session token or JWT token
        /// </summary>
        protected string GetEmailFromToken(string token)
        {
            if (string.IsNullOrEmpty(token))
            {
                var headerEmailVal = Request.Headers["X-User-Email"].ToString();
                if (!string.IsNullOrEmpty(headerEmailVal))
                {
                    return headerEmailVal;
                }

                var headerUserIdVal = Request.Headers["X-User-Id"].ToString();
                if (!string.IsNullOrEmpty(headerUserIdVal))
                {
                    return headerUserIdVal;
                }

                if (Request.Query.TryGetValue("email", out var queryEmail) && !string.IsNullOrEmpty(queryEmail))
                {
                    return queryEmail;
                }

                if (Request.Query.TryGetValue("userId", out var queryUserId) && !string.IsNullOrEmpty(queryUserId))
                {
                    return queryUserId;
                }

                return null;
            }

            // 1. Try decoding as local session token (Email:Ticks)
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
            catch
            {
                // Not a session token
            }

            // 2. Try decoding as JWT token
            try
            {
                var parts = token.Split('.');
                if (parts.Length == 3)
                {
                    var payload = parts[1];
                    while (payload.Length % 4 != 0)
                        payload += "=";
                    
                    var decodedBytes = Convert.FromBase64String(payload);
                    var decodedString = System.Text.Encoding.UTF8.GetString(decodedBytes);
                    
                    // Look for email or unique_name in JSON
                    var emailIndex = decodedString.IndexOf("\"email\":\"", StringComparison.OrdinalIgnoreCase);
                    if (emailIndex >= 0)
                    {
                        var emailStart = emailIndex + 9;
                        var emailEnd = decodedString.IndexOf("\"", emailStart);
                        return decodedString.Substring(emailStart, emailEnd - emailStart);
                    }

                    var nameIndex = decodedString.IndexOf("\"unique_name\":\"", StringComparison.OrdinalIgnoreCase);
                    if (nameIndex >= 0)
                    {
                        var nameStart = nameIndex + 15;
                        var nameEnd = decodedString.IndexOf("\"", nameStart);
                        return decodedString.Substring(nameStart, nameEnd - nameStart);
                    }
                }
            }
            catch
            {
                // Not a valid JWT token
            }

            // 3. Fallback: check headers and query params
            var headerEmail = Request.Headers["X-User-Email"].ToString();
            if (!string.IsNullOrEmpty(headerEmail))
            {
                return headerEmail;
            }

            var headerUserId = Request.Headers["X-User-Id"].ToString();
            if (!string.IsNullOrEmpty(headerUserId))
            {
                return headerUserId;
            }

            if (Request.Query.TryGetValue("email", out var qEmail) && !string.IsNullOrEmpty(qEmail))
            {
                return qEmail;
            }

            if (Request.Query.TryGetValue("userId", out var qUserId) && !string.IsNullOrEmpty(qUserId))
            {
                return qUserId;
            }

            return null;
        }

        /// <summary>
        /// Exchange a local session token (or JWT) for a real Bold Reports token on-the-fly
        /// </summary>
        protected async Task<string> GetBoldReportsTokenAsync(IBoldReportsService boldReportsService)
        {
            var token = GetTokenFromRequest();
            var email = GetEmailFromToken(token);
            if (!string.IsNullOrEmpty(email))
            {
                // Check cache first to avoid requesting new token every time
                var cacheKey = $"bold-reports-exchanged-token-{email}";
                var cacheService = HttpContext.RequestServices.GetService<ICacheService>();
                if (cacheService != null)
                {
                    var cachedToken = await cacheService.GetAsync<string>(cacheKey);
                    if (!string.IsNullOrEmpty(cachedToken))
                    {
                        return cachedToken;
                    }
                }

                // Exchange for real Bold Reports token
                var realToken = await boldReportsService.GetTokenFromSecretAsync(email);
                if (!string.IsNullOrEmpty(realToken))
                {
                    Logger.LogInformation("Exchanged token for user {Email}", email);
                    if (cacheService != null)
                    {
                        // Cache the token for 1 hour
                        await cacheService.SetAsync(cacheKey, realToken, TimeSpan.FromHours(1));
                    }
                    return realToken;
                }
            }

            return token;
        }
    }
}
