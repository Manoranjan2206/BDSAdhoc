using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using System.Xml.Linq;
using BoldAdhocEmbed.Server.Models;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

namespace BoldAdhocEmbed.Server.Services.ReportBuilder
{
    public class DatasetSummary
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
    }

    public class DatasetColumn
    {
        public string Name { get; set; } = string.Empty;
        public string TypeName { get; set; } = "System.String";
    }

    public class DatasetDetail
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        /// <summary>The data source GUID the dataset binds to.</summary>
        public string DataSourceId { get; set; } = string.Empty;
        public List<DatasetColumn> Columns { get; set; } = new();
    }

    public interface IDatasetCatalogService
    {
        Task<List<DatasetSummary>> ListDatasetsAsync(string token);
        Task<DatasetDetail?> GetDatasetDetailAsync(string token, string datasetId);
    }

    /// <summary>
    /// Reads the shared-dataset catalog from Bold Reports so the New Report
    /// wizard can present a dataset dropdown and the columns available in
    /// the selected dataset. Only datasets in <see cref="AllowedDatasets"/>
    /// are surfaced — this mirrors the ALLOWED_SHARED_DATASETS allow-list
    /// enforced client-side in the full designer.
    /// </summary>
    public class DatasetCatalogService : IDatasetCatalogService
    {
        private readonly HttpClient _http;
        private readonly BoldReportsSettings _settings;
        private readonly ILogger<DatasetCatalogService> _logger;

        // Keep this in sync with ALLOWED_SHARED_DATASETS in Designer.jsx.
        public static readonly HashSet<string> AllowedDatasets = new(StringComparer.OrdinalIgnoreCase)
        {
            "InvoiceAging",
            "TicketResolutionAnalysis",
            "InvoiceCollectionPerformance",
            "TaskMonitoring",
            "CustomerAcquisitionDataset",
        };

        public DatasetCatalogService(HttpClient http, BoldReportsSettings settings, ILogger<DatasetCatalogService> logger)
        {
            _http = http ?? throw new ArgumentNullException(nameof(http));
            _settings = settings ?? throw new ArgumentNullException(nameof(settings));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        private string V1(string endpoint) =>
            $"{_settings.ReportRootUrl}/api/site/{_settings.ReportsSiteIdentifier}/v1.0{endpoint}";

        private string V5(string endpoint) =>
            $"{_settings.ReportRootUrl}/api/site/{_settings.ReportsSiteIdentifier}/v5.0{endpoint}";

        private static string NormalizeAuth(string token) =>
            string.IsNullOrWhiteSpace(token) ? token
            : (token.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? token : $"Bearer {token}");

        public async Task<List<DatasetSummary>> ListDatasetsAsync(string token)
        {
            // v5.0/items?itemType=DataSet — same endpoint used by the full designer.
            // serverPath / tags are optional filters in the spec; we deliberately
            // don't pass them and instead allow-list by dataset Name below, to
            // mirror the ALLOWED_SHARED_DATASETS enforcement in Designer.jsx.
            var url = V5("/items?itemType=DataSet");
            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.Authorization = AuthenticationHeaderValue.Parse(NormalizeAuth(token));

            using var resp = await _http.SendAsync(req);
            var body = await resp.Content.ReadAsStringAsync();
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("List datasets failed status={Status} url={Url} body={Body}",
                    (int)resp.StatusCode, url, body);
                return new List<DatasetSummary>();
            }

            var items = JsonConvert.DeserializeObject<List<DatasetItem>>(body) ?? new List<DatasetItem>();
            return items
                .Where(i => !string.IsNullOrWhiteSpace(i.Name) && AllowedDatasets.Contains(i.Name!.Trim()))
                .Select(i => new DatasetSummary
                {
                    Id = i.ItemId ?? i.Id ?? string.Empty,
                    Name = i.Name!.Trim(),
                })
                .Where(d => !string.IsNullOrEmpty(d.Id))
                .OrderBy(d => d.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        public async Task<DatasetDetail?> GetDatasetDetailAsync(string token, string datasetId)
        {
            if (string.IsNullOrWhiteSpace(datasetId)) return null;

            var url = V5("/items/download");
            using var form = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("ItemId", datasetId),
            });
            using var req = new HttpRequestMessage(HttpMethod.Post, url) { Content = form };
            req.Headers.Authorization = AuthenticationHeaderValue.Parse(NormalizeAuth(token));

            using var resp = await _http.SendAsync(req);
            var body = await resp.Content.ReadAsStringAsync();
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("Download dataset failed status={Status} id={Id} body={Body}",
                    (int)resp.StatusCode, datasetId, body);
                return null;
            }

            var payload = JsonConvert.DeserializeObject<DownloadResponse>(body);
            if (payload == null || string.IsNullOrEmpty(payload.FileContent))
            {
                _logger.LogWarning("Download dataset {Id} returned no content", datasetId);
                return null;
            }

            string rsd;
            try
            {
                var bytes = Convert.FromBase64String(payload.FileContent);
                // Strip UTF-8 BOM before XML parse.
                rsd = System.Text.Encoding.UTF8.GetString(bytes).TrimStart('\uFEFF');
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Dataset {Id} content was not valid base64", datasetId);
                return null;
            }

            return ParseSharedDataSet(datasetId, payload.ItemName ?? string.Empty, rsd);
        }

        // The shared-dataset definition (.rsd) looks like:
        //   <SharedDataSet xmlns="…/shareddatasetdefinition">
        //     <DataSet Name="InvoiceAging">
        //       <Query>
        //         <DataSourceReference>crmdata/&lt;guid&gt;</DataSourceReference>
        //       </Query>
        //       <Fields>
        //         <Field Name="invoice_number">
        //           <DataField>invoice_number</DataField>
        //           <rd:TypeName>System.String</rd:TypeName>
        //         </Field> …
        private DatasetDetail? ParseSharedDataSet(string datasetId, string name, string rsd)
        {
            try
            {
                var doc = XDocument.Parse(rsd);
                var dataSet = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "DataSet");
                if (dataSet == null) return null;

                var dsName = dataSet.Attribute("Name")?.Value ?? name;

                var dataSourceRef = dataSet.Descendants()
                    .FirstOrDefault(e => e.Name.LocalName == "DataSourceReference")?.Value ?? string.Empty;
                // Reference is "<categoryPath>/<guid>" or just "<guid>".
                var dataSourceId = dataSourceRef.Contains('/')
                    ? dataSourceRef.Substring(dataSourceRef.LastIndexOf('/') + 1)
                    : dataSourceRef;

                var fieldsContainer = dataSet.Elements().FirstOrDefault(e => e.Name.LocalName == "Fields");
                var columns = new List<DatasetColumn>();
                if (fieldsContainer != null)
                {
                    foreach (var field in fieldsContainer.Elements().Where(e => e.Name.LocalName == "Field"))
                    {
                        var fname = field.Attribute("Name")?.Value
                                    ?? field.Elements().FirstOrDefault(e => e.Name.LocalName == "DataField")?.Value;
                        if (string.IsNullOrWhiteSpace(fname)) continue;
                        var ftype = field.Elements().FirstOrDefault(e => e.Name.LocalName == "TypeName")?.Value
                                    ?? "System.String";
                        columns.Add(new DatasetColumn { Name = fname.Trim(), TypeName = ftype.Trim() });
                    }
                }

                return new DatasetDetail
                {
                    Id = datasetId,
                    Name = dsName,
                    DataSourceId = dataSourceId,
                    Columns = columns,
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to parse shared dataset {Id}", datasetId);
                return null;
            }
        }

        private class DatasetItem
        {
            [JsonProperty("ItemId")] public string? ItemId { get; set; }
            [JsonProperty("Id")] public string? Id { get; set; }
            [JsonProperty("Name")] public string? Name { get; set; }
        }

        private class DownloadResponse
        {
            [JsonProperty("FileContent")] public string? FileContent { get; set; }
            [JsonProperty("ItemName")] public string? ItemName { get; set; }
            [JsonProperty("Status")] public bool Status { get; set; }
            [JsonProperty("StatusMessage")] public string? StatusMessage { get; set; }
        }
    }
}
