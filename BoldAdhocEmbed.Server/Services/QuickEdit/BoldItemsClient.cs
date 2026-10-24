using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using BoldAdhocEmbed.Server.Models;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

namespace BoldAdhocEmbed.Server.Services.QuickEdit
{
    /// <summary>
    /// Thin wrapper around the Bold Reports v5.0 /items endpoints we
    /// need for Quick Edit:
    ///   POST  /items/download   (FormData ItemId)   → raw RDL bytes
    ///   POST  /items            (json body)         → create new report
    ///   GET   /items?itemType=Report&amp;serverPath=…
    ///                                          → resolve serverPath to ItemId
    ///
    /// Token is passed in (admin or per-user) so we don't bind this
    /// service to a single auth mode.
    /// </summary>
    public interface IBoldItemsClient
    {
        Task<byte[]> DownloadItemAsync(string token, string itemId);
        Task<CreateReportResult> CreateReportAsync(string token, string serverPath, string categoryId, string description, string reportName, byte[] rdlBytes);
        Task<string?> ResolveItemIdAsync(string token, string serverPath);
        Task<string?> ResolveCategoryIdAsync(string token, string categoryName);

        /// <summary>
        /// Lists every report item inside the category whose name matches
        /// <paramref name="categoryName"/>. Uses v5.0 GET /items?itemType=Report&amp;
        /// serverPath=/{categoryName}; returns the deserialised item list with
        /// 2xx metadata (status, body) so callers can surface upstream errors
        /// instead of silently masking them.
        /// </summary>
        Task<(List<BoldReportItem> Items, int? StatusCode, string? ErrorBody)> ListReportsInCategoryAsync(
            string token, string categoryName);
    }

    /// <summary>
    /// Subset of the v5.0 /items schema we need to render the "My Reports"
    /// listing. Only the fields the UI consumes are mapped.
    /// </summary>
    public class BoldReportItem
    {
        [JsonProperty("Id")] public string? Id { get; set; }
        [JsonProperty("Name")] public string? Name { get; set; }
        [JsonProperty("Description")] public string? Description { get; set; }
        [JsonProperty("CategoryName")] public string? CategoryName { get; set; }
        [JsonProperty("ModifiedDate")] public string? ModifiedDate { get; set; }
        [JsonProperty("ModifiedDateString")] public string? ModifiedDateString { get; set; }
        [JsonProperty("CreatedDate")] public string? CreatedDate { get; set; }
        [JsonProperty("CreatedById")] public int? CreatedById { get; set; }
        [JsonProperty("CreatedByDisplayName")] public string? CreatedByDisplayName { get; set; }
        [JsonProperty("IsPublic")] public bool IsPublic { get; set; }
        [JsonProperty("CanRead")] public bool CanRead { get; set; }
        [JsonProperty("CanWrite")] public bool CanWrite { get; set; }
        [JsonProperty("CanDelete")] public bool CanDelete { get; set; }
        [JsonProperty("ReportId")] public string? ReportId { get; set; }
    }

    public class CreateReportResult
    {
        public bool Success { get; set; }
        public string? ItemId { get; set; }
        public string? Error { get; set; }
        public int StatusCode { get; set; }
    }

    public class BoldItemsClient : IBoldItemsClient
    {
        private readonly HttpClient _http;
        private readonly BoldReportsSettings _settings;
        private readonly ILogger<BoldItemsClient> _logger;

        public BoldItemsClient(HttpClient http, BoldReportsSettings settings, ILogger<BoldItemsClient> logger)
        {
            _http = http ?? throw new ArgumentNullException(nameof(http));
            _settings = settings ?? throw new ArgumentNullException(nameof(settings));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        // v1.0 URL pattern. Same shape as BoldReportsService.GetApiUrl —
        // {ReportRootUrl}/api/site/{ReportsSiteIdentifier}/v1.0{endpoint}.
        // The /reporting segment comes from ReportRootUrl itself
        // (e.g. "https://adhoc.boldreports.com/reporting").
        private string V1(string endpoint) =>
            $"{_settings.ReportRootUrl}/api/site/{_settings.ReportsSiteIdentifier}/v1.0{endpoint}";

        private string V5(string endpoint) =>
            $"{_settings.ReportRootUrl}/api/site/{_settings.ReportsSiteIdentifier}/v5.0{endpoint}";

        private static string NormalizeAuth(string token) =>
            string.IsNullOrWhiteSpace(token) ? token
            : (token.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? token : $"Bearer {token}");

        // Transient network errors (connection reset, TLS handshake
        // glitch, broken pipe) bubble up as HttpRequestException +
        // IOException. Worth retrying — Bold Reports' CDN will sometimes
        // reset a request right after it accepts the headers.
        private const int MaxRetries = 3;
        private static readonly TimeSpan InitialBackoff = TimeSpan.FromMilliseconds(400);

        private async Task<T> WithRetry<T>(Func<int, Task<T>> attempt, string operation)
        {
            var delay = InitialBackoff;
            for (var i = 1; ; i++)
            {
                try
                {
                    return await attempt(i);
                }
                catch (Exception ex) when (i < MaxRetries && IsTransient(ex))
                {
                    _logger.LogWarning(
                        "{Op} attempt {Attempt}/{Max} failed with transient error: {Error}. Retrying in {DelayMs}ms.",
                        operation, i, MaxRetries, ex.Message, delay.TotalMilliseconds);
                    await Task.Delay(delay);
                    delay = TimeSpan.FromMilliseconds(Math.Min(delay.TotalMilliseconds * 2, 3000));
                }
            }
        }

        private static bool IsTransient(Exception ex)
        {
            // HttpRequestException wraps most transport-level errors.
            // IOException covers connection-reset / broken-pipe from
            // the underlying socket. OperationCanceledException is
            // NOT retried — it means the caller cancelled.
            if (ex is OperationCanceledException) return false;
            for (var e = ex; e != null; e = e.InnerException!)
            {
                if (e is HttpRequestException) return true;
                if (e is IOException io && !(ex is FormatException)) return true;
            }
            return false;
        }

        public async Task<byte[]> DownloadItemAsync(string token, string itemId)
        {
            if (string.IsNullOrWhiteSpace(itemId))
                throw new ArgumentException("itemId is required", nameof(itemId));

            return await WithRetry(async (attempt) =>
            {
                // Bold Reports v5.0 POST /items/download (per the official REST
                // API reference). Earlier attempts returned 401 because the
                // body was being sent as multipart/form-data; the server
                // actually expects application/x-www-form-urlencoded with a
                // single ItemId field.
                //
                // Contract (verified against the live v5.0 API):
                //   POST  body: ItemId=<guid>   (application/x-www-form-urlencoded)
                //   200   body: { "FileContent": "<base64 RDL>", "ItemName",
                //                  "Extension", "Status", "StatusMessage" }
                // i.e. the RDL comes back base64-encoded inside JSON, NOT as
                // raw response bytes.
                var url = V5("/items/download");
                using var form = new FormUrlEncodedContent(new[]
                {
                    new KeyValuePair<string, string>("ItemId", itemId),
                });
                using var req = new HttpRequestMessage(HttpMethod.Post, url) { Content = form };
                req.Headers.Authorization = AuthenticationHeaderValue.Parse(NormalizeAuth(token));

                using var resp = await _http.SendAsync(req);
                var body = await resp.Content.ReadAsStringAsync();
                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning(
                        "items/download attempt={Attempt} failed status={Status} url={Url} body={Body}",
                        attempt, (int)resp.StatusCode, url, body);
                    throw new HttpRequestException(
                        $"items/download failed ({(int)resp.StatusCode}) at {url}: {body}");
                }

                DownloadResponse? payload;
                try
                {
                    payload = JsonConvert.DeserializeObject<DownloadResponse>(body);
                }
                catch (Exception ex)
                {
                    throw new HttpRequestException(
                        $"items/download returned a non-JSON 200 body: {ex.Message}", ex);
                }

                if (payload == null || string.IsNullOrEmpty(payload.FileContent))
                {
                    var status = payload?.StatusMessage ?? "empty FileContent";
                    throw new HttpRequestException(
                        $"items/download 200 but no file content (status: {status}).");
                }

                try
                {
                    return Convert.FromBase64String(payload.FileContent);
                }
                catch (FormatException ex)
                {
                    throw new HttpRequestException(
                        $"items/download FileContent was not valid base64: {ex.Message}", ex);
                }
            }, "items/download");
        }

        public async Task<string?> ResolveItemIdAsync(string token, string serverPath)
        {
            if (string.IsNullOrWhiteSpace(serverPath)) return null;
            return await WithRetry<string?>(async (attempt) =>
            {
                // v5.0 GET /items?itemType=Report matches the same API
                // version the download and create calls use.
                var url = V5($"/items?itemType=Report&serverPath={Uri.EscapeDataString(serverPath)}");
                using var req = new HttpRequestMessage(HttpMethod.Get, url);
                req.Headers.Authorization = AuthenticationHeaderValue.Parse(NormalizeAuth(token));

                using var resp = await _http.SendAsync(req);
                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning(
                        "items/list attempt={Attempt} failed status={Status} url={Url}",
                        attempt, (int)resp.StatusCode, url);
                    // 4xx is terminal — no point retrying auth/perm errors.
                    // Only let 5xx and transport errors fall through to the
                    // retry helper.
                    if ((int)resp.StatusCode >= 400 && (int)resp.StatusCode < 500)
                        return null;
                    throw new HttpRequestException(
                        $"items/list failed ({(int)resp.StatusCode}) at {url}");
                }
                var body = await resp.Content.ReadAsStringAsync();
                try
                {
                    var arr = JsonConvert.DeserializeObject<List<ItemRef>>(body);
                    return arr?.FirstOrDefault()?.ItemId ?? arr?.FirstOrDefault()?.Id;
                }
                catch
                {
                    return null;
                }
            }, "items/list");
        }

        public async Task<(List<BoldReportItem> Items, int? StatusCode, string? ErrorBody)> ListReportsInCategoryAsync(
            string token, string categoryName)
        {
            if (string.IsNullOrWhiteSpace(categoryName))
                return (new List<BoldReportItem>(), null, "categoryName is required");

            // serverPath must start with "/" so Bold Reports treats it as a
            // category path rather than a name fragment; trimming handles
            // accidental leading/trailing whitespace from callers.
            var serverPath = "/" + categoryName.Trim().Trim('/');

            var url = V5($"/items?itemType=Report&serverPath={Uri.EscapeDataString(serverPath)}");
            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.Authorization = AuthenticationHeaderValue.Parse(NormalizeAuth(token));

            using var resp = await _http.SendAsync(req);
            var body = await resp.Content.ReadAsStringAsync();
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "ListReportsInCategory failed status={Status} path={Path} body={Body}",
                    (int)resp.StatusCode, serverPath, body);
                return (new List<BoldReportItem>(), (int)resp.StatusCode, body);
            }

            try
            {
                var items = JsonConvert.DeserializeObject<List<BoldReportItem>>(body) ?? new List<BoldReportItem>();
                return (items, (int)resp.StatusCode, null);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ListReportsInCategory parse failed path={Path} body={Body}", serverPath, body);
                return (new List<BoldReportItem>(), (int)resp.StatusCode, body);
            }
        }

        public async Task<string?> ResolveCategoryIdAsync(string token, string categoryName)
        {
            if (string.IsNullOrWhiteSpace(categoryName)) return null;

            // Already a GUID? Use as-is.
            if (Guid.TryParse(categoryName, out _)) return categoryName;

            // 1. Look up an existing category with this name. In Bold
            //    Reports the per-user "My Reports" folder is just a
            //    Category whose Name is the user's email; first-time
            //    saves won't find it yet.
            var existing = await TryFindCategoryAsync(token, categoryName);
            if (!string.IsNullOrEmpty(existing)) return existing;

            // 2. Create it. POST /v1.0/categories with IsPublic=false
            //    yields a private per-user folder. The 200 response is
            //    { "Status": true, "Data": "<new guid>" }.
            var created = await TryCreateCategoryAsync(token, categoryName);
            if (!string.IsNullOrEmpty(created)) return created;

            // 3. Re-resolve in case another request created it between
            //    step 1 and step 2.
            return await TryFindCategoryAsync(token, categoryName);
        }

        private async Task<string?> TryFindCategoryAsync(string token, string categoryName)
        {
            return await WithRetry<string?>(async (attempt) =>
            {
                var url = V1("/items?itemType=Category");
                using var req = new HttpRequestMessage(HttpMethod.Get, url);
                req.Headers.Authorization = AuthenticationHeaderValue.Parse(NormalizeAuth(token));

                using var resp = await _http.SendAsync(req);
                if (!resp.IsSuccessStatusCode)
                {
                    if ((int)resp.StatusCode >= 400 && (int)resp.StatusCode < 500) return null;
                    throw new HttpRequestException(
                        $"items/list(category) failed ({(int)resp.StatusCode}) at {url}");
                }
                var body = await resp.Content.ReadAsStringAsync();
                try
                {
                    var arr = JsonConvert.DeserializeObject<List<ItemRef>>(body);
                    if (arr == null) return null;

                    var wanted = categoryName.Trim().Trim('/');
                    var match = arr.FirstOrDefault(c =>
                        string.Equals(NormalizeCategory(c.Name), NormalizeCategory(wanted),
                            StringComparison.OrdinalIgnoreCase));
                    return match?.ItemId ?? match?.Id;
                }
                catch
                {
                    return null;
                }
            }, "items/list(category)");
        }

        private async Task<string?> TryCreateCategoryAsync(string token, string categoryName)
        {
            return await WithRetry<string?>(async (attempt) =>
            {
                var url = V1("/categories");
                var payload = new Dictionary<string, object?>
                {
                    ["Name"] = categoryName.Trim(),
                    ["IsPublic"] = false,
                };
                using var req = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = new StringContent(
                        JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json"),
                };
                req.Headers.Authorization = AuthenticationHeaderValue.Parse(NormalizeAuth(token));

                using var resp = await _http.SendAsync(req);
                var body = await resp.Content.ReadAsStringAsync();
                if (!resp.IsSuccessStatusCode)
                {
                    _logger.LogWarning(
                        "categories POST attempt={Attempt} status={Status} url={Url} body={Body}",
                        attempt, (int)resp.StatusCode, url, body);
                    if ((int)resp.StatusCode >= 400 && (int)resp.StatusCode < 500) return null;
                    throw new HttpRequestException(
                        $"categories POST failed ({(int)resp.StatusCode}) at {url}");
                }
                try
                {
                    var doc = JsonConvert.DeserializeObject<Dictionary<string, object?>>(body);
                    // Live response shape: { "Status": true, "Data": "<guid>", ... }
                    return doc?["Data"] as string
                        ?? doc?["ItemId"] as string
                        ?? doc?["Id"] as string;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("categories POST 2xx with unparsable body ({Msg}): {Body}", ex.Message, body);
                    return null;
                }
            }, "categories POST");
        }

        private static string NormalizeCategory(string? name) =>
            (name ?? string.Empty).Replace(" ", string.Empty);

        public async Task<CreateReportResult> CreateReportAsync(string token, string serverPath, string categoryId, string description, string reportName, byte[] rdlBytes)
        {
            // Verified against the live Bold Reports API:
            //   POST /reporting/api/site/{site}/v1.0/reports
            //   Content-Type: application/json
            //   {
            //     "Name":         "<report name>",
            //     "Description":  "<optional>",
            //     "CategoryId":   "<category guid>"      ← decides the folder
            //     "IsPublic":     false,
            //     "ItemContent":  "<base64-encoded RDL>"
            //   }
            //   200 → { "Status": true, "PublishedItemId": "<guid>" }
            //
            // Two things that bite if you get it wrong:
            //   - ServerPath must be OMITTED. Sending it (with or without a
            //     leading slash) fails with 400 "Server path is invalid."
            //     CategoryId alone determines where the report lands.
            //   - ItemContent is base64, not raw XML. Raw XML fails with
            //     400 "Current request is empty."
            var url = V1("/reports");
            var payload = new Dictionary<string, object?>
            {
                ["Name"] = reportName ?? string.Empty,
                ["CategoryId"] = categoryId ?? string.Empty,
                ["IsPublic"] = false,
                ["ItemContent"] = Convert.ToBase64String(rdlBytes ?? Array.Empty<byte>()),
            };
            if (!string.IsNullOrWhiteSpace(description))
                payload["Description"] = description;

            var json = JsonConvert.SerializeObject(payload);
            using var req = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            };
            req.Headers.Authorization = AuthenticationHeaderValue.Parse(NormalizeAuth(token));

            using var resp = await _http.SendAsync(req);
            var body = await resp.Content.ReadAsStringAsync();
            var result = new CreateReportResult
            {
                StatusCode = (int)resp.StatusCode,
                Success = resp.IsSuccessStatusCode,
            };
            if (!resp.IsSuccessStatusCode)
            {
                result.Error = body;
                _logger.LogWarning("v1.0/reports POST failed status={Status} body={Body}", result.StatusCode, body);
                return result;
            }

            try
            {
                var created = JsonConvert.DeserializeObject<CreateReportResponse>(body);
                result.ItemId = created?.PublishedItemId ?? created?.ItemId;
            }
            catch (Exception ex)
            {
                _logger.LogInformation("v1.0/reports 2xx with unparsable body ({Msg}): {Body}", ex.Message, body);
            }
            return result;
        }

        private class CreateReportResponse
        {
            [JsonProperty("ApiStatus")] public bool ApiStatus { get; set; }
            [JsonProperty("Status")] public bool Status { get; set; }
            [JsonProperty("StatusMessage")] public string? StatusMessage { get; set; }
            [JsonProperty("PublishedItemId")] public string? PublishedItemId { get; set; }
            [JsonProperty("ItemId")] public string? ItemId { get; set; }
        }

        private class ItemRef
        {
            [JsonProperty("ItemId")] public string? ItemId { get; set; }
            [JsonProperty("Id")] public string? Id { get; set; }
            [JsonProperty("Name")] public string? Name { get; set; }
        }

        // Shape of the v1.0 /items/download 200 response. FileContent is
        // the base64-encoded report file (RDL).
        private class DownloadResponse
        {
            [JsonProperty("FileContent")] public string? FileContent { get; set; }
            [JsonProperty("ItemName")] public string? ItemName { get; set; }
            [JsonProperty("Extension")] public string? Extension { get; set; }
            [JsonProperty("Status")] public bool Status { get; set; }
            [JsonProperty("StatusMessage")] public string? StatusMessage { get; set; }
        }
    }
}
