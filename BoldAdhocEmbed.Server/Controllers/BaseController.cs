using Microsoft.AspNetCore.Mvc;
using BoldAdhocEmbed.Server.Models;

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
    }
}
