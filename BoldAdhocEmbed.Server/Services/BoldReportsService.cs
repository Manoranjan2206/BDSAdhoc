using Newtonsoft.Json;
using System.Net.Http;
using System.Text;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Linq;
using System.Security.Cryptography;
using Microsoft.Extensions.Logging;

namespace BoldAdhocEmbed.Server.Services
{
    public interface IBoldReportsService
    {
        Task<string> GetTokenAsync(string username, string password);
        Task<string> GetTokenFromSecretAsync(string email);
        Task<List<BoldUser>> GetUsersAsync(string token);
        Task<List<BoldUser>> GetUsersV5Async(string token);
        Task<BoldUser> GetUserAsync(string token, string email);
        Task<bool> CreateUserAsync(string token, CreateBoldUserRequest request);
        Task<bool> UpdateUserAsync(string token, string email, UpdateBoldUserRequest request);
        Task<bool> DeleteUserAsync(string token, string email);
        Task<List<BoldGroup>> GetGroupsAsync(string token);
        Task<BoldGroup> GetGroupAsync(string token, string groupId);
        Task<bool> CreateGroupAsync(string token, CreateBoldGroupRequest request);
        Task<List<BoldReport>> GetReportsAsync(string token);
        Task<bool> DeleteReportAsync(string token, string reportName, string categoryName = null);
        Task<List<BoldSchedule>> GetSchedulesAsync(string token);
        Task<BoldScheduleDetail> GetScheduleDetailAsync(string token, string scheduleIdOrName);
        Task<bool> RunScheduleNowAsync(string token, string scheduleIdOrName);
        Task<(bool success, int statusCode, string responseBody)> CreateScheduleAsync(string token, object schedulePayload);
        Task<(bool success, int statusCode, string responseBody)> UpdateScheduleAsync(string token, string scheduleId, object schedulePayload);
        Task<bool> DeleteScheduleAsync(string token, string scheduleIdOrName);
        Task<byte[]> ExportReportAsync(string token, string reportId, string exportType = "PDF");
    }

    public class BoldReportsService : IBoldReportsService
    {
        private readonly BoldReportsSettings _settings;
        private readonly HttpClient _httpClient;
        private readonly ILogger<BoldReportsService> _logger;

        public BoldReportsService(BoldReportsSettings settings, HttpClient httpClient, ILogger<BoldReportsService> logger)
        {
            _settings = settings;
            _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        // Ensure the Authorization header value includes the 'Bearer ' prefix
        private string NormalizeAuthHeader(string token)
        {
            if (string.IsNullOrWhiteSpace(token)) return token;
            return token.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? token : $"Bearer {token}";
        }

        private string GetApiUrl(string endpoint) =>
            $"{_settings.ReportRootUrl}/api/site/{_settings.ReportsSiteIdentifier}/v1.0{endpoint}";

        private string GetV5ApiUrl(string endpoint) =>
            $"{_settings.ReportRootUrl}/api/site/{_settings.ReportsSiteIdentifier}/v5.0{endpoint}";

        private string GetV5ReportingApiUrl(string endpoint) =>
            $"{_settings.ReportRootUrl}/reporting/api/site/{_settings.ReportsSiteIdentifier}/v5.0{endpoint}";

        /// <summary>
        /// Get token using username and password
        /// </summary>
        public async Task<string> GetTokenAsync(string username, string password)
        {
            try
            {
                var tokenUrl = $"{_settings.ReportRootUrl}/api/site/{_settings.ReportsSiteIdentifier}/token";
                var content = new FormUrlEncodedContent(new[]
                {
                    new KeyValuePair<string, string>("grant_type", "password"),
                    new KeyValuePair<string, string>("username", username),
                    new KeyValuePair<string, string>("password", password)
                });

                var response = await _httpClient.PostAsync(tokenUrl, content);
                if (response.IsSuccessStatusCode)
                {
                    var responseContent = await response.Content.ReadAsStringAsync();
                    var tokenResponse = JsonConvert.DeserializeObject<TokenResponse>(responseContent);
                    return $"{tokenResponse.token_type} {tokenResponse.access_token}";
                }
                _logger.LogWarning("Token generation failed with status {StatusCode}", response.StatusCode);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Token generation failed");
                return null;
            }
        }

        /// <summary>
        /// Get token using embed secret key (when password is empty)
        /// </summary>
        public async Task<string> GetTokenFromSecretAsync(string email)
        {
            try
            {
                // If embed secret is not configured, fall back to password auth
                if (string.IsNullOrEmpty(_settings.EmbedSecret))
                {
                    _logger.LogInformation("Embed secret not configured, attempting password authentication");
                    return await GetTokenAsync(email, _settings.AdminPassword);
                }

                string secretCode = _settings.EmbedSecret;
                string nonce = Guid.NewGuid().ToString();
                string timeStamp = DateTimeToUnixTimeStamp(DateTime.UtcNow).ToString();
                string tokenUrl = $"{_settings.ReportRootUrl}/api/site/{_settings.ReportsSiteIdentifier}/token";

                // Create the embed message
                string embedMessage = $"embed_nonce={nonce}&user_email={email}&timestamp={timeStamp}";
                string signature = SignUrl(embedMessage.ToLower(), secretCode);

                var content = new FormUrlEncodedContent(new[]
                {
                    new KeyValuePair<string, string>("grant_type", "embed_secret"),
                    new KeyValuePair<string, string>("username", email),
                    new KeyValuePair<string, string>("embed_nonce", nonce),
                    new KeyValuePair<string, string>("embed_signature", signature),
                    new KeyValuePair<string, string>("timestamp", timeStamp)
                });

                var response = await _httpClient.PostAsync(tokenUrl, content);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    var tokenResponse = JsonConvert.DeserializeObject<TokenResponse>(responseContent);
                    if (tokenResponse != null)
                    {
                        return $"{tokenResponse.token_type} {tokenResponse.access_token}";
                    }
                }
                else
                {
                    var errorResponse = JsonConvert.DeserializeObject<TokenErrorResponse>(responseContent);
                    _logger.LogWarning("Token generation failed: {ErrorDescription}", errorResponse?.error_description);
                }

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Token generation from secret failed");
                return null;
            }
        }

        /// <summary>
        /// Convert DateTime to Unix timestamp
        /// </summary>
        private long DateTimeToUnixTimeStamp(DateTime dateTime) =>
            (long)(dateTime - new DateTime(1970, 1, 1)).TotalSeconds;

        /// <summary>
        /// Sign URL using HMAC-SHA256
        /// </summary>
        private string SignUrl(string message, string secretKey)
        {
            try
            {
                using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secretKey)))
                {
                    var hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(message));
                    return Convert.ToBase64String(hashBytes);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "URL signing failed");
                return null;
            }
        }

        public async Task<List<BoldUser>> GetUsersAsync(string token)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, GetApiUrl("/users"));
                request.Headers.Add("Authorization", NormalizeAuthHeader(token));

                var response = await _httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    return JsonConvert.DeserializeObject<List<BoldUser>>(content) ?? new List<BoldUser>();
                }
                _logger.LogWarning("Get users failed (v1.0) with status {StatusCode}", response.StatusCode);
                return new List<BoldUser>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Get users failed (v1.0)");
                return new List<BoldUser>();
            }
        }

        // v5.0 users listing
        public async Task<List<BoldUser>> GetUsersV5Async(string token)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, GetV5ApiUrl("/users"));
                request.Headers.Add("Authorization", NormalizeAuthHeader(token));

                var response = await _httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();

                    // v5 payload can be an object with a UserList array
                    try
                    {
                        var wrapper = JsonConvert.DeserializeObject<BoldUsersV5Response>(content);
                        if (wrapper?.UserList != null)
                        {
                            return wrapper.UserList.Select(u => new BoldUser
                            {
                                Id = (u.UserId == null ? null : u.UserId.ToString()),
                                Email = u.Email,
                                FirstName = u.FirstName,
                                LastName = u.Lastname,
                                FullName = u.DisplayName,
                                ContactNumber = u.ContactNumber,
                                IsActive = u.IsActive
                            }).Where(u => !string.IsNullOrEmpty(u.Email)).ToList();
                        }
                    }
                    catch { }

                    // Some servers may still return a plain array compatible with BoldUser
                    try
                    {
                        var list = JsonConvert.DeserializeObject<List<BoldUser>>(content);
                        if (list != null) return list;
                    }
                    catch { }
                }
                _logger.LogWarning("Get users failed (v5.0) with status {StatusCode}", response.StatusCode);
                return new List<BoldUser>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Get users failed (v5.0)");
                return new List<BoldUser>();
            }
        }

        public async Task<BoldUser> GetUserAsync(string token, string email)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, GetApiUrl($"/users/{email}"));
                request.Headers.Add("Authorization", NormalizeAuthHeader(token));

                var response = await _httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    return JsonConvert.DeserializeObject<BoldUser>(content);
                }
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Get user failed for email {Email}", email);
                return null;
            }
        }

        public async Task<bool> CreateUserAsync(string token, CreateBoldUserRequest request)
        {
            try
            {
                var json = JsonConvert.SerializeObject(request);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                using var httpRequest = new HttpRequestMessage(HttpMethod.Post, GetApiUrl("/users"))
                {
                    Content = content
                };
                httpRequest.Headers.Add("Authorization", NormalizeAuthHeader(token));

                var response = await _httpClient.SendAsync(httpRequest);
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Create user failed for email {Email}", request.Email);
                return false;
            }
        }

        public async Task<bool> UpdateUserAsync(string token, string email, UpdateBoldUserRequest request)
        {
            try
            {
                var json = JsonConvert.SerializeObject(request);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                using var httpRequest = new HttpRequestMessage(HttpMethod.Put, GetApiUrl($"/users/{email}"))
                {
                    Content = content
                };
                httpRequest.Headers.Add("Authorization", NormalizeAuthHeader(token));

                var response = await _httpClient.SendAsync(httpRequest);
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Update user failed for email {Email}", email);
                return false;
            }
        }

        public async Task<bool> DeleteUserAsync(string token, string email)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Delete, GetApiUrl($"/users/{email}"));
                request.Headers.Add("Authorization", NormalizeAuthHeader(token));

                var response = await _httpClient.SendAsync(request);
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Delete user failed for email {Email}", email);
                return false;
            }
        }

        public async Task<List<BoldGroup>> GetGroupsAsync(string token)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, GetApiUrl("/groups"));
                request.Headers.Add("Authorization", NormalizeAuthHeader(token));

                var response = await _httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    return JsonConvert.DeserializeObject<List<BoldGroup>>(content) ?? new List<BoldGroup>();
                }
                return new List<BoldGroup>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Get groups failed");
                return new List<BoldGroup>();
            }
        }

        public async Task<BoldGroup> GetGroupAsync(string token, string groupId)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, GetApiUrl($"/groups/{groupId}"));
                request.Headers.Add("Authorization", NormalizeAuthHeader(token));

                var response = await _httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    return JsonConvert.DeserializeObject<BoldGroup>(content);
                }
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Get group failed for group {GroupId}", groupId);
                return null;
            }
        }

        public async Task<bool> CreateGroupAsync(string token, CreateBoldGroupRequest request)
        {
            try
            {
                var json = JsonConvert.SerializeObject(request);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                using var httpRequest = new HttpRequestMessage(HttpMethod.Post, GetApiUrl("/groups"))
                {
                    Content = content
                };
                httpRequest.Headers.Add("Authorization", NormalizeAuthHeader(token));

                var response = await _httpClient.SendAsync(httpRequest);
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Create group failed for group {GroupName}", request.Name);
                return false;
            }
        }

        public async Task<List<BoldReport>> GetReportsAsync(string token)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, GetApiUrl("/items?itemtype=Report"));
                request.Headers.Add("Authorization", NormalizeAuthHeader(token));

                var response = await _httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    return JsonConvert.DeserializeObject<List<BoldReport>>(content) ?? new List<BoldReport>();
                }
                return new List<BoldReport>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Get reports failed");
                return new List<BoldReport>();
            }
        }

        public async Task<bool> DeleteReportAsync(string token, string reportName, string categoryName = null)
        {
            try
            {
                // Construct serverPath per Bold Reports API: '/{category}/{reportName}' or just reportName
                var serverPath = string.IsNullOrWhiteSpace(categoryName) ? reportName : $"/{categoryName.Trim()}/{reportName.Trim()}";

                // Use items delete endpoint
                var url = GetV5ApiUrl($"/items?itemType=Report&serverPath={Uri.EscapeDataString(serverPath)}");
                using var request = new HttpRequestMessage(HttpMethod.Delete, url);
                request.Headers.Add("Authorization", NormalizeAuthHeader(token));

                var response = await _httpClient.SendAsync(request);
                var respBody = await response.Content.ReadAsStringAsync();
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Delete report failed for {Report} with status {Status}: {Resp}", serverPath, response.StatusCode, respBody);
                    return false;
                }

                _logger.LogInformation("Deleted report {Report}", serverPath);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Delete report failed for {Report}", reportName);
                return false;
            }
        }

        // Schedules - v5.0
        public async Task<List<BoldSchedule>> GetSchedulesAsync(string token)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, GetV5ApiUrl("/reports/schedule/items"));
                request.Headers.Add("Authorization", NormalizeAuthHeader(token));

                var response = await _httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    return JsonConvert.DeserializeObject<List<BoldSchedule>>(content) ?? new List<BoldSchedule>();
                }
                return new List<BoldSchedule>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Get schedules failed");
                return new List<BoldSchedule>();
            }
        }

        public async Task<BoldScheduleDetail> GetScheduleDetailAsync(string token, string scheduleIdOrName)
        {
            try
            {
                var url = GetV5ApiUrl($"/reports/schedule?scheduleId={Uri.EscapeDataString(scheduleIdOrName)}");
                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.Add("Authorization", NormalizeAuthHeader(token));

                var response = await _httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    return JsonConvert.DeserializeObject<BoldScheduleDetail>(content);
                }
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Get schedule detail failed for schedule {ScheduleId}", scheduleIdOrName);
                return null;
            }
        }

        public async Task<bool> RunScheduleNowAsync(string token, string scheduleIdOrName)
        {
            try
            {
                var url = GetV5ApiUrl($"/schedules/run?scheduleId={Uri.EscapeDataString(scheduleIdOrName)}");
                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.Add("Authorization", NormalizeAuthHeader(token));

                var response = await _httpClient.SendAsync(request);
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Run schedule failed for schedule {ScheduleId}", scheduleIdOrName);
                return false;
            }
        }

        public async Task<bool> DeleteScheduleAsync(string token, string scheduleIdOrName)
        {
            try
            {
                // Try path-style delete first: /reports/schedule/{id}
                var pathUrl = GetV5ApiUrl($"/reports/schedule/{Uri.EscapeDataString(scheduleIdOrName)}");
                using var pathRequest = new HttpRequestMessage(HttpMethod.Delete, pathUrl);
                pathRequest.Headers.Add("Authorization", NormalizeAuthHeader(token));

                var pathResponse = await _httpClient.SendAsync(pathRequest);
                var pathBody = await pathResponse.Content.ReadAsStringAsync();
                if (pathResponse.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Deleted schedule (path) {ScheduleId} with status {StatusCode}", scheduleIdOrName, pathResponse.StatusCode);
                    return true;
                }

                _logger.LogWarning("Delete schedule (path) failed for {ScheduleId} with status {StatusCode}: {Resp}", scheduleIdOrName, pathResponse.StatusCode, pathBody);

                // Fallback: delete via items endpoint using itemType=Schedule and serverPath
                var itemsUrl = GetV5ApiUrl($"/items?itemType=Schedule&serverPath={Uri.EscapeDataString(scheduleIdOrName)}");
                using var itemsRequest = new HttpRequestMessage(HttpMethod.Delete, itemsUrl);
                itemsRequest.Headers.Add("Authorization", NormalizeAuthHeader(token));

                var itemsResponse = await _httpClient.SendAsync(itemsRequest);
                var itemsBody = await itemsResponse.Content.ReadAsStringAsync();
                if (itemsResponse.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Deleted schedule (items) {ScheduleId} with status {StatusCode}", scheduleIdOrName, itemsResponse.StatusCode);
                    return true;
                }

                _logger.LogWarning("Delete schedule (items) failed for {ScheduleId} with status {StatusCode}: {Resp}", scheduleIdOrName, itemsResponse.StatusCode, itemsBody);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Delete schedule failed for {ScheduleId}", scheduleIdOrName);
                return false;
            }
        }

        public async Task<(bool success, int statusCode, string responseBody)> CreateScheduleAsync(string token, object schedulePayload)
        {
            try
            {
                string json = schedulePayload is string s ? s : JsonConvert.SerializeObject(schedulePayload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var url = GetV5ApiUrl("/reports/schedule");
                _logger.LogInformation("Posting schedule to {Url}: {Payload}", url, json);

                using var httpRequest = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = content
                };
                httpRequest.Headers.Add("Authorization", NormalizeAuthHeader(token));

                var response = await _httpClient.SendAsync(httpRequest);
                var respBody = await response.Content.ReadAsStringAsync();
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Create schedule failed with status {StatusCode}: {Response}", response.StatusCode, respBody);
                    return (false, (int)response.StatusCode, respBody);
                }

                _logger.LogInformation("Create schedule succeeded with status {StatusCode}: {Response}", response.StatusCode, respBody);
                return (true, (int)response.StatusCode, respBody);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Create schedule failed");
                return (false, 0, ex.Message);
            }
        }

        public async Task<(bool success, int statusCode, string responseBody)> UpdateScheduleAsync(string token, string scheduleId, object schedulePayload)
        {
            try
            {
                string json = schedulePayload is string s ? s : JsonConvert.SerializeObject(schedulePayload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var url = GetV5ApiUrl($"/reports/schedule/{Uri.EscapeDataString(scheduleId)}");
                _logger.LogInformation("Updating schedule at {Url}: {Payload}", url, json);

                using var httpRequest = new HttpRequestMessage(HttpMethod.Put, url)
                {
                    Content = content
                };
                httpRequest.Headers.Add("Authorization", NormalizeAuthHeader(token));

                var response = await _httpClient.SendAsync(httpRequest);
                var respBody = await response.Content.ReadAsStringAsync();
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Update schedule failed with status {StatusCode}: {Response}", response.StatusCode, respBody);
                    return (false, (int)response.StatusCode, respBody);
                }

                _logger.LogInformation("Update schedule succeeded with status {StatusCode}: {Response}", response.StatusCode, respBody);
                return (true, (int)response.StatusCode, respBody);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Update schedule failed");
                return (false, 0, ex.Message);
            }
        }

        public async Task<byte[]> ExportReportAsync(string token, string reportId, string exportType = "PDF")
        {
            try
            {
                var request = new { ReportId = reportId, ExportType = exportType };
                var json = JsonConvert.SerializeObject(request);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                using var httpRequest = new HttpRequestMessage(HttpMethod.Post, GetApiUrl("/reports/export"))
                {
                    Content = content
                };
                httpRequest.Headers.Add("Authorization", NormalizeAuthHeader(token));

                var response = await _httpClient.SendAsync(httpRequest);
                if (response.IsSuccessStatusCode)
                {
                    var responseContent = await response.Content.ReadAsStringAsync();
                    var exportResponse = JsonConvert.DeserializeObject<ExportResponse>(responseContent);
                    return exportResponse?.FileContent;
                }
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Export report failed for report {ReportId}", reportId);
                return null;
            }
        }
    }

    // Models
    public class BoldReportsSettings
    {
        public string ReportRootUrl { get; set; }
        public string ReportsSiteIdentifier { get; set; }
        public string AdminUser { get; set; }
        public string AdminPassword { get; set; }
        public string EmbedSecret { get; set; }
    }

    public class TokenResponse
    {
        public string access_token { get; set; }
        public string token_type { get; set; }
        public string expires_in { get; set; }
        public string refresh_token { get; set; }
    }

    public class TokenErrorResponse
    {
        public string error { get; set; }
        public string error_description { get; set; }
    }

    // v5.0 users wrapper and model
    public class BoldUsersV5Response
    {
        [JsonProperty("UserList")] public List<BoldUserV5> UserList { get; set; }
    }

    public class BoldUserV5
    {
        [JsonProperty("UserId")] public int? UserId { get; set; }
        [JsonProperty("Email")] public string Email { get; set; }
        [JsonProperty("FirstName")] public string FirstName { get; set; }
        [JsonProperty("Lastname")] public string Lastname { get; set; }
        [JsonProperty("DisplayName")] public string DisplayName { get; set; }
        [JsonProperty("ContactNumber")] public string ContactNumber { get; set; }
        [JsonProperty("IsActive")] public bool IsActive { get; set; }
    }

    public class BoldUser
    {
        private string _id;

        [JsonProperty("Id")]
        public string Id 
        { 
            get => _id ?? UserId; 
            set => _id = value; 
        }

        [JsonProperty("UserId")]
        public string UserId { get; set; }
        
        [JsonProperty("Email")]
        public string Email { get; set; }
        
        [JsonProperty("FirstName")]
        public string FirstName { get; set; }
        
        [JsonProperty("Lastname")]
        public string LastName { get; set; }
        
        [JsonProperty("FullName")]
        public string FullName { get; set; }
        
        [JsonProperty("ContactNumber")]
        public string ContactNumber { get; set; }
        
        [JsonProperty("IsActive")]
        public bool IsActive { get; set; }
    }

    public class CreateBoldUserRequest
    {
        [JsonProperty("Email")]
        public string Email { get; set; }
        
        [JsonProperty("FirstName")]
        public string FirstName { get; set; }
        
        [JsonProperty("Lastname")]
        public string LastName { get; set; }
        
        [JsonProperty("Password")]
        public string Password { get; set; }
    }

    public class UpdateBoldUserRequest
    {
        [JsonProperty("FirstName")]
        public string FirstName { get; set; }
        
        [JsonProperty("Lastname")]
        public string LastName { get; set; }
        
        [JsonProperty("ContactNumber")]
        public string ContactNumber { get; set; }
    }

    public class BoldGroup
    {
        [JsonProperty("Id")]
        public string Id { get; set; }
        
        [JsonProperty("Name")]
        public string Name { get; set; }
        
        [JsonProperty("Description")]
        public string Description { get; set; }
    }

    public class CreateBoldGroupRequest
    {
        [JsonProperty("Name")]
        public string Name { get; set; }
        
        [JsonProperty("Description")]
        public string Description { get; set; }
    }

    public class BoldReport
    {
        [JsonProperty("Id")]
        public string Id { get; set; }
        
        [JsonProperty("Name")]
        public string Name { get; set; }
        
        [JsonProperty("Description")]
        public string Description { get; set; }
        
        [JsonProperty("CategoryName")]
        public string CategoryName { get; set; }
        
        [JsonProperty("ItemType")]
        public string ItemType { get; set; }
        
        [JsonProperty("CanWrite")]
        public bool CanWrite { get; set; }
        
        [JsonProperty("CanRead")]
        public bool CanRead { get; set; }

        [JsonProperty("CreatedById")]
        public int CreatedById { get; set; }

        [JsonProperty("IsPublic")]
        public bool IsPublic { get; set; }

        [JsonProperty("ModifiedDate")]
        public string ModifiedDate { get; set; }

        [JsonProperty("CreatedDate")]
        public string CreatedDate { get; set; }

        [JsonProperty("ModifiedDateString")]
        public string ModifiedDateString { get; set; }
    }

    public class ExportResponse
    {
        [JsonProperty("FileContent")]
        public byte[]? FileContent { get; set; }
        
        [JsonProperty("ItemName")]
        public string? ItemName { get; set; }
        
        [JsonProperty("Status")]
        public bool Status { get; set; }
    }

    // V5.0 Schedule models (properties are optional to accommodate API variations)
    public class BoldSchedule
    {
        [JsonProperty("Id")] public string? Id { get; set; }
        [JsonProperty("Name")] public string? Name { get; set; }
        [JsonProperty("Description")] public string? Description { get; set; }
        [JsonProperty("ItemId")] public string? ItemId { get; set; }
        [JsonProperty("ItemType")] public string? ItemType { get; set; }
        [JsonProperty("CategoryName")] public string? CategoryName { get; set; }
        [JsonProperty("Enabled")] public bool? Enabled { get; set; }
        [JsonProperty("ExportType")] public string? ExportType { get; set; }
    }

    public class BoldScheduleDetail : BoldSchedule
    {
        // Common metadata
        [JsonProperty("CreatedById")] public int? CreatedById { get; set; }
        [JsonProperty("CreatedDate")] public DateTime? CreatedDate { get; set; }
        [JsonProperty("ModifiedById")] public int? ModifiedById { get; set; }
        [JsonProperty("ModifiedDate")] public DateTime? ModifiedDate { get; set; }

        // Scheduling
        [JsonProperty("StartDate")] public DateTime? StartDate { get; set; }
        [JsonProperty("EndDate")] public DateTime? EndDate { get; set; }
        [JsonProperty("NeverEnd")] public bool? NeverEnd { get; set; }
        [JsonProperty("EndAfterOccurrence")] public int? EndAfterOccurrence { get; set; }
        [JsonProperty("NextSchedule")] public DateTime? NextSchedule { get; set; }

        // Status / flags
        [JsonProperty("IsActive")] public bool? IsActive { get; set; }
        [JsonProperty("IsEnabled")] public bool? IsEnabled { get; set; }
        [JsonProperty("IsSendAsMail")] public bool? IsSendAsMail { get; set; }

        // Identification
        [JsonProperty("ScheduleId")] public string? ScheduleId { get; set; }
        [JsonProperty("ScheduleName")] public string? ScheduleName { get; set; }
        [JsonProperty("ReportId")] public string? ReportId { get; set; }
        [JsonProperty("ReportName")] public string? ReportName { get; set; }

        // Export
        [JsonProperty("ExportType")] public string? ExportTypeCode { get; set; } // numeric string per API
        [JsonProperty("ExportTypeId")] public int? ExportTypeId { get; set; }
        [JsonProperty("EnabledLocalExport")] public bool? EnabledLocalExport { get; set; }
        [JsonProperty("IsSaveAsFile")] public bool? IsSaveAsFile { get; set; }
        [JsonProperty("IsNotifyUser")] public bool? IsNotifyUser { get; set; }
        [JsonProperty("IsOverWriteExistingFile")] public bool? IsOverWriteExistingFile { get; set; }
        [JsonProperty("MaxFileCount")] public int? MaxFileCount { get; set; }
        [JsonProperty("EnableS3Export")] public bool? EnableS3Export { get; set; }
        [JsonProperty("EnableFtpExport")] public bool? EnableFtpExport { get; set; }

        // Recurrence
        [JsonProperty("RecurrenceTypeId")] public int? RecurrenceTypeId { get; set; }
        [JsonProperty("RecurrenceType")] public string? RecurrenceType { get; set; }
        [JsonProperty("HourlySchedule")] public HourlySchedule? HourlySchedule { get; set; }

        // Audience
        [JsonProperty("UserList")] public List<int>? UserList { get; set; }
        [JsonProperty("GroupList")] public List<int>? GroupList { get; set; }
        [JsonProperty("ExternalRecipientsList")] public List<string>? ExternalRecipientsList { get; set; }

        // Email
        [JsonProperty("EmailTemplate")] public EmailTemplate? EmailTemplate { get; set; }

        // Parameters
        [JsonProperty("ReportParameter")] public List<ReportParameter>? ReportParameter { get; set; }
    }

    public class HourlySchedule
    {
        [JsonProperty("ScheduleInterval")] public string? ScheduleInterval { get; set; }
    }

    public class EmailTemplate
    {
        [JsonProperty("Subject")] public string? Subject { get; set; }
        [JsonProperty("EmailContent")] public string? EmailContent { get; set; }
    }

    public class ReportParameter
    {
        [JsonProperty("Name")] public string? Name { get; set; }
        [JsonProperty("Values")] public List<string>? Values { get; set; }
    }
}
