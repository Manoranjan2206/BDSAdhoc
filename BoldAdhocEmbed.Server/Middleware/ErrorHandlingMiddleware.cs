using System;
using System.Net;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using BoldAdhocEmbed.Server.Models;

namespace BoldAdhocEmbed.Server.Middleware
{
    /// <summary>
    /// Global error handling middleware to catch and standardize all exceptions
    /// Ensures consistent error responses across the application
    /// </summary>
    public class ErrorHandlingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ErrorHandlingMiddleware> _logger;

        public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
        {
            _next = next ?? throw new ArgumentNullException(nameof(next));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Process the HTTP request and handle any exceptions
        /// </summary>
        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unhandled exception occurred at {Path}", context.Request.Path);
                await HandleExceptionAsync(context, ex, _logger);
            }
        }

        /// <summary>
        /// Convert exception to standardized API response
        /// </summary>
        private static Task HandleExceptionAsync(HttpContext context, Exception exception, ILogger logger)
        {
            context.Response.ContentType = "application/json";

            ApiResponse<object> response;
            int statusCode;

            switch (exception)
            {
                case ArgumentNullException or ArgumentException:
                    statusCode = (int)HttpStatusCode.BadRequest;
                    response = ApiResponse<object>.ErrorResponse(exception.Message, "Invalid request parameters");
                    logger.LogWarning("Bad request: {Message}", exception.Message);
                    break;

                case UnauthorizedAccessException:
                    statusCode = (int)HttpStatusCode.Unauthorized;
                    response = ApiResponse<object>.UnauthorizedResponse();
                    logger.LogWarning("Unauthorized access attempted");
                    break;

                case KeyNotFoundException:
                    statusCode = (int)HttpStatusCode.NotFound;
                    response = ApiResponse<object>.ErrorResponse(exception.Message, "Resource not found");
                    logger.LogWarning("Resource not found: {Message}", exception.Message);
                    break;

                case InvalidOperationException:
                    statusCode = (int)HttpStatusCode.BadRequest;
                    response = ApiResponse<object>.ErrorResponse(exception.Message, "Invalid operation");
                    logger.LogWarning("Invalid operation: {Message}", exception.Message);
                    break;

                default:
                    statusCode = (int)HttpStatusCode.InternalServerError;
                    response = ApiResponse<object>.ErrorResponse(
                        "An unexpected error occurred",
                        "Internal server error"
                    );
                    logger.LogError(exception, "Internal server error");
                    break;
            }

            context.Response.StatusCode = statusCode;
            return context.Response.WriteAsJsonAsync(response);
        }
    }
}
