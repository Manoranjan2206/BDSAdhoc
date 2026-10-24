using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;
using BoldAdhocEmbed.Server.Models;

namespace BoldAdhocEmbed.Server.Services.QuickEdit
{
    /// <summary>
    /// Applies column toggles and item removals to an RDL document.
    ///
    /// Conservative by design: only modifies the structures we fully
    /// understand. Anything that looks ambiguous is left untouched and
    /// surfaced as a warning to the caller.
    ///
    /// Namespace-tolerant: matches by LocalName rather than the literal
    /// RDL 2008/01/reportdefinition namespace, because Bold Reports
    /// occasionally emits RDL files with non-standard prefix bindings.
    /// </summary>
    public interface IRdlRebuilder
    {
        RebuildResult Rebuild(string rdlXml,
                              IList<QuickEditColumnToggle> columnToggles,
                              IList<QuickEditFilter>? filters = null,
                              IList<QuickEditSort>? sorts = null,
                              string? targetTablixName = null);
    }

    public class RebuildResult
    {
        public bool Success { get; set; }
        public string? RdlXml { get; set; }
        public List<string> Warnings { get; set; } = new();
        public List<string> Errors { get; set; } = new();
    }

    public class RdlRebuilder : IRdlRebuilder
    {
        private static readonly Regex FieldRefRx =
            new(@"Fields!\s*(?<name>[A-Za-z_][A-Za-z0-9_]*)",
                RegexOptions.IgnoreCase | RegexOptions.Compiled);

        public RebuildResult Rebuild(string rdlXml,
                                     IList<QuickEditColumnToggle> columnToggles,
                                     IList<QuickEditFilter>? filters = null,
                                     IList<QuickEditSort>? sorts = null,
                                     string? targetTablixName = null)
        {
            var result = new RebuildResult();
            if (string.IsNullOrWhiteSpace(rdlXml))
            {
                result.Errors.Add("Empty RDL.");
                return result;
            }

            XDocument doc;
            try
            {
                doc = XDocument.Parse(rdlXml, LoadOptions.PreserveWhitespace | LoadOptions.SetLineInfo);
            }
            catch (Exception ex)
            {
                result.Errors.Add($"RDL parse failed: {ex.Message}");
                return result;
            }

            var root = doc.Root;
            if (root == null)
            {
                result.Errors.Add("RDL has no root element.");
                return result;
            }

            // --- 1. Column toggles ---
            foreach (var group in columnToggles.GroupBy(c => c.TablixName, StringComparer.OrdinalIgnoreCase))
            {
                var tablix = root.Descendants()
                    .FirstOrDefault(t => t.Name.LocalName == "Tablix"
                        && string.Equals((string?)t.Attribute("Name"), group.Key, StringComparison.OrdinalIgnoreCase));
                if (tablix == null)
                {
                    result.Warnings.Add($"Tablix '{group.Key}' not found in RDL; column toggles skipped.");
                    continue;
                }
                foreach (var toggle in group)
                {
                    if (toggle.Remove)
                        RemoveColumn(tablix, toggle.FieldName, result);
                    else
                        AddColumn(tablix, toggle.FieldName, result);
                }
            }

            // --- 2. Filters (Tablix <Filters> + report-level <ReportParameters>) ---
            // ApplyFilters is called whenever the caller passes a Filters
            // list — even an empty one — and provides TargetTablixName.
            // That gives the call the "desired state" semantics: an empty
            // list means "clear every filter on that Tablix", not "leave
            // existing filters alone". Quick Create passes the single Tablix
            // it just generated; Quick Edit passes the user-selected Tablix.
            if (filters != null && !string.IsNullOrWhiteSpace(targetTablixName))
                ApplyFilters(root, filters, targetTablixName, result);
            else if (filters != null)
                ApplyFiltersAll(root, filters, result);

            // --- 3. Sort expressions (Tablix <SortExpressions>) ---
            if (sorts != null && !string.IsNullOrWhiteSpace(targetTablixName))
                ApplySorts(root, sorts, targetTablixName, result);
            else if (sorts != null)
                ApplySortsAll(root, sorts, result);

            // Re-serialize.
            var settings = new XmlWriterSettings
            {
                OmitXmlDeclaration = false,
                Indent = true,
                Encoding = new System.Text.UTF8Encoding(false),
            };
            using var ms = new System.IO.MemoryStream();
            using (var writer = XmlWriter.Create(ms, settings))
            {
                doc.WriteTo(writer);
            }
            result.RdlXml = System.Text.Encoding.UTF8.GetString(ms.ToArray());
            result.Success = result.Errors.Count == 0;
            return result;
        }

        // ---------------------------------------------------------------- column removal

        /// <summary>
        /// Removes a column from a Tablix.
        ///
        /// Strategy A (flat tables — the common Quick Edit case): a column
        /// in a flat Tablix is the aligned tuple of
        ///   - one &lt;TablixColumn&gt; (the width definition),
        ///   - one &lt;TablixMember&gt; in the TablixColumnHierarchy, and
        ///   - one &lt;TablixCell&gt; at the same ordinal in EVERY row
        ///     (header row + data row + any others).
        /// Removing only the data cell (the old behaviour) left the column
        /// width, the header cell and the hierarchy member behind, so the
        /// cell/column counts no longer matched and Bold Reports silently
        /// ignored the edit — i.e. the removal "wasn't reflected". We now
        /// locate the column ordinal from the data cell that references the
        /// field and delete the whole aligned tuple by index, keeping the
        /// Tablix internally consistent.
        ///
        /// Strategy B (grouped tables): remove the matching row-group
        /// TablixMember by its Group Name.
        /// </summary>
        private static void RemoveColumn(XElement tablix, string fieldName, RebuildResult result)
        {
            var tablixName = tablix.Attribute("Name")?.Value;

            // Strategy A: flat-table column removal by ordinal.
            if (TryRemoveFlatColumn(tablix, fieldName, result))
                return;

            // Strategy B: row-group TablixMember (grouped reports).
            var rowHierarchy = tablix.Elements().FirstOrDefault(e => e.Name.LocalName == "TablixRowHierarchy");
            var rowMembers = rowHierarchy?
                .Elements().FirstOrDefault(e => e.Name.LocalName == "TablixMembers")?
                .Elements().Where(e => e.Name.LocalName == "TablixMember").ToList();
            if (rowMembers != null && rowMembers.Count > 0)
            {
                var matchingGroupMember = rowMembers.FirstOrDefault(m =>
                {
                    var grp = m.Elements().FirstOrDefault(e => e.Name.LocalName == "Group");
                    return string.Equals((string?)grp?.Attribute("Name"), fieldName, StringComparison.OrdinalIgnoreCase);
                });
                if (matchingGroupMember != null)
                {
                    matchingGroupMember.Remove();
                    result.Warnings.Add($"Removed row-group '{fieldName}' from Tablix '{tablixName}'.");
                    return;
                }
            }

            result.Warnings.Add($"Could not locate column '{fieldName}' in Tablix '{tablixName}' — no change applied.");
        }

        /// <summary>
        /// Flat-table column removal. Returns true if the column was found
        /// and removed consistently (TablixColumn + column-hierarchy member
        /// + the cell at that ordinal in every row).
        /// </summary>
        private static bool TryRemoveFlatColumn(XElement tablix, string fieldName, RebuildResult result)
        {
            var body = LocalChild(tablix, "TablixBody");
            if (body == null) return false;

            var columnsContainer = LocalChild(body, "TablixColumns");
            var rowsContainer = LocalChild(body, "TablixRows");
            if (columnsContainer == null || rowsContainer == null) return false;

            var columns = LocalChildren(columnsContainer, "TablixColumn");
            var rows = LocalChildren(rowsContainer, "TablixRow");
            if (columns.Count == 0 || rows.Count == 0) return false;

            // Find the column ordinal by scanning the data rows for the cell
            // whose expression references the field. (Header rows carry the
            // caption as a literal, so we rely on the data cell's Fields!
            // reference to pin the index.)
            int targetIndex = -1;
            foreach (var row in rows)
            {
                var cells = RowCells(row);
                for (var i = 0; i < cells.Count; i++)
                {
                    if (CellReferencesField(cells[i], fieldName))
                    {
                        targetIndex = i;
                        break;
                    }
                }
                if (targetIndex >= 0) break;
            }

            if (targetIndex < 0) return false;

            // Only proceed when the Tablix is rectangular at this ordinal —
            // every row must have a cell there and the column/hierarchy
            // definitions must line up. Otherwise bail to the caller so we
            // don't corrupt an irregular layout.
            var columnHierarchy = tablix.Elements().FirstOrDefault(e => e.Name.LocalName == "TablixColumnHierarchy");
            var columnMembersContainer = columnHierarchy == null ? null : LocalChild(columnHierarchy, "TablixMembers");
            var columnMembers = columnMembersContainer == null
                ? new List<XElement>()
                : LocalChildren(columnMembersContainer, "TablixMember");

            if (targetIndex >= columns.Count) return false;
            foreach (var row in rows)
            {
                if (targetIndex >= RowCells(row).Count) return false;
            }

            // Remove the aligned tuple by ordinal.
            columns[targetIndex].Remove();

            if (columnMembers.Count > targetIndex)
                columnMembers[targetIndex].Remove();

            foreach (var row in rows)
            {
                var cells = RowCells(row);
                cells[targetIndex].Remove();
            }

            result.Warnings.Add(
                $"Removed column '{fieldName}' (ordinal {targetIndex}) from Tablix "
                + $"'{tablix.Attribute("Name")?.Value}'.");
            return true;
        }

        // ---------------------------------------------------------------- column addition

        /// <summary>
        /// Adds a dataset column that isn't currently in the Tablix.
        ///
        /// Mirrors <see cref="RemoveColumn"/>: the symmetric case is
        /// Strategy A (flat tables) — a column is the aligned tuple of
        ///   - one &lt;TablixColumn&gt; (the width definition),
        ///   - one &lt;TablixMember&gt; in the TablixColumnHierarchy, and
        ///   - one &lt;TablixCell&gt; at the same ordinal in EVERY row.
        /// Adding only the data cell leaves the column count short of the
        /// cell count and Bold Reports silently drops the edit, so we clone
        /// the aligned tuple from the nearest existing column and splice all
        /// three parts in at the same ordinal.
        /// </summary>
        private static void AddColumn(XElement tablix, string fieldName, RebuildResult result)
        {
            var tablixName = tablix.Attribute("Name")?.Value;

            if (TryAddFlatColumn(tablix, fieldName, result))
                return;

            result.Warnings.Add(
                $"Could not add column '{fieldName}' to Tablix '{tablixName}' — "
                + "no rectangular Tablix body to extend (grouped or irregular layout); no change applied.");
        }

        /// <summary>
        /// Flat-table column addition. Returns true if the column tuple was
        /// inserted consistently (TablixColumn + column-hierarchy member +
        /// a cell at that ordinal in every row).
        ///
        /// The same rectangular invariants the remove path enforces apply:
        /// every row must have a cell at the insertion ordinal, and the
        /// column / column-hierarchy definitions must line up. Otherwise we
        /// bail out rather than corrupt an irregular layout.
        /// </summary>
        private static bool TryAddFlatColumn(XElement tablix, string fieldName, RebuildResult result)
        {
            if (string.IsNullOrWhiteSpace(fieldName)) return false;

            var body = LocalChild(tablix, "TablixBody");
            if (body == null) return false;

            var columnsContainer = LocalChild(body, "TablixColumns");
            var rowsContainer = LocalChild(body, "TablixRows");
            if (columnsContainer == null || rowsContainer == null) return false;

            var columns = LocalChildren(columnsContainer, "TablixColumn");
            var rows = LocalChildren(rowsContainer, "TablixRow");
            if (columns.Count == 0 || rows.Count == 0) return false;

            // Already present? Adding it twice would duplicate the column
            // and corrupt the Tablix. The client normally filters these
            // out, but the endpoint is reachable directly.
            foreach (var row in rows)
            {
                foreach (var cell in RowCells(row))
                {
                    if (CellReferencesField(cell, fieldName)) return true;
                }
            }

            // New columns are appended to the right of the existing ones.
            var targetIndex = columns.Count;

            // Rectangularity check — identical invariants to the remove
            // path. A row that is short at the insertion ordinal cannot
            // take a new cell without changing the Tablix's structure, and
            // doing so silently is what made the original remove bug so
            // hard to spot.
            foreach (var row in rows)
            {
                var cells = RowCells(row);
                if (targetIndex > cells.Count) return false;
            }

            // Also require the cell count to match the column count on every
            // row (an irregular row means this is not a plain flat table).
            foreach (var row in rows)
            {
                if (RowCells(row).Count != columns.Count) return false;
            }

            // The column hierarchy must line up with the columns we are
            // splicing into; when it is shorter we still allow the add and
            // synthesise the missing member (see below).
            var columnHierarchy = tablix.Elements().FirstOrDefault(e => e.Name.LocalName == "TablixColumnHierarchy");
            var columnMembersContainer = columnHierarchy == null ? null : LocalChild(columnHierarchy, "TablixMembers");
            var columnMembers = columnMembersContainer == null
                ? new List<XElement>()
                : LocalChildren(columnMembersContainer, "TablixMember");
            if (columnMembers.Count > 0 && columnMembers.Count != columns.Count) return false;

            // ---- 1. TablixColumn (width) --------------------------------
            // Clone the last column so we inherit the table's own width /
            // style rather than guessing at one. A TablixColumn carries no
            // unique identity in the 2016/01 schema, so a straight clone is
            // valid.
            var sourceColumn = columns[columns.Count - 1];
            var newColumn = new XElement(sourceColumn);
            EnsureColumnWidth(newColumn, sourceColumn);
            columnsContainer.Add(newColumn);

            // ---- 2. TablixColumnHierarchy member ------------------------
            if (columnMembersContainer != null && columnMembers.Count > 0)
            {
                // A column-hierarchy TablixMember also carries no unique
                // identity in this schema — clone the last one.
                columnMembersContainer.Add(new XElement(columnMembers[columnMembers.Count - 1]));
            }
            else if (columnMembersContainer != null)
            {
                // Flat table with an empty member list — add a static member
                // so the hierarchy stays one-per-column.
                columnMembersContainer.Add(new XElement("TablixMember"));
            }

            // ---- 3. One cell per row, at the same ordinal ----------------
            for (var i = 0; i < rows.Count; i++)
            {
                var row = rows[i];
                var cellsContainer = LocalChild(row, "TablixCells");
                if (cellsContainer == null) return false;
                var cells = LocalChildren(cellsContainer, "TablixCell");
                if (cells.Count < targetIndex) return false;

                var newCell = BuildCellForField(cells, fieldName, i, tablix);
                if (newCell == null) return false;

                // Header rows hold a literal caption; data rows hold the
                // field expression. Cloning the last cell of THIS row keeps
                // the header/detail distinction without us having to guess.
                var anchor = cells.Count > 0 ? cells[cells.Count - 1] : null;
                if (anchor != null)
                    anchor.AddAfterSelf(newCell);
                else
                    cellsContainer.Add(newCell);
            }

            // ---- 4. Grow the Tablix / body widths -------------------------
            GrowTablixWidths(tablix, newColumn);

            result.Warnings.Add(
                $"Added column '{fieldName}' at ordinal {targetIndex} in Tablix "
                + $"'{tablix.Attribute("Name")?.Value}'.");
            return true;
        }

        private static XElement? BuildCellForField(
            List<XElement> cells, string fieldName, int rowIndex, XElement tablix)
        {
            var anchor = cells.Count > 0 ? cells[cells.Count - 1] : null;
            if (anchor == null) return null;

            // Clone the row's last cell so the new cell inherits the report's
            // own styling (borders, background, padding) instead of a
            // hardcoded guess.
            var newCell = new XElement(anchor);

            // Rewrite the textbox Name + DefaultName. RDL requires textbox
            // names to be unique across the whole report, and the header
            // cell and the detail cell of one column are two DIFFERENT
            // textboxes — so the ROW INDEX (not the column ordinal) has to
            // be part of the name.
            var safeName = SanitizeIdentifier(
                $"{fieldName}_r{rowIndex}_{tablix.Attribute("Name")?.Value}");
            foreach (var tb in newCell.Descendants().Where(e => e.Name.LocalName == "Textbox").ToList())
            {
                tb.SetAttributeValue("Name", safeName);
                tb.Elements().FirstOrDefault(e => e.Name.LocalName == "DefaultName")?.SetValue(safeName);
            }

            // Point the TextRun at the field. A header row (a literal
            // caption) gets the humanised field name; a data row gets the
            // =Fields!X.Value expression. We decide by whether the anchor
            // was already an expression.
            foreach (var run in newCell.Descendants().Where(e => e.Name.LocalName == "TextRun"))
            {
                var value = run.Elements().FirstOrDefault(e => e.Name.LocalName == "Value");
                if (value == null) continue;
                value.SetValue(IsExpression(value.Value)
                    ? $"=Fields!{fieldName}.Value"
                    : Humanize(fieldName));
            }

            return newCell;
        }

        private static bool IsExpression(string? value) =>
            !string.IsNullOrWhiteSpace(value) && value.TrimStart().StartsWith("=", StringComparison.Ordinal);

        private static void EnsureColumnWidth(XElement newColumn, XElement sourceColumn)
        {
            if (LocalChild(newColumn, "Width") != null) return;
            var sourceWidth = LocalChild(sourceColumn, "Width")?.Value;
            if (!string.IsNullOrWhiteSpace(sourceWidth))
            {
                newColumn.Add(new XElement("Width", sourceWidth));
                return;
            }
            newColumn.Add(new XElement("Width", "1in"));
        }

        // The Tablix declares an explicit <Width>; adding a column makes that too
        // narrow and Bold Reports clips the right-hand columns. Grow the
        // Tablix by the added column's width. The enclosing Body's <Width>
        // is a sibling of the Tablix (not a descendant), so we leave it
        // alone — the engine grows the body to fit its content.
        private static void GrowTablixWidths(XElement tablix, XElement newColumn)
        {
            var addedWidth = ParseInches(LocalChild(newColumn, "Width")?.Value);
            if (addedWidth <= 0) return;

            var tablixWidth = LocalChild(tablix, "Width");
            if (tablixWidth == null) return;
            var current = ParseInches(tablixWidth.Value);
            if (current <= 0) return;
            tablixWidth.Value = FormatInches(current + addedWidth);
        }

        // ---------------------------------------------------------------- filters & sorts

        /// <summary>
        /// Writes Tablix-level &lt;Filters&gt; on a SINGLE Tablix and the
        /// matching report-level &lt;ReportParameters&gt; + &lt;ReportParametersLayout&gt;.
        ///
        /// Each QuickEditFilter becomes:
        ///   &lt;Filter&gt;
        ///     &lt;FilterExpression&gt;=Fields!X.Value&lt;/FilterExpression&gt;
        ///     &lt;Operator&gt;In&lt;/Operator&gt;                    (or Equal/Like/…)
        ///     &lt;FilterValues&gt;
        ///       &lt;FilterValue DataType="Integer"&gt;=Parameters!P.Value&lt;/FilterValue&gt;
        ///     &lt;/FilterValues&gt;
        ///   &lt;/Filter&gt;
        /// plus a &lt;ReportParameter Name="P"&gt; whose ValidValues pull from the
        /// Tablix's dataset, so the viewer shows a dropdown of actual values.
        ///
        /// Desired-state semantics: the resulting &lt;Filters&gt; block on the
        /// target Tablix contains EXACTLY the requested entries — adds new
        /// ones, replaces same-field entries, and removes entries the user
        /// deleted via the UI (which is why an empty list clears everything).
        /// Filters on OTHER tablixes are untouched.
        /// </summary>
        private static void ApplyFilters(
            XElement root,
            IList<QuickEditFilter> filters,
            string targetTablixName,
            RebuildResult result)
        {
            XNamespace rd = root.Name.Namespace;
            XNamespace ns = rd; // ReportParameters live in the default RDL namespace

            // Operate on exactly one Tablix — the one the dialog/Quick Create
            // is currently editing. An empty filters list here means "clear
            // that Tablix's filters entirely", which is the correct semantics
            // for the UI's Remove button.
            var tablix = root.Descendants()
                .FirstOrDefault(t => t.Name.LocalName == "Tablix"
                    && string.Equals((string?)t.Attribute("Name"), targetTablixName, StringComparison.OrdinalIgnoreCase));
            if (tablix == null)
            {
                result.Warnings.Add($"Tablix '{targetTablixName}' not found in RDL; its filters were skipped.");
                return;
            }

            var datasetName = LocalChild(tablix, "DataSetName")?.Value
                ?? root.Descendants()
                    .FirstOrDefault(e => e.Name.LocalName == "DataSet")
                    ?.Attribute("Name")?.Value
                ?? "DataSet1";

            var filtersContainer = LocalChild(tablix, "Filters");
            if (filtersContainer == null)
            {
                filtersContainer = new XElement(ns + "Filters");
                var bodyAnchor = LocalChild(tablix, "TablixBody");
                if (bodyAnchor != null) bodyAnchor.AddBeforeSelf(filtersContainer);
                else tablix.AddFirst(filtersContainer);
            }

            // Desired-state: rebuild <Filters> contents to match exactly.
            var desiredFields = new HashSet<string>(
                filters.Select(f => f.FieldName),
                StringComparer.OrdinalIgnoreCase);

            // Drop existing filters the user removed from the UI.
            var toRemove = filtersContainer.Elements()
                .Where(fe => fe.Name.LocalName == "Filter"
                    && !desiredFields.Contains(FieldNameOf(fe) ?? string.Empty))
                .ToList();
            foreach (var fe in toRemove)
            {
                // Drop the matching <ReportParameter> + layout cell so we
                // don't leave a stale parameter on the report.
                var pname = ParameterNameOf(fe);
                if (!string.IsNullOrWhiteSpace(pname))
                    RemoveReportParameter(root, ns, pname);
                fe.Remove();
            }

            // Now write the desired entries.
            foreach (var f in filters)
            {
                var paramName = string.IsNullOrWhiteSpace(f.ParameterName)
                    ? SanitizeIdentifier(f.FieldName) + "Param"
                    : SanitizeIdentifier(f.ParameterName);

                // IMPORTANT: <FilterValue> carries the DataType attribute
                // (NOT its <FilterValues> parent). Putting it on the parent
                // makes the viewer ignore the filter — which is why the
                // previous build wasn't actually filtering the Tablix.
                var filterEl = new XElement(ns + "Filter",
                    new XElement(ns + "FilterExpression", $"=Fields!{f.FieldName}.Value"),
                    new XElement(ns + "Operator",
                        string.Equals(f.Operator, "In", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(f.Operator, "NotIn", StringComparison.OrdinalIgnoreCase)
                            ? f.Operator
                            : "Equal"),
                    new XElement(ns + "FilterValues",
                        new XElement(ns + "FilterValue",
                            new XAttribute("DataType", f.DataType),
                            $"=Parameters!{paramName}.Value")));

                // Replace an existing filter on the same field, else append.
                var existing = filtersContainer.Elements()
                    .FirstOrDefault(fe => fe.Name.LocalName == "Filter"
                        && string.Equals(FieldNameOf(fe), f.FieldName, StringComparison.OrdinalIgnoreCase));
                if (existing != null) existing.ReplaceWith(filterEl);
                else filtersContainer.Add(filterEl);

                UpsertReportParameter(root, ns, paramName, f, datasetName);
            }

            // Empty <Filters> container — drop it so the RDL stays clean.
            if (!filtersContainer.Elements().Any())
                filtersContainer.Remove();

            RebuildParameterLayout(root, ns);
        }

        /// <summary>
        /// Fallback for callers that don't supply TargetTablixName: apply
        /// filters grouped by their per-filter TablixName (Quick Create's
        /// pre-existing flow). Use <see cref="ApplyFilters(XElement, IList{QuickEditFilter}, string, RebuildResult)"/>
        /// whenever possible — empty lists there mean "clear", while here
        /// an empty group is silently skipped.
        /// </summary>
        private static void ApplyFiltersAll(
            XElement root,
            IList<QuickEditFilter> filters,
            RebuildResult result)
        {
            if (filters.Count == 0) return;
            foreach (var group in filters.GroupBy(f => f.TablixName, StringComparer.OrdinalIgnoreCase))
            {
                ApplyFilters(root, group.ToList(), group.Key, result);
            }
        }

        private static string? ParameterNameOf(XElement filterEl)
        {
            var valuesContainer = filterEl.Elements().FirstOrDefault(e => e.Name.LocalName == "FilterValues");
            var valueEl = valuesContainer?.Elements().FirstOrDefault(e => e.Name.LocalName == "FilterValue");
            var v = valueEl?.Value;
            if (string.IsNullOrWhiteSpace(v)) return null;
            var m = System.Text.RegularExpressions.Regex.Match(v, @"Parameters\s*!\s*(?<name>[A-Za-z_][A-Za-z0-9_]*)");
            return m.Success ? m.Groups["name"].Value : null;
        }

        private static void RemoveReportParameter(XElement root, XNamespace ns, string paramName)
        {
            var paramsRoot = root.Elements().FirstOrDefault(e => e.Name.LocalName == "ReportParameters");
            if (paramsRoot == null) return;
            var p = paramsRoot.Elements()
                .FirstOrDefault(e => e.Name.LocalName == "ReportParameter"
                    && string.Equals((string?)e.Attribute("Name"), paramName, StringComparison.OrdinalIgnoreCase));
            p?.Remove();
        }

        private static string? FieldNameOf(XElement filterEl)
        {
            var expr = filterEl.Elements().FirstOrDefault(e => e.Name.LocalName == "FilterExpression")?.Value;
            if (string.IsNullOrWhiteSpace(expr)) return null;
            var m = FieldRefRx.Match(expr);
            return m.Success ? m.Groups["name"].Value : null;
        }

        /// <summary>
        /// Creates or updates a &lt;ReportParameter&gt; so the viewer prompts
        /// the user for the filter value at run time. ValidValues reference
        /// the dataset so Bold Reports renders a dropdown of real values.
        /// </summary>
        private static void UpsertReportParameter(
            XElement root,
            XNamespace ns,
            string paramName,
            QuickEditFilter f,
            string datasetName)
        {
            var paramsRoot = root.Elements().FirstOrDefault(e => e.Name.LocalName == "ReportParameters");
            if (paramsRoot == null)
            {
                paramsRoot = new XElement(ns + "ReportParameters");
                // Place after <DataSets> (schema order) when present.
                var datasets = root.Elements().FirstOrDefault(e => e.Name.LocalName == "DataSets");
                if (datasets != null) datasets.AddAfterSelf(paramsRoot);
                else root.Add(paramsRoot);
            }

            var existing = paramsRoot.Elements()
                .FirstOrDefault(e => e.Name.LocalName == "ReportParameter"
                    && string.Equals((string?)e.Attribute("Name"), paramName, StringComparison.OrdinalIgnoreCase));

            var paramEl = new XElement(ns + "ReportParameter",
                new XAttribute("Name", paramName),
                new XElement(ns + "DataType", f.DataType),
                new XElement(ns + "Prompt", string.IsNullOrWhiteSpace(f.PromptLabel) ? f.FieldName : f.PromptLabel),
                new XElement(ns + "ValidValues",
                    new XElement(ns + "DataSetReference",
                        new XElement(ns + "DataSetName", datasetName),
                        new XElement(ns + "ValueField", f.FieldName),
                        new XElement(ns + "LabelField", f.FieldName))));

            // A MultiValue filter needs <MultiValue>true</MultiValue> so the
            // viewer renders a multi-select list; single-value filters omit it.
            if (f.MultiValue)
                paramEl.Add(new XElement(ns + "MultiValue", "true"));

            if (existing != null) existing.ReplaceWith(paramEl);
            else paramsRoot.Add(paramEl);
        }

        /// <summary>
        /// Rewrites &lt;ReportParametersLayout&gt; so every parameter currently
        /// declared under &lt;ReportParameters&gt; gets a prompt slot. If the
        /// layout is absent we create one. After <see cref="RemoveReportParameter"/>
        /// drops a parameter, this pass also drops its CellDefinition.
        /// </summary>
        private static void RebuildParameterLayout(
            XElement root,
            XNamespace ns)
        {
            var paramsRoot = root.Elements().FirstOrDefault(e => e.Name.LocalName == "ReportParameters");
            if (paramsRoot == null || !paramsRoot.Elements().Any())
            {
                // No parameters left — drop the layout if it exists.
                var stale = root.Elements().FirstOrDefault(e => e.Name.LocalName == "ReportParametersLayout");
                stale?.Remove();
                return;
            }

            var layout = root.Elements().FirstOrDefault(e => e.Name.LocalName == "ReportParametersLayout");
            var gridLayout = layout?.Elements().FirstOrDefault(e => e.Name.LocalName == "GridLayoutDefinition");
            if (gridLayout == null)
            {
                layout?.Remove();
                layout = new XElement(ns + "ReportParametersLayout",
                    new XElement(ns + "GridLayoutDefinition"));
                gridLayout = layout.Elements().First();
                paramsRoot.AddAfterSelf(layout);
            }

            var cellDefs = gridLayout.Elements().FirstOrDefault(e => e.Name.LocalName == "CellDefinitions");
            cellDefs?.Remove();
            cellDefs = new XElement(ns + "CellDefinitions");

            var paramNames = paramsRoot.Elements()
                .Where(e => e.Name.LocalName == "ReportParameter")
                .Select(e => e.Attribute("Name")?.Value)
                .Where(n => !string.IsNullOrWhiteSpace(n))
                .Select(n => n!)
                .ToList();

            // 4 columns per row keeps the prompt bar compact.
            const int cols = 4;
            var rows = (int)Math.Ceiling(paramNames.Count / (double)cols);
            gridLayout.SetElementValue(ns + "NumberOfColumns", cols);
            gridLayout.SetElementValue(ns + "NumberOfRows", Math.Max(rows, 1));

            for (int i = 0; i < paramNames.Count; i++)
            {
                cellDefs.Add(new XElement(ns + "CellDefinition",
                    new XElement(ns + "ColumnIndex", i % cols),
                    new XElement(ns + "RowIndex", i / cols),
                    new XElement(ns + "ParameterName", paramNames[i])));
            }
            gridLayout.Add(cellDefs);
        }

        /// <summary>
        /// Writes Tablix-level &lt;SortExpressions&gt;. Desired-state semantics:
        /// the resulting block contains EXACTLY the requested entries for each
        /// tablix in the payload. Adds new ones, replaces same-field entries,
        /// and removes entries the user deleted via the UI.
        /// </summary>
        private static void ApplySorts(
            XElement root,
            IList<QuickEditSort> sorts,
            string targetTablixName,
            RebuildResult result)
        {
            XNamespace ns = root.Name.Namespace;

            var tablix = root.Descendants()
                .FirstOrDefault(t => t.Name.LocalName == "Tablix"
                    && string.Equals((string?)t.Attribute("Name"), targetTablixName, StringComparison.OrdinalIgnoreCase));
            if (tablix == null)
            {
                result.Warnings.Add($"Tablix '{targetTablixName}' not found in RDL; its sorts were skipped.");
                return;
            }

            var sortContainer = LocalChild(tablix, "SortExpressions");
            if (sortContainer == null)
            {
                sortContainer = new XElement(ns + "SortExpressions");
                var bodyAnchor = LocalChild(tablix, "TablixBody");
                if (bodyAnchor != null) bodyAnchor.AddBeforeSelf(sortContainer);
                else tablix.AddFirst(sortContainer);
            }

            // Desired-state: drop existing sorts the user removed from the UI.
            var desiredFields = new HashSet<string>(
                sorts.Select(s => s.FieldName),
                StringComparer.OrdinalIgnoreCase);
            var toRemove = sortContainer.Elements()
                .Where(se => se.Name.LocalName == "SortExpression"
                    && !desiredFields.Contains(FieldNameOfSort(se) ?? string.Empty))
                .ToList();
            foreach (var se in toRemove) se.Remove();

            // Now write the desired entries (replace or append).
            foreach (var s in sorts)
            {
                var direction = string.Equals(s.Direction, "Descending", StringComparison.OrdinalIgnoreCase)
                    ? "Descending"
                    : "Ascending";

                var sortEl = new XElement(ns + "SortExpression",
                    new XElement(ns + "Value", $"=Fields!{s.FieldName}.Value"),
                    new XElement(ns + "Direction", direction));

                var existing = sortContainer.Elements()
                    .FirstOrDefault(se => se.Name.LocalName == "SortExpression"
                        && string.Equals(FieldNameOfSort(se), s.FieldName, StringComparison.OrdinalIgnoreCase));
                if (existing != null) existing.ReplaceWith(sortEl);
                else sortContainer.Add(sortEl);
            }

            // Empty container — drop it so the RDL stays clean.
            if (!sortContainer.Elements().Any())
                sortContainer.Remove();
        }

        /// <summary>
        /// Fallback for callers that don't supply TargetTablixName: apply
        /// sorts grouped by their per-sort TablixName. Empty groups are
        /// skipped (use the single-Tablix overload when you want to clear).
        /// </summary>
        private static void ApplySortsAll(
            XElement root,
            IList<QuickEditSort> sorts,
            RebuildResult result)
        {
            if (sorts.Count == 0) return;
            foreach (var group in sorts.GroupBy(s => s.TablixName, StringComparer.OrdinalIgnoreCase))
            {
                ApplySorts(root, group.ToList(), group.Key, result);
            }
        }

        private static string? FieldNameOfSort(XElement sortEl)
        {
            var value = sortEl.Elements().FirstOrDefault(e => e.Name.LocalName == "Value")?.Value;
            if (string.IsNullOrWhiteSpace(value)) return null;
            var m = FieldRefRx.Match(value);
            return m.Success ? m.Groups["name"].Value : null;
        }

        // Parses "1.5in" / "12pt" / "100px" into inches. Returns 0 when the
        // value cannot be parsed, in which case we leave the RDL alone
        // rather than risk corrupting the layout.
        private static double ParseInches(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return 0;
            var v = value.Trim();
            double factor = 1;
            if (v.EndsWith("in", StringComparison.OrdinalIgnoreCase)) v = v[..^2];
            else if (v.EndsWith("pt", StringComparison.OrdinalIgnoreCase)) { v = v[..^2]; factor = 1.0 / 72.0; }
            else if (v.EndsWith("px", StringComparison.OrdinalIgnoreCase)) { v = v[..^2]; factor = 1.0 / 96.0; }
            else if (v.EndsWith("cm", StringComparison.OrdinalIgnoreCase)) { v = v[..^2]; factor = 1.0 / 2.54; }
            else if (v.EndsWith("mm", StringComparison.OrdinalIgnoreCase)) { v = v[..^2]; factor = 1.0 / 25.4; }
            return double.TryParse(v, System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture, out var inches)
                ? inches * factor
                : 0;
        }

        private static string FormatInches(double inches) =>
            inches.ToString("0.####", System.Globalization.CultureInfo.InvariantCulture) + "in";

        // RDL Name attributes must be valid identifiers. Mirrors
        // RdlGenerator.SanitizeName so generated reports and Quick Edit
        // additions produce identical naming.
        private static string SanitizeIdentifier(string? name, string fallback = "QuickEditColumn")
        {
            if (string.IsNullOrWhiteSpace(name)) return fallback;
            var sb = new System.Text.StringBuilder();
            foreach (var ch in name)
            {
                if (char.IsLetterOrDigit(ch) || ch == '_') sb.Append(ch);
                else sb.Append('_');
            }
            if (sb.Length == 0) return fallback;
            if (char.IsDigit(sb[0])) sb.Insert(0, '_');
            return sb.ToString();
        }

        private static string Humanize(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return name;
            var withSpaces = name.Replace('_', ' ').Replace('-', ' ');
            var parts = withSpaces.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            return string.Join(" ", parts.Select(p =>
                p.Length == 0 ? p : char.ToUpperInvariant(p[0]) + p.Substring(1)));
        }

        private static XElement? LocalChild(XElement? parent, string localName)
        {
            if (parent == null) return null;
            foreach (var c in parent.Elements())
                if (c.Name.LocalName == localName) return c;
            return null;
        }

        private static List<XElement> LocalChildren(XElement? parent, string localName)
        {
            var list = new List<XElement>();
            if (parent == null) return list;
            foreach (var c in parent.Elements())
                if (c.Name.LocalName == localName) list.Add(c);
            return list;
        }

        // The cells of a row, in document order. A row is
        // TablixRow > TablixCells > TablixCell.
        private static List<XElement> RowCells(XElement row)
        {
            var cellsContainer = LocalChild(row, "TablixCells");
            return LocalChildren(cellsContainer, "TablixCell");
        }

        private static bool CellReferencesField(XElement cell, string fieldName)
        {
            // Concatenate all text descendants and regex-scan.
            var sb = new System.Text.StringBuilder();
            foreach (var t in cell.DescendantNodesAndSelf())
                if (t is XText txt) sb.Append(txt.Value);
            foreach (Match m in FieldRefRx.Matches(sb.ToString()))
                if (string.Equals(m.Groups["name"].Value, fieldName, StringComparison.OrdinalIgnoreCase))
                    return true;
            return false;
        }

        // ---------------------------------------------------------------- item removal
        // (Removed in Phase 1 cleanup — column toggles only.)
    }
}
