using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BoldAdhocEmbed.Server.Models;
using BoldAdhocEmbed.Server.Services.ReportBuilder;
using Microsoft.Extensions.Logging;

namespace BoldAdhocEmbed.Server.Services.QuickEdit
{
    /// <summary>
    /// Orchestrates the Quick Edit flow:
    ///   1. Load: download RDL, parse, return model + sessionId
    ///   2. Save: look up session, validate, rebuild, upload
    ///   3. Preview: like Save but stop before upload; returns RDL XML
    ///
    /// Sessions live in-memory. Phase 2 can move them to
    /// <see cref="ICacheService"/> if cross-instance support is needed.
    /// </summary>
    public interface ICustomizeService
    {
        Task<(bool Ok, string? Error, QuickEditLoadResponse? Model)> LoadAsync(
            string reportServerPath, string? reportId, string tenantEmail, string token);

        Task<QuickEditSaveResponse> SaveAsync(
            QuickEditSaveRequest request, string tenantEmail);

        Task<QuickEditPreviewResult> PreviewAsync(QuickEditSaveRequest request);
    }

    public class QuickEditPreviewResult
    {
        public bool Success { get; set; }
        public string SessionId { get; set; } = string.Empty;
        public string? RdlXml { get; set; }
        public List<string> Warnings { get; set; } = new();
        public string? Error { get; set; }
    }

    public class CustomizeService : ICustomizeService
    {
        private readonly IBoldItemsClient _items;
        private readonly IRdlParser _parser;
        private readonly IRdlDependencyChecker _checker;
        private readonly IRdlRebuilder _rebuilder;
        private readonly ITokenHelper _tokenHelper;
        private readonly IQuickEditSessionStore _sessions;
        private readonly IDatasetCatalogService _datasetCatalog;
        private readonly ILogger<CustomizeService> _logger;

        // The session dictionary lives in the singleton
        // IQuickEditSessionStore (see Program.cs). Putting it on a scoped
        // CustomizeService would mean every HTTP request sees a fresh,
        // empty dictionary — /load would create a sessionId and /save a
        // few seconds later would not find it. That's the bug this fixes.

        public CustomizeService(
            IBoldItemsClient items,
            IRdlParser parser,
            IRdlDependencyChecker checker,
            IRdlRebuilder rebuilder,
            ITokenHelper tokenHelper,
            IQuickEditSessionStore sessions,
            IDatasetCatalogService datasetCatalog,
            ILogger<CustomizeService> logger)
        {
            _items = items ?? throw new ArgumentNullException(nameof(items));
            _parser = parser ?? throw new ArgumentNullException(nameof(parser));
            _checker = checker ?? throw new ArgumentNullException(nameof(checker));
            _rebuilder = rebuilder ?? throw new ArgumentNullException(nameof(rebuilder));
            _tokenHelper = tokenHelper ?? throw new ArgumentNullException(nameof(tokenHelper));
            _sessions = sessions ?? throw new ArgumentNullException(nameof(sessions));
            _datasetCatalog = datasetCatalog ?? throw new ArgumentNullException(nameof(datasetCatalog));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<(bool Ok, string? Error, QuickEditLoadResponse? Model)> LoadAsync(
            string reportServerPath, string? reportId, string tenantEmail, string token)
        {
            if (string.IsNullOrWhiteSpace(reportServerPath))
                return (false, "reportServerPath is required.", null);

            if (string.IsNullOrEmpty(token))
                return (false, "Bold Reports token is required.", null);

            // Resolve ItemId if not provided.
            string? itemId = reportId;
            if (string.IsNullOrWhiteSpace(itemId))
                itemId = await _items.ResolveItemIdAsync(token, reportServerPath);

            if (string.IsNullOrWhiteSpace(itemId))
                return (false, $"Could not resolve an ItemId for '{reportServerPath}'.", null);

            byte[] bytes;
            try
            {
                bytes = await _items.DownloadItemAsync(token, itemId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Download failed for {Path}", reportServerPath);
                return (false, $"Download failed: {ex.Message}", null);
            }

            string rdl;
            try
            {
                rdl = _parser.ExtractRdlXml(bytes);
            }
            catch (Exception ex)
            {
                return (false, $"RDL extraction failed: {ex.Message}", null);
            }

            var session = new QuickEditSession
            {
                SourceReportId = itemId!,
                SourceReportName = ExtractNameFromPath(reportServerPath),
                SourceCategory = ExtractCategoryFromPath(reportServerPath),
                RdlXml = rdl,
                TenantEmail = tenantEmail ?? string.Empty,
            };
            var sessionId = _sessions.Add(session);

            QuickEditLoadResponse model;
            try
            {
                // Resolve the FULL dataset column catalog from the shared
                // dataset .rsd. We need the parsed model first because it
                // carries the dataset item id the catalog service keys on.
                var parsed = _parser.BuildLoadModel(rdl, itemId!, session.SourceReportName, sessionId);
                var catalogFields = await LoadAvailableDatasetFieldsAsync(token, parsed.DatasetId, parsed.DatasetName);
                model = _parser.BuildLoadModel(rdl, itemId!, session.SourceReportName, sessionId, catalogFields);
            }
            catch (Exception ex)
            {
                _sessions.Remove(sessionId);
                return (false, $"RDL parse failed: {ex.Message}", null);
            }
            return (true, null, model);
        }

        /// <summary>
        /// Reads the full column list of the report's dataset from the
        /// Bold Reports dataset catalog (the shared dataset .rsd).
        ///
        /// Best-effort by design: a failure here must not break the Quick
        /// Edit dialog. The RDL itself is still parseable and the Tablix
        /// columns are still removable, we simply don't get the
        /// "available but not yet in the report" columns. So we log and
        /// return an empty list; the client falls back to datasetFields.
        /// </summary>
        private async Task<List<QuickEditField>> LoadAvailableDatasetFieldsAsync(
            string token, string? datasetId, string? datasetName)
        {
            if (string.IsNullOrWhiteSpace(datasetId))
            {
                _logger.LogDebug(
                    "Quick Edit: report has no resolvable dataset id (name={Name}); skipping catalog lookup.",
                    datasetName);
                return new List<QuickEditField>();
            }

            try
            {
                var detail = await _datasetCatalog.GetDatasetDetailAsync(token, datasetId!);
                if (detail == null || detail.Columns == null || detail.Columns.Count == 0)
                {
                    _logger.LogWarning(
                        "Quick Edit: dataset catalog returned no columns for {Id}; falling back to Tablix fields.",
                        datasetId);
                    return new List<QuickEditField>();
                }

                return detail.Columns
                    .Where(c => !string.IsNullOrWhiteSpace(c.Name))
                    .Select(c => new QuickEditField { Name = c.Name.Trim(), Type = c.TypeName })
                    .ToList();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "Quick Edit: dataset catalog lookup failed for {Id}; falling back to Tablix fields.",
                    datasetId);
                return new List<QuickEditField>();
            }
        }

        public async Task<QuickEditSaveResponse> SaveAsync(QuickEditSaveRequest request, string tenantEmail)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.SessionId))
                return Fail("SessionId is required.");
            if (string.IsNullOrWhiteSpace(request.NewReportName))
                return Fail("New report name is required.");

            if (!_sessions.TryGet(request.SessionId, out var session) || session == null)
                return Fail("Session expired or unknown. Please reopen the dialog.");

            var token = await _tokenHelper.GetPasswordTokenAsync();
            if (string.IsNullOrEmpty(token))
                return Fail("Failed to obtain Bold Reports admin token.");

            // Dependency pre-check — refuse if any removal would break a referencing expression.
            var blocked = new List<string>();
            foreach (var toggle in request.ColumnToggles.Where(t => t.Remove))
            {
                var refs = _checker.FindReferencesTo(session.RdlXml, toggle.FieldName);
                if (refs.Count > 0)
                {
                    blocked.Add($"Column '{toggle.FieldName}' is referenced by {refs.Count} expression(s): "
                                + string.Join("; ", refs.Take(3).Select(r => r.ElementPath)));
                }
            }
            if (blocked.Count > 0)
            {
                return new QuickEditSaveResponse
                {
                    Success = false,
                    Error = "Refusing to save: " + string.Join(" | ", blocked),
                };
            }

            var rebuild = _rebuilder.Rebuild(session.RdlXml, request.ColumnToggles, request.Filters, request.Sorts, request.TargetTablixName);
            if (!rebuild.Success || string.IsNullOrEmpty(rebuild.RdlXml))
            {
                return new QuickEditSaveResponse
                {
                    Success = false,
                    Error = "RDL rebuild failed: " + string.Join("; ", rebuild.Errors),
                };
            }

            // Resolve the target folder. In Bold Reports the per-user
            // "My Reports" folder is actually a Category named after the
            // user's email (e.g. "ianbenj@syncfusion.com"). The dialog
            // sends whatever the user typed — when it sends the empty
            // string, fall back to the tenant email from the JWT auth
            // context. If the folder doesn't exist yet (first save for a
            // new user), ResolveCategoryIdAsync creates it lazily.
            var requestedCategory = string.IsNullOrWhiteSpace(request.TargetCategory)
                ? tenantEmail
                : request.TargetCategory;
            var categoryId = await _items.ResolveCategoryIdAsync(token, requestedCategory);
            if (string.IsNullOrWhiteSpace(categoryId))
            {
                return new QuickEditSaveResponse
                {
                    Success = false,
                    Error = $"Could not resolve or create a Bold Reports category named '{requestedCategory}'.",
                };
            }

            var serverPath = $"/{requestedCategory.Trim('/')}/{request.NewReportName}";
            var rdlBytes = System.Text.Encoding.UTF8.GetBytes(rebuild.RdlXml);
            var created = await _items.CreateReportAsync(token, serverPath, categoryId: categoryId,
                description: request.Description ?? string.Empty,
                reportName: request.NewReportName,
                rdlBytes: rdlBytes);
            if (!created.Success)
            {
                return new QuickEditSaveResponse
                {
                    Success = false,
                    Error = $"Upload failed ({(int)created.StatusCode}): {created.Error}",
                };
            }

            _sessions.Remove(session.SessionId);

            return new QuickEditSaveResponse
            {
                Success = true,
                NewReportId = created.ItemId,
                NewReportName = request.NewReportName,
                TargetCategory = requestedCategory,
            };
        }

        public async Task<QuickEditPreviewResult> PreviewAsync(QuickEditSaveRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.SessionId))
                return new QuickEditPreviewResult { Success = false, Error = "SessionId is required." };

            if (!_sessions.TryGet(request.SessionId, out var session) || session == null)
                return new QuickEditPreviewResult { Success = false, Error = "Session expired or unknown." };

            var blocked = new List<string>();
            foreach (var toggle in request.ColumnToggles.Where(t => t.Remove))
            {
                var refs = _checker.FindReferencesTo(session.RdlXml, toggle.FieldName);
                if (refs.Count > 0)
                    blocked.Add($"Column '{toggle.FieldName}' is referenced by {refs.Count} expression(s).");
            }
            if (blocked.Count > 0)
                return new QuickEditPreviewResult { Success = false, Error = "Refusing to preview: " + string.Join(" | ", blocked) };

            var rebuild = _rebuilder.Rebuild(session.RdlXml, request.ColumnToggles, request.Filters, request.Sorts, request.TargetTablixName);
            if (!rebuild.Success || string.IsNullOrEmpty(rebuild.RdlXml))
                return new QuickEditPreviewResult { Success = false, Error = "Rebuild failed: " + string.Join("; ", rebuild.Errors) };

            return new QuickEditPreviewResult
            {
                Success = true,
                SessionId = session.SessionId,
                RdlXml = rebuild.RdlXml,
                Warnings = rebuild.Warnings,
            };
        }

        // ------------------------------------------------------------ helpers

        private static QuickEditSaveResponse Fail(string msg) =>
            new() { Success = false, Error = msg };

        private static string ExtractNameFromPath(string path)
        {
            if (string.IsNullOrWhiteSpace(path)) return string.Empty;
            var trimmed = path.Trim('/');
            var slash = trimmed.LastIndexOf('/');
            return slash < 0 ? trimmed : trimmed[(slash + 1)..];
        }

        private static string ExtractCategoryFromPath(string path)
        {
            if (string.IsNullOrWhiteSpace(path)) return string.Empty;
            var trimmed = path.Trim('/');
            var slash = trimmed.LastIndexOf('/');
            return slash < 0 ? string.Empty : trimmed[..slash];
        }
    }
}
