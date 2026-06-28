using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Runtime.Serialization;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

namespace BoldAdhocEmbed.Server.Services
{
    public interface IBoldBIDashboardService
    {
        Task<string> GetTokenAsync(string email);
        Task<List<BoldDashboard>> GetDashboardsAsync(string token);
        Task<BoldDashboard> GetDashboardAsync(string token, string dashboardId);
        Task<BoldBIEmbedConfig> GetEmbedConfigAsync(string dashboardId);
        Task<string> GetAuthorizationTokenAsync(string embedQueryString, string userEmail, string? serverApiUrlOverride = null);
        Task<string> GetUserIdByEmailAsync(string token, string email);
        Task<List<dynamic>> GetSchedulesAsync(string token);
        Task<(bool success, int statusCode, string responseBody)> CreateScheduleAsync(string token, object schedulePayload);
        Task<(bool success, int statusCode, string responseBody)> UpdateScheduleAsync(string token, string scheduleId, object schedulePayload);
        Task<bool> DeleteScheduleAsync(string token, string scheduleId);
    }

    public class BoldBIDashboardService : IBoldBIDashboardService
    {
        private readonly BoldBISettings _settings;
        private readonly HttpClient _httpClient;
        private readonly ILogger<BoldBIDashboardService> _logger;

        public BoldBIDashboardService(BoldBISettings settings, HttpClient httpClient, ILogger<BoldBIDashboardService> logger)
        {
            _settings = settings ?? throw new ArgumentNullException(nameof(settings));
            _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        private string GetApiUrl(string endpoint) =>
            $"{_settings.ServerUrl}/api/site/{_settings.SiteIdentifier}{endpoint}";

        /// <summary>
        /// Get token using embed secret authentication for Bold BI
        /// </summary>
        public async Task<string> GetTokenAsync(string email)
        {
            try
            {
                var baseUrl = (_settings.ServerUrl ?? string.Empty).TrimEnd('/');

                var candidates = new List<string>
                {
                    $"{baseUrl}/api/site/{_settings.SiteIdentifier}/token",
                    // some deployments may expose token endpoint directly under server root
                    $"{baseUrl}/api/site/{_settings.SiteIdentifier}/v1.0/token",
                    // try without '/bi' segment if present
                    baseUrl.Contains("/bi") ? baseUrl.Replace("/bi", string.Empty) + $"/api/site/{_settings.SiteIdentifier}/token" : null
                }.Where(u => !string.IsNullOrEmpty(u)).ToList();

                var payloadObj = new
                {
                    username = email,
                    embed_secret = _settings.EmbedSecret,
                    grant_type = "embed_secret"
                };

                var content = new StringContent(JsonConvert.SerializeObject(payloadObj), Encoding.UTF8, "application/json");

                foreach (var tokenUrl in candidates)
                {
                    try
                    {
                        _logger.LogInformation("Attempting Bold BI token request to {Url}", tokenUrl);
                        var response = await _httpClient.PostAsync(tokenUrl, content);
                        var responseContent = await response.Content.ReadAsStringAsync();

                        if (response.IsSuccessStatusCode)
                        {
                            var tokenResponse = JsonConvert.DeserializeObject<BoldBITokenResponse>(responseContent);
                            if (tokenResponse?.access_token != null)
                            {
                                _logger.LogInformation("Bold BI token generated successfully for user {Email} using {Url}", email, tokenUrl);
                                return tokenResponse.access_token;
                            }
                        }

                        _logger.LogWarning("Token generation attempt to {Url} failed with status {StatusCode}: {Response}", tokenUrl, response.StatusCode, responseContent);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Token generation attempt to {Url} threw exception", tokenUrl);
                    }
                }

                _logger.LogWarning("All token generation attempts failed for Bold BI user {Email}", email);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Bold BI token generation failed");
                return null;
            }
        }

        /// <summary>
        /// Get list of dashboards from Bold BI
        /// </summary>
        public async Task<List<BoldDashboard>> GetDashboardsAsync(string token)
        {
            try
            {
                var baseUrl = (_settings.ServerUrl ?? string.Empty).TrimEnd('/');
                var candidates = new List<string>
                {
                    $"{baseUrl}/api/site/{_settings.SiteIdentifier}/v5.0/dashboards",
                    $"{baseUrl}/api/site/{_settings.SiteIdentifier}/dashboards",
                    baseUrl.Contains("/bi") ? baseUrl.Replace("/bi", string.Empty) + $"/api/site/{_settings.SiteIdentifier}/v5.0/dashboards" : null
                }.Where(u => !string.IsNullOrEmpty(u)).ToList();

                foreach (var dashboardsUrl in candidates)
                {
                    try
                    {
                        _logger.LogInformation("Attempting to retrieve dashboards from {Url}", dashboardsUrl);
                        using var request = new HttpRequestMessage(HttpMethod.Get, dashboardsUrl);
                        request.Headers.Add("Authorization", $"Bearer {token}");

                        var response = await _httpClient.SendAsync(request);
                        var content = await response.Content.ReadAsStringAsync();

                        if (response.IsSuccessStatusCode)
                        {
                            var apiResponse = JsonConvert.DeserializeObject<BoldBIDashboardListResponse>(content);
                            var dashboards = apiResponse?.Data ?? new List<BoldDashboard>();
                            _logger.LogInformation("Retrieved {DashboardCount} dashboards from Bold BI using {Url}", dashboards.Count, dashboardsUrl);
                            return dashboards;
                        }

                        _logger.LogWarning("Dashboard retrieval from {Url} failed with status {StatusCode}: {Response}", dashboardsUrl, response.StatusCode, content);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Exception while retrieving dashboards from {Url}", dashboardsUrl);
                    }
                }

                _logger.LogWarning("All attempts to retrieve dashboards failed for site {Site}", _settings.SiteIdentifier);
                return new List<BoldDashboard>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Get dashboards from Bold BI failed");
                return new List<BoldDashboard>();
            }
        }

        /// <summary>
        /// Get BI User ID for a given email address
        /// </summary>
        public async Task<string> GetUserIdByEmailAsync(string token, string email)
        {
            try
            {
                var baseUrl = (_settings.ServerUrl ?? string.Empty).TrimEnd('/');
                var url = $"{baseUrl}/api/site/{_settings.SiteIdentifier}/v5.0/users/{System.Uri.EscapeDataString(email)}";

                _logger.LogInformation("Retrieving BI User ID from {Url}", url);
                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.Add("Authorization", $"Bearer {token}");

                var response = await _httpClient.SendAsync(request);
                var content = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    var userObj = JsonConvert.DeserializeObject<dynamic>(content);
                    if (userObj != null && userObj.UserId != null)
                    {
                        string userId = (string)userObj.UserId.ToString();
                        _logger.LogInformation("Retrieved BI User ID {UserId} for {Email}", userId, email);
                        return userId;
                    }
                }
                _logger.LogWarning("Failed to retrieve BI User ID for {Email} with status {StatusCode}: {Response}", email, response.StatusCode, content);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception while retrieving BI User ID for {Email}", email);
            }
            return null;
        }

        /// <summary>
        /// Get specific dashboard details
        /// </summary>
        public async Task<BoldDashboard> GetDashboardAsync(string token, string dashboardId)
        {
            try
            {
                var dashboardUrl = GetApiUrl($"/dashboards/{Uri.EscapeDataString(dashboardId)}");
                
                using var request = new HttpRequestMessage(HttpMethod.Get, dashboardUrl);
                request.Headers.Add("Authorization", $"Bearer {token}");

                var response = await _httpClient.SendAsync(request);
                
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    var dashboard = JsonConvert.DeserializeObject<BoldDashboard>(content);
                    
                    _logger.LogInformation("Retrieved dashboard {DashboardId} from Bold BI", dashboardId);
                    return dashboard;
                }
                
                _logger.LogWarning("Get dashboard {DashboardId} failed with status {StatusCode}", dashboardId, response.StatusCode);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Get dashboard {DashboardId} from Bold BI failed", dashboardId);
                return null;
            }
        }

        /// <summary>
        /// Get embed configuration for dashboard
        /// </summary>
        public async Task<BoldBIEmbedConfig> GetEmbedConfigAsync(string dashboardId)
        {
            try
            {
                var config = new BoldBIEmbedConfig
                {
                    DashboardId = dashboardId,
                    ServerUrl = _settings.ServerUrl,
                    SiteIdentifier = _settings.SiteIdentifier,
                    Environment = _settings.Environment,
                    UserEmail = _settings.UserEmail,
                    EmbedType = "component",
                    ExpirationTime = 10000
                };

                _logger.LogInformation("Generated embed config for dashboard {DashboardId}", dashboardId);
                return await Task.FromResult(config);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Get embed config failed for dashboard {DashboardId}", dashboardId);
                return null;
            }
        }

        /// <summary>
        /// Get authorization token for dashboard embedding
        /// </summary>
        public async Task<string> GetAuthorizationTokenAsync(string embedQueryString, string userEmail, string? serverApiUrlOverride = null)
        {
            try
            {
                if (string.IsNullOrEmpty(embedQueryString))
                {
                    _logger.LogError("Authorization failed: embedQueryString is empty or null");
                    return null;
                }

                string authUrl;
                if (!string.IsNullOrWhiteSpace(serverApiUrlOverride))
                {
                    var baseUrl = serverApiUrlOverride!.TrimEnd('/');
                    if (baseUrl.Contains("/embed/authorize", StringComparison.OrdinalIgnoreCase))
                    {
                        authUrl = baseUrl;
                    }
                    else if (baseUrl.Contains("/api/site/", StringComparison.OrdinalIgnoreCase))
                    {
                        authUrl = baseUrl + "/embed/authorize";
                    }
                    else
                    {
                        authUrl = $"{baseUrl}/api/site/{_settings.SiteIdentifier}/embed/authorize";
                    }
                }
                else
                {
                    authUrl = GetApiUrl("/embed/authorize");
                }
                
                _logger.LogInformation("Building authorization query with embedQueryString: {EmbedQueryString}", embedQueryString);
                
                // Build the query string with user email and timestamp
                var embedQuery = embedQueryString;
                embedQuery += "&embed_user_email=" + Uri.EscapeDataString(userEmail);
                
                double timeStamp = (long)DateTime.UtcNow.Subtract(new DateTime(1970, 1, 1)).TotalSeconds;
                embedQuery += "&embed_server_timestamp=" + timeStamp;
                
                // Generate signature
                var signature = GenerateSignature(embedQuery, _settings.EmbedSecret);
                
                if (string.IsNullOrEmpty(signature))
                {
                    _logger.LogError("Authorization failed: Failed to generate signature");
                    return null;
                }
                
                embedQuery += "&embed_signature=" + signature;

                _logger.LogInformation("Calling Bold BI authorization endpoint: {AuthUrl}", authUrl);
                
                // Call authorization endpoint
                var fullUrl = $"{authUrl}?{embedQuery}";
                
                using var request = new HttpRequestMessage(HttpMethod.Get, fullUrl);
                var response = await _httpClient.SendAsync(request);
                
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    _logger.LogInformation("Authorization token generated successfully for user {UserEmail}", userEmail);
                    return content;
                }
                
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Authorization failed with status {StatusCode}: {ErrorContent}", response.StatusCode, errorContent);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception in GetAuthorizationTokenAsync");
                return null;
            }
        }

        /// <summary>
        /// Generate HMAC-SHA256 signature for embed requests
        /// </summary>
        private string GenerateSignature(string queryString, string embedSecret)
        {
            try
            {
                var encoding = new UTF8Encoding();
                var keyBytes = encoding.GetBytes(embedSecret);
                var messageBytes = encoding.GetBytes(queryString);

                using (var hmacsha256 = new HMACSHA256(keyBytes))
                {
                    var hashMessage = hmacsha256.ComputeHash(messageBytes);
                    return Convert.ToBase64String(hashMessage);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Signature generation failed");
                return null;
            }
        }

        /// <summary>
        /// Get list of dashboard schedules from Bold BI
        /// </summary>
        public async Task<List<dynamic>> GetSchedulesAsync(string token)
        {
            try
            {
                var baseUrl = (_settings.ServerUrl ?? string.Empty).TrimEnd('/');
                var url = $"{baseUrl}/api/site/{_settings.SiteIdentifier}/v3.0/dashboards/schedules";

                _logger.LogInformation("Retrieving dashboard schedules from {Url}", url);
                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.Add("Authorization", $"Bearer {token}");

                var response = await _httpClient.SendAsync(request);
                var content = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    var apiResponse = JsonConvert.DeserializeObject<dynamic>(content);
                    if (apiResponse != null)
                    {
                        var data = apiResponse.Data != null ? apiResponse.Data : apiResponse;
                        var list = JsonConvert.DeserializeObject<List<dynamic>>(data.ToString());
                        return list ?? new List<dynamic>();
                    }
                }
                _logger.LogWarning("Failed to retrieve dashboard schedules from {Url} with status {StatusCode}: {Response}", url, response.StatusCode, content);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Get dashboard schedules from Bold BI failed");
            }
            return new List<dynamic>();
        }

        /// <summary>
        /// Create a new dashboard schedule in Bold BI
        /// </summary>
        public async Task<(bool success, int statusCode, string responseBody)> CreateScheduleAsync(string token, object schedulePayload)
        {
            try
            {
                var baseUrl = (_settings.ServerUrl ?? string.Empty).TrimEnd('/');
                var url = $"{baseUrl}/api/site/{_settings.SiteIdentifier}/v3.0/dashboards/schedules";

                string json = schedulePayload is string s ? s : JsonConvert.SerializeObject(schedulePayload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                _logger.LogInformation("Posting dashboard schedule to {Url}: {Payload}", url, json);

                using var httpRequest = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = content
                };
                httpRequest.Headers.Add("Authorization", $"Bearer {token}");

                var response = await _httpClient.SendAsync(httpRequest);
                var respBody = await response.Content.ReadAsStringAsync();
                
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Create dashboard schedule failed with status {StatusCode}: {Response}", response.StatusCode, respBody);
                    return (false, (int)response.StatusCode, respBody);
                }

                _logger.LogInformation("Create dashboard schedule succeeded with status {StatusCode}: {Response}", response.StatusCode, respBody);
                return (true, (int)response.StatusCode, respBody);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Create dashboard schedule failed");
                return (false, 0, ex.Message);
            }
        }

        /// <summary>
        /// Update an existing dashboard schedule in Bold BI
        /// </summary>
        public async Task<(bool success, int statusCode, string responseBody)> UpdateScheduleAsync(string token, string scheduleId, object schedulePayload)
        {
            try
            {
                var baseUrl = (_settings.ServerUrl ?? string.Empty).TrimEnd('/');
                var url = $"{baseUrl}/api/site/{_settings.SiteIdentifier}/v3.0/dashboards/schedules/{Uri.EscapeDataString(scheduleId)}";

                string json = schedulePayload is string s ? s : JsonConvert.SerializeObject(schedulePayload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                _logger.LogInformation("Updating dashboard schedule at {Url}: {Payload}", url, json);

                using var httpRequest = new HttpRequestMessage(HttpMethod.Put, url)
                {
                    Content = content
                };
                httpRequest.Headers.Add("Authorization", $"Bearer {token}");

                var response = await _httpClient.SendAsync(httpRequest);
                var respBody = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Update dashboard schedule failed with status {StatusCode}: {Response}", response.StatusCode, respBody);
                    return (false, (int)response.StatusCode, respBody);
                }

                _logger.LogInformation("Update dashboard schedule succeeded with status {StatusCode}: {Response}", response.StatusCode, respBody);
                return (true, (int)response.StatusCode, respBody);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Update dashboard schedule failed for {ScheduleId}", scheduleId);
                return (false, 0, ex.Message);
            }
        }

        /// <summary>
        /// Delete an existing dashboard schedule from Bold BI
        /// </summary>
        public async Task<bool> DeleteScheduleAsync(string token, string scheduleId)
        {
            try
            {
                var baseUrl = (_settings.ServerUrl ?? string.Empty).TrimEnd('/');
                var url = $"{baseUrl}/api/site/{_settings.SiteIdentifier}/v3.0/dashboards/schedules/{Uri.EscapeDataString(scheduleId)}";

                _logger.LogInformation("Deleting dashboard schedule at {Url}", url);
                using var httpRequest = new HttpRequestMessage(HttpMethod.Delete, url);
                httpRequest.Headers.Add("Authorization", $"Bearer {token}");

                var response = await _httpClient.SendAsync(httpRequest);
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Delete dashboard schedule failed for {ScheduleId}", scheduleId);
                return false;
            }
        }
    }

    // Settings
    public class BoldBISettings
    {
        public string ServerUrl { get; set; }
        public string SiteIdentifier { get; set; }
        public string AdminUser { get; set; }
        public string AdminPassword { get; set; }
        public string EmbedSecret { get; set; }
        public string UserEmail { get; set; }
        public string Environment { get; set; }
    }

    // Models
    public class BoldDashboard
    {
        [JsonProperty("Id")]
        public string Id { get; set; }

        [JsonProperty("Name")]
        public string Name { get; set; }

        [JsonProperty("Description")]
        public string Description { get; set; }

        [JsonProperty("ItemType")]
        public string ItemType { get; set; }

        [JsonProperty("CreatedDate")]
        public DateTime? CreatedDate { get; set; }

        [JsonProperty("ModifiedDate")]
        public DateTime? ModifiedDate { get; set; }

        [JsonProperty("CreatedByDisplayName")]
        public string CreatedBy { get; set; }

        [JsonProperty("ModifiedByFullName")]
        public string ModifiedBy { get; set; }

        public string Owner => CreatedBy;

        [JsonProperty("CreatedById")]
        public string OwnerId { get; set; }

        [JsonProperty("IsPublic")]
        public bool? IsPublic { get; set; }

        [JsonProperty("tags")]
        public List<string> Tags { get; set; }

        [JsonProperty("CategoryName")]
        public string Category { get; set; }
    }

    public class BoldBIDashboardListResponse
    {
        [JsonProperty("Data")]
        public List<BoldDashboard> Data { get; set; }

        [JsonProperty("TotalResults")]
        public int TotalResults { get; set; }

        [JsonProperty("Links")]
        public List<object> Links { get; set; }
    }

    public class BoldBIEmbedConfig
    {
        public string DashboardId { get; set; }
        public string ServerUrl { get; set; }
        public string SiteIdentifier { get; set; }
        public string Environment { get; set; }
        public string UserEmail { get; set; }
        public string EmbedType { get; set; }
        public long ExpirationTime { get; set; }
        public string Token { get; set; }
    }

    public class BoldBITokenResponse
    {
        [JsonProperty("access_token")]
        public string access_token { get; set; }

        [JsonProperty("token_type")]
        public string token_type { get; set; }

        [JsonProperty("expires_in")]
        public string expires_in { get; set; }
    }

    public class AuthorizeRequest
    {
        [JsonProperty("embedQuerString")]
        public string EmbedQueryString { get; set; }

        [JsonProperty("dashboardServerApiUrl")]
        public string DashboardServerApiUrl { get; set; }
    }

    public class EmbedRequest
    {
        [JsonProperty("embedQuery")]
        public string EmbedQuery { get; set; }
    }
    [DataContract]
    public class EmbedClass
    {
        [DataMember]
        public string embedQuerString { get; set; }
        [DataMember]
        public string dashboardServerApiUrl { get; set; }
    }
}
