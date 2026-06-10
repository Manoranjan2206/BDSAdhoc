using Newtonsoft.Json;

namespace BoldAdhocEmbed.Server.Models
{
    /// <summary>
    /// Standard API response wrapper for consistent response format
    /// </summary>
    public class ApiResponse<T>
    {
        [JsonProperty("success")]
        public bool Success { get; set; }

        [JsonProperty("data")]
        public T Data { get; set; }

        [JsonProperty("message")]
        public string Message { get; set; }

        [JsonProperty("error")]
        public string Error { get; set; }

        [JsonProperty("timestamp")]
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        public static ApiResponse<T> SuccessResponse(T data, string message = "Success")
        {
            return new ApiResponse<T>
            {
                Success = true,
                Data = data,
                Message = message,
                Timestamp = DateTime.UtcNow
            };
        }

        public static ApiResponse<T> ErrorResponse(string error, string message = "An error occurred")
        {
            return new ApiResponse<T>
            {
                Success = false,
                Error = error,
                Message = message,
                Timestamp = DateTime.UtcNow
            };
        }

        public static ApiResponse<T> UnauthorizedResponse()
        {
            return new ApiResponse<T>
            {
                Success = false,
                Error = "Unauthorized",
                Message = "Unable to authenticate with Bold Reports",
                Timestamp = DateTime.UtcNow
            };
        }
    }

    /// <summary>
    /// Non-generic version for operations without data response
    /// </summary>
    public class ApiResponse
    {
        [JsonProperty("success")]
        public bool Success { get; set; }

        [JsonProperty("message")]
        public string Message { get; set; }

        [JsonProperty("error")]
        public string Error { get; set; }

        [JsonProperty("timestamp")]
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        public static ApiResponse SuccessResponse(string message = "Success")
        {
            return new ApiResponse
            {
                Success = true,
                Message = message,
                Timestamp = DateTime.UtcNow
            };
        }

        public static ApiResponse ErrorResponse(string error, string message = "An error occurred")
        {
            return new ApiResponse
            {
                Success = false,
                Error = error,
                Message = message,
                Timestamp = DateTime.UtcNow
            };
        }

        public static ApiResponse UnauthorizedResponse()
        {
            return new ApiResponse
            {
                Success = false,
                Error = "Unauthorized",
                Message = "Unable to authenticate with Bold Reports",
                Timestamp = DateTime.UtcNow
            };
        }
    }
}
