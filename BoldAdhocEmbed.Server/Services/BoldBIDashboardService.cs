using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Runtime.Serialization;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using BoldAdhocEmbed.Server.Models;

namespace BoldAdhocEmbed.Server.Services
{
    public interface IBoldBIDashboardService
    {
        Task<string> GetTokenAsync(string email);
        Task<List<BoldDashboard>> GetDashboardsAsync(string token);
        Task<BoldDashboard> GetDashboardAsync(string token, string dashboardId);
        Task<BoldBIEmbedConfig> GetEmbedConfigAsync(string dashboardId, AppUser? user = null, IEnumerable<string>? adminRegions = null, string? userEmailOverride = null, string? serverApiUrlOverride = null);
        Task<string> GetAuthorizationTokenAsync(string embedQueryString, string userEmail, string? serverApiUrlOverride = null, AppUser? user = null, IEnumerable<string>? adminRegions = null);
        /// <summary>
        /// Server-mint a single Bold BI embed_token for a specific dashboard.
        /// Signs <c>embed_dashboard_id + embed_user_email + embed_custom_attribute
        /// + embed_server_timestamp</c> ourselves and calls the BI site's
        /// <c>/embed/authorize</c> endpoint directly so the browser SDK can
        /// consume the token via <c>BoldBI.create({ embedToken })</c> with no
        /// additional handshake round-trip.
        /// </summary>
        Task<string> GetServerEmbedTokenAsync(string dashboardId, AppUser? user, IEnumerable<string>? adminRegions, string? userEmailOverride = null, string? serverApiUrlOverride = null);
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

        /// <summary>
        /// Map a tenant name (or email fragment) to the CRM database name.
        /// Mirrors the switch used in BoldReportsService.GetEmbedTokenAsync so
        /// Reports and BI dashboards filter against the same per-tenant DB.
        /// </summary>
        private static string ResolveDatabaseName(AppUser? user)
        {
            var tenant = (user?.TenantName ?? string.Empty).Trim();
            var email = (user?.Email ?? string.Empty).Trim();
            var key = (tenant + " " + email).ToLowerInvariant();

            if (key.Contains("alpha")) return "crm_alphacorp";
            if (key.Contains("beta")) return "crm_betasolutions";
            if (key.Contains("gamma")) return "crm_gammaindustries";
            if (key.Contains("delta")) return "crm_deltaenterprises";

            return tenant switch
            {
                "AlphaCorp" => "crm_alphacorp",
                "BetaSolutions" => "crm_betasolutions",
                "GammaIndustries" => "crm_gammaindustries",
                "DeltaEnterprises" => "crm_deltaenterprises",
                _ => "crm_default"
            };
        }

        /// <summary>
        /// Build the <c>embed_custom_attribute</c> JSON payload for a Bold BI
        /// authorize call. Always includes <c>databaseName</c> and <c>Region</c>;
        /// when the caller is an Admin, <c>Region</c> is sent as a multi-value
        /// <c>IN(...)</c> clause over the supplied region list so Admin dashboards
        /// render rows for every region without per-user parameter wiring.
        /// </summary>
        private static string BuildCustomAttributesJson(AppUser? user, IEnumerable<string>? adminRegions)
        {
            var databaseName = ResolveDatabaseName(user);
            var isAdmin = string.Equals(user?.Role, "Admin", StringComparison.OrdinalIgnoreCase);

            string regionValue;
            if (isAdmin && adminRegions != null)
            {
                var distinctRegions = adminRegions
                    .Where(r => !string.IsNullOrWhiteSpace(r))
                    .Select(r => r.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                if (distinctRegions.Count == 1)
                {
                    regionValue = distinctRegions[0];
                }
                else if (distinctRegions.Count > 1)
                {
                    var quoted = string.Join(",", distinctRegions.Select(r => $"'{r.Replace("'", "''")}'"));
                    regionValue = $"IN({quoted})";
                }
                else
                {
                    regionValue = user?.Region ?? "default";
                }
            }
            else
            {
                regionValue = user?.Region ?? "default";
            }

            // Each entry is one parameter set; Bold BI expects the same JSON shape
            // as a query-string value: a single-element array of {name:value} maps.
            var attributes = new[]
            {
                new Dictionary<string, string>
                {
                    ["databaseName"] = databaseName,
                    ["Region"]       = regionValue
                }
            };

            return JsonConvert.SerializeObject(attributes);
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
                    $"{baseUrl}/api/site/{_settings.SiteIdentifier}/v1.0/token",
                    baseUrl.Contains("/bi") ? baseUrl.Replace("/bi", string.Empty) + $"/api/site/{_settings.SiteIdentifier}/token" : null
                }.Where(u => !string.IsNullOrEmpty(u)).Distinct().ToList();

                var usersToTry = new List<string>();
                if (!string.IsNullOrWhiteSpace(email)) usersToTry.Add(email);
                if (!string.IsNullOrWhiteSpace(_settings.UserEmail) && !usersToTry.Contains(_settings.UserEmail)) usersToTry.Add(_settings.UserEmail);
                if (!string.IsNullOrWhiteSpace(_settings.AdminUser) && !usersToTry.Contains(_settings.AdminUser)) usersToTry.Add(_settings.AdminUser);

                // 1. Try embed_secret grant for each user candidate
                foreach (var userEmail in usersToTry)
                {
                    if (string.IsNullOrWhiteSpace(_settings.EmbedSecret)) break;

                    foreach (var tokenUrl in candidates)
                    {
                        try
                        {
                            // Bold BI expects FormUrlEncodedContent (grant_type=embed_secret&username=...&embed_secret=...)
                            var formContent = new FormUrlEncodedContent(new[]
                            {
                                new KeyValuePair<string, string>("grant_type", "embed_secret"),
                                new KeyValuePair<string, string>("username", userEmail),
                                new KeyValuePair<string, string>("embed_secret", _settings.EmbedSecret)
                            });

                            _logger.LogInformation("Attempting Bold BI token request (embed_secret form, user={User}) to {Url}", userEmail, tokenUrl);
                            var formResponse = await _httpClient.PostAsync(tokenUrl, formContent);
                            if (formResponse.IsSuccessStatusCode)
                            {
                                var responseContent = await formResponse.Content.ReadAsStringAsync();
                                var tokenResponse = JsonConvert.DeserializeObject<BoldBITokenResponse>(responseContent);
                                if (!string.IsNullOrEmpty(tokenResponse?.access_token))
                                {
                                    _logger.LogInformation("Bold BI token generated via embed_secret for user {Email}", userEmail);
                                    return tokenResponse.access_token;
                                }
                            }

                            // Fallback to JSON payload if form-urlencoded isn't accepted
                            var payloadObj = new
                            {
                                username = userEmail,
                                embed_secret = _settings.EmbedSecret,
                                grant_type = "embed_secret"
                            };
                            var jsonContent = new StringContent(JsonConvert.SerializeObject(payloadObj), Encoding.UTF8, "application/json");

                            var response = await _httpClient.PostAsync(tokenUrl, jsonContent);
                            if (response.IsSuccessStatusCode)
                            {
                                var responseContent = await response.Content.ReadAsStringAsync();
                                var tokenResponse = JsonConvert.DeserializeObject<BoldBITokenResponse>(responseContent);
                                if (!string.IsNullOrEmpty(tokenResponse?.access_token))
                                {
                                    _logger.LogInformation("Bold BI token generated via embed_secret JSON for user {Email}", userEmail);
                                    return tokenResponse.access_token;
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Token generation attempt to {Url} threw exception", tokenUrl);
                        }
                    }
                }

                // 2. Try password grant fallback for AdminUser if configured
                if (!string.IsNullOrWhiteSpace(_settings.AdminUser) && !string.IsNullOrWhiteSpace(_settings.AdminPassword))
                {
                    var passFormContent = new FormUrlEncodedContent(new[]
                    {
                        new KeyValuePair<string, string>("grant_type", "password"),
                        new KeyValuePair<string, string>("username", _settings.AdminUser),
                        new KeyValuePair<string, string>("password", _settings.AdminPassword)
                    });

                    foreach (var tokenUrl in candidates)
                    {
                        try
                        {
                            _logger.LogInformation("Attempting Bold BI token request (password grant, user={User}) to {Url}", _settings.AdminUser, tokenUrl);
                            var response = await _httpClient.PostAsync(tokenUrl, passFormContent);
                            if (response.IsSuccessStatusCode)
                            {
                                var responseContent = await response.Content.ReadAsStringAsync();
                                var tokenResponse = JsonConvert.DeserializeObject<BoldBITokenResponse>(responseContent);
                                if (!string.IsNullOrEmpty(tokenResponse?.access_token))
                                {
                                    _logger.LogInformation("Bold BI token generated via password grant for user {Email}", _settings.AdminUser);
                                    return tokenResponse.access_token;
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Password token attempt to {Url} threw exception", tokenUrl);
                        }
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

                        _logger.LogWarning("Dashboard retrieval from {Url} failed with status {StatusCode}; body redacted", dashboardsUrl, response.StatusCode);
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
        /// Get embed configuration for dashboard. Returns the static config the
        /// browser SDK needs to <c>BoldBI.create(...)</c>; the actual
        /// <c>embedToken</c> is fetched by the SDK via the
        /// <c>authorizationServer</c> handshake so per-tenant custom attributes
        /// (databaseName + Region) can be appended safely on the server side.
        ///
        /// For environments where BI rejects the handshake (e.g. site
        /// misconfiguration, signature mismatch, user not provisioned on the
        /// BI site), this method also attempts <see cref="GetServerEmbedTokenAsync"/>
        /// as a fallback and returns the minted token via <c>EmbedToken</c> so
        /// the SDK can embed via <c>BoldBI.create({ embedToken })</c> directly.
        /// </summary>
        public async Task<BoldBIEmbedConfig> GetEmbedConfigAsync(
            string dashboardId,
            AppUser? user = null,
            IEnumerable<string>? adminRegions = null,
            string? userEmailOverride = null,
            string? serverApiUrlOverride = null)
        {
            try
            {
                var resolvedEmail = !string.IsNullOrWhiteSpace(userEmailOverride)
                    ? userEmailOverride!
                    : (!string.IsNullOrWhiteSpace(user?.Email) ? user!.Email : _settings.UserEmail);

                // Best-effort: try to mint an embed_token server-side. If the
                // BI site accepts it the SDK uses it directly; otherwise it
                // falls back to the authorizationServer handshake.
                string? embedToken = null;
                try
                {
                    embedToken = await GetServerEmbedTokenAsync(
                        dashboardId, user, adminRegions, resolvedEmail, serverApiUrlOverride);
                }
                catch (Exception mintEx)
                {
                    _logger.LogWarning(mintEx,
                        "Server-mint of embed_token threw; will fall back to authorizationServer handshake");
                }

                var config = new BoldBIEmbedConfig
                {
                    DashboardId = dashboardId,
                    ServerUrl = !string.IsNullOrWhiteSpace(serverApiUrlOverride)
                        ? serverApiUrlOverride!.TrimEnd('/')
                        : _settings.ServerUrl,
                    SiteIdentifier = _settings.SiteIdentifier,
                    Environment = _settings.Environment,
                    UserEmail = resolvedEmail,
                    EmbedType = "component",
                    ExpirationTime = 100000,
                    EmbedToken = embedToken ?? string.Empty
                };

                _logger.LogInformation(
                    "Generated embed config (embedToken {HasToken}) for dashboard {DashboardId} as {Email} ({Role}, {Region})",
                    !string.IsNullOrEmpty(embedToken), dashboardId, resolvedEmail,
                    user?.Role ?? "default", user?.Region ?? "default");
                return await Task.FromResult(config);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Get embed config failed for dashboard {DashboardId}", dashboardId);
                return null;
            }
        }

        /// <summary>
        /// Server-mint a Bold BI embed_token by calling the self-hosted
        /// <c>/api/site/{site}/token</c> endpoint with the canonical JSON body
        /// (username, embed_secret, grant_type=embed_secret). Returns the
        /// response's <c>access_token</c>, which the browser SDK consumes
        /// directly via <c>BoldBI.create({ embedToken })</c> with no further
        /// <c>/embed/authorize</c> handshake. Per-tenant custom attributes
        /// (databaseName + Region) are baked into the JWT by the site so no
        /// extra query string work is needed here.
        /// </summary>
        public async Task<string> GetServerEmbedTokenAsync(
            string dashboardId,
            AppUser? user,
            IEnumerable<string>? adminRegions,
            string? userEmailOverride = null,
            string? serverApiUrlOverride = null)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dashboardId))
                {
                    _logger.LogError("Server embed token mint failed: dashboardId is empty");
                    return null;
                }

                var email = !string.IsNullOrWhiteSpace(userEmailOverride)
                    ? userEmailOverride!
                    : (!string.IsNullOrWhiteSpace(user?.Email) ? user!.Email : _settings.UserEmail);

                if (string.IsNullOrWhiteSpace(_settings.EmbedSecret))
                {
                    _logger.LogError("Server embed token mint failed: BoldBI:EmbedSecret is empty in config");
                    return null;
                }

                // Token endpoint: https://{domain}/bi/api/site/{siteIdentifier}/token
                // For Bold BI Cloud the same path works (it's the embed_secret
                // grant endpoint that returns the access_token we'll forward
                // to BoldBI.create({ embedToken })).
                var tokenUrl = !string.IsNullOrWhiteSpace(serverApiUrlOverride)
                    ? (serverApiUrlOverride!.TrimEnd('/').Contains("/token", StringComparison.OrdinalIgnoreCase)
                        ? serverApiUrlOverride!.TrimEnd('/')
                        : $"{serverApiUrlOverride!.TrimEnd('/')}/api/site/{_settings.SiteIdentifier}/token")
                    : $"{(_settings.ServerUrl ?? string.Empty).TrimEnd('/')}/api/site/{_settings.SiteIdentifier}/token";

                var payload = new
                {
                    username = email,
                    embed_secret = _settings.EmbedSecret,
                    grant_type = "embed_secret"
                };
                var json = JsonConvert.SerializeObject(payload);
                using var content = new StringContent(json, Encoding.UTF8, "application/json");

                _logger.LogInformation(
                    "Minting server-side embed_token for dashboard {DashboardId} as {Email}; POST {TokenUrl} (db={Db}, role={Role})",
                    dashboardId, email, tokenUrl, ResolveDatabaseName(user), user?.Role ?? "default");

                var response = await _httpClient.PostAsync(tokenUrl, content);
                var body = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning(
                        "Server embed_token mint failed for {DashboardId}: status {Status} body {Body}",
                        dashboardId, (int)response.StatusCode,
                        string.IsNullOrEmpty(body) ? "(empty)" : body);
                    return null;
                }

                // Response shape per Bold BI docs:
                //   { "access_token": "...", "token_type": "...", "expires_in": "...", "Email": "..." }
                BoldBITokenResponse? parsed = null;
                try { parsed = JsonConvert.DeserializeObject<BoldBITokenResponse>(body); }
                catch (Exception parseEx)
                {
                    _logger.LogWarning(parseEx, "Server embed_token response was not JSON: {Body}", body);
                }

                var accessToken = parsed?.access_token;
                if (string.IsNullOrEmpty(accessToken))
                {
                    _logger.LogWarning(
                        "Server embed_token response missing access_token for {DashboardId}: {Body}",
                        dashboardId, body);
                    return null;
                }

                _logger.LogInformation(
                    "Server-minted embed_token ({Length} chars) returned for {DashboardId} as {Email}",
                    accessToken.Length, dashboardId, email);
                return accessToken;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception in GetServerEmbedTokenAsync for {DashboardId}", dashboardId);
                return null;
            }
        }

        /// <summary>
        /// Get authorization token for dashboard embedding.
        /// When <paramref name="user"/> is supplied, an <c>embed_custom_attribute</c>
        /// payload is appended (and signed) so Bold BI dashboards can filter
        /// per-tenant by <c>databaseName</c> and <c>Region</c>. Admins receive
        /// a multi-value Region so they see all regions in a single embed.
        /// </summary>
        public async Task<string> GetAuthorizationTokenAsync(
            string embedQueryString,
            string userEmail,
            string? serverApiUrlOverride = null,
            AppUser? user = null,
            IEnumerable<string>? adminRegions = null)
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

                // Build the query string with user email, custom attributes, and timestamp
                var embedQuery = embedQueryString;
                embedQuery += "&embed_user_email=" + Uri.EscapeDataString(userEmail);

                // Inject embed_custom_attribute so dashboards filter by tenant + region
                if (user != null)
                {
                    var customAttrJson = BuildCustomAttributesJson(user, adminRegions);
                    embedQuery += "&embed_custom_attribute=" + Uri.EscapeDataString(customAttrJson);
                    _logger.LogInformation(
                        "Injected embed_custom_attribute for {Email} (role={Role}, tenant={Tenant}, db={Db}, region={Region})",
                        user.Email, user.Role, user.TenantName, ResolveDatabaseName(user), customAttrJson);
                }

                double timeStamp = (long)DateTime.UtcNow.Subtract(new DateTime(1970, 1, 1)).TotalSeconds;
                embedQuery += "&embed_server_timestamp=" + timeStamp;

                // Generate signature over the FULL query (including custom attributes)
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
        /// <summary>
        /// Server-minted Bold BI embed_token. When non-empty the browser SDK
        /// uses it directly via <c>BoldBI.create({ embedToken })</c>; when empty
        /// the SDK falls back to the <c>authorizationServer</c> handshake.
        /// </summary>
        public string EmbedToken { get; set; }
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
