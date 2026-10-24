using System;
using System.Collections.Generic;

namespace BoldAdhocEmbed.Server.Models
{
    // ===== Request / response DTOs for the Quick Edit flow =====

    /// <summary>
    /// Response from GET .../customize/load. Contains the parsed state
    /// of the source report that the dialog renders, plus an opaque
    /// session token used by /save to load the original RDL bytes.
    /// </summary>
    public class QuickEditLoadResponse
    {
        public string SessionId { get; set; } = string.Empty;
        public string SourceReportId { get; set; } = string.Empty;
        public string SourceReportName { get; set; } = string.Empty;
        public string DatasetName { get; set; } = string.Empty;
        public string? DatasetId { get; set; }

        /// <summary>
        /// The fields the source report's Tablixes actually reference
        /// ("currently used" columns). Kept as-is so the existing load
        /// contract is unchanged.
        /// </summary>
        public List<QuickEditField> DatasetFields { get; set; } = new();

        /// <summary>
        /// FULL column catalog of the report's dataset, read from the
        /// shared dataset .rsd via IDatasetCatalogService. Empty when the
        /// dataset is not a resolvable shared dataset (inlined query, or
        /// the catalog lookup failed) — the dialog then falls back to
        /// <see cref="DatasetFields"/> so behaviour is unchanged.
        /// </summary>
        public List<QuickEditField> AvailableDatasetFields { get; set; } = new();

        public List<QuickEditTablix> Tablixes { get; set; } = new();
        public List<string> LockedReasons { get; set; } = new();
    }

    public class QuickEditField
    {
        public string Name { get; set; } = string.Empty;
        public string? Type { get; set; }
    }

    public class QuickEditTablix
    {
        public string Name { get; set; } = string.Empty;
        public string DatasetName { get; set; } = string.Empty;
        public List<string> SelectedColumns { get; set; } = new();
        // Existing <Filters> / <SortExpressions> on the Tablix so the UI
        // can pre-populate from the source report.
        public List<QuickEditFilter> Filters { get; set; } = new();
        public List<QuickEditSort> Sorts { get; set; } = new();
    }

    public class QuickEditColumnToggle
    {
        public string TablixName { get; set; } = string.Empty;
        public string FieldName { get; set; } = string.Empty;
        public bool Remove { get; set; }
    }

    /// <summary>
    /// Tablix-level filter. Each filter is materialised as a
    /// &lt;Filter&gt; entry inside &lt;Tablix&gt;/&lt;Filters&gt; and a
    /// matching &lt;ReportParameter&gt; in &lt;ReportParameters&gt; so the
    /// user is prompted for the value at run time. The parameter is
    /// referenced from &lt;FilterValues&gt; via =Parameters!X.Value.
    /// </summary>
    public class QuickEditFilter
    {
        public string TablixName { get; set; } = string.Empty;
        public string FieldName { get; set; } = string.Empty;
        public string Operator { get; set; } = "Equal";
        public string DataType { get; set; } = "String";
        public bool MultiValue { get; set; } = false;
        public string? PromptLabel { get; set; }
        public string? ParameterName { get; set; }
        public List<string> DefaultValues { get; set; } = new();
    }

    /// <summary>
    /// Tablix-level sort expression. Each entry becomes a
    /// &lt;SortExpression&gt; inside &lt;Tablix&gt;/&lt;SortExpressions&gt;.
    /// </summary>
    public class QuickEditSort
    {
        public string TablixName { get; set; } = string.Empty;
        public string FieldName { get; set; } = string.Empty;
        public string Direction { get; set; } = "Ascending";
    }

    public class QuickEditSaveRequest
    {
        public string SessionId { get; set; } = string.Empty;
        public string NewReportName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string TargetCategory { get; set; } = "My Reports";
        public List<QuickEditColumnToggle> ColumnToggles { get; set; } = new();
        // Optional. When provided together with TargetTablixName, these
        // represent the COMPLETE desired filter/sort state for that Tablix:
        //   - empty list = clear that Tablix's filters/sorts entirely
        //   - non-empty list = rebuild the block with exactly these entries
        //   - null (field omitted) = leave the RDL's existing entries untouched
        public List<QuickEditFilter>? Filters { get; set; }
        public List<QuickEditSort>? Sorts { get; set; }

        // Which Tablix the Filters / Sorts lists target. Required when
        // either list is provided (even if empty). The dialog always
        // works on the currently selected Tablix; Quick Create passes
        // "Tablix1" because the generator creates a single Tablix.
        public string? TargetTablixName { get; set; }
    }

    public class QuickEditSaveResponse
    {
        public bool Success { get; set; }
        public string? NewReportId { get; set; }
        public string? NewReportName { get; set; }
        public string? TargetCategory { get; set; }
        public string? Error { get; set; }
    }

    /// <summary>
    /// Internal: cached against <see cref="SessionId"/> while the
    /// dialog is open. Stores the original RDL bytes + parsed model so
    /// the save endpoint can re-build without re-downloading.
    /// </summary>
    public class QuickEditSession
    {
        public string SessionId { get; set; } = string.Empty;
        public string SourceReportId { get; set; } = string.Empty;
        public string SourceReportName { get; set; } = string.Empty;
        public string SourceCategory { get; set; } = string.Empty;
        public string RdlXml { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
        public string TenantEmail { get; set; } = string.Empty;
    }
}
