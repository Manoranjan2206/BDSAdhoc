using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;
using BoldAdhocEmbed.Server.Models;

namespace BoldAdhocEmbed.Server.Services.QuickEdit
{
    /// <summary>
    /// Parses a Bold Reports RDL into the small JSON model the Quick
    /// Edit dialog needs: Tablix column selections and the fields each
    /// Tablix actually references.
    ///
    /// Namespace-tolerant: RDL files in the wild carry non-standard
    /// prefix bindings (rd:, rs:, rdl2008:, etc.). All lookups match
    /// by LocalName, not qualified name, so we never silently miss a
    /// node because of a namespace difference.
    ///
    /// RDL is typically downloaded inside a zip. We unwrap, locate the
    /// first .rdl file, and parse with XDocument.
    /// </summary>
    public interface IRdlParser
    {
        /// <summary>
        /// Returns the RDL XML as a UTF-8 string from a downloaded
        /// zip (or raw XML). Throws <see cref="InvalidDataException"/>
        /// if no .rdl can be found.
        /// </summary>
        string ExtractRdlXml(byte[] downloadArtifact);

        /// <summary>Build the dialog model from RDL XML.</summary>
        QuickEditLoadResponse BuildLoadModel(string rdlXml, string sourceReportId, string sourceReportName, string sessionId);

        /// <summary>
        /// Builds the dialog model and additionally attaches the FULL
        /// dataset column catalog (<paramref name="availableFields"/>,
        /// sourced from the shared dataset .rsd) as
        /// <see cref="QuickEditLoadResponse.AvailableDatasetFields"/>.
        /// </summary>
        QuickEditLoadResponse BuildLoadModel(
            string rdlXml,
            string sourceReportId,
            string sourceReportName,
            string sessionId,
            IReadOnlyList<QuickEditField>? availableFields);
    }

    public class RdlParser : IRdlParser
    {
        // Allowed report-element namespaces. We don't pin to these
        // because matching is by LocalName; we just sanity-check that
        // the root element is named "Report" before proceeding.
        private static readonly Regex FieldRefRx =
            new(@"Fields\s*!\s*(?<name>[A-Za-z_][A-Za-z0-9_]*)",
                RegexOptions.IgnoreCase | RegexOptions.Compiled);

        public string ExtractRdlXml(byte[] downloadArtifact)
        {
            if (downloadArtifact == null || downloadArtifact.Length == 0)
                throw new InvalidDataException("Empty download artifact.");

            bool isZip = downloadArtifact.Length >= 4
                && downloadArtifact[0] == 0x50 && downloadArtifact[1] == 0x4B
                && downloadArtifact[2] == 0x03 && downloadArtifact[3] == 0x04;

            if (!isZip)
            {
                // Bold Reports RDLs come back UTF-8 with a BOM (EF BB BF).
                // Encoding.UTF8.GetString does NOT strip the BOM, so the
                // returned string starts with U+FEFF, which makes
                // XDocument.Parse throw "Data at the root level is invalid.
                // Line 1, position 1." Trim the BOM if present.
                var raw = Encoding.UTF8.GetString(downloadArtifact);
                return raw.Length > 0 && raw[0] == '\uFEFF' ? raw.Substring(1) : raw;
            }

            using var ms = new MemoryStream(downloadArtifact);
            using var archive = new ZipArchive(ms, ZipArchiveMode.Read, leaveOpen: false);
            var rdlEntry = archive.Entries.FirstOrDefault(e =>
                e.FullName.EndsWith(".rdl", StringComparison.OrdinalIgnoreCase));
            if (rdlEntry == null)
                throw new InvalidDataException("Downloaded archive does not contain a .rdl file.");

            using var s = rdlEntry.Open();
            using var sr = new StreamReader(s, Encoding.UTF8);
            return sr.ReadToEnd();
        }

        public QuickEditLoadResponse BuildLoadModel(string rdlXml, string sourceReportId, string sourceReportName, string sessionId)
        {
            return BuildLoadModel(rdlXml, sourceReportId, sourceReportName, sessionId, availableFields: null);
        }

        public QuickEditLoadResponse BuildLoadModel(
            string rdlXml,
            string sourceReportId,
            string sourceReportName,
            string sessionId,
            IReadOnlyList<QuickEditField>? availableFields)
        {
            if (string.IsNullOrWhiteSpace(rdlXml))
                throw new InvalidDataException("RDL XML is empty.");

            XDocument doc;
            try
            {
                doc = XDocument.Parse(rdlXml, LoadOptions.PreserveWhitespace | LoadOptions.SetLineInfo);
            }
            catch (XmlException ex)
            {
                throw new InvalidDataException($"RDL parse failed: {ex.Message}", ex);
            }

            var root = doc.Root ?? throw new InvalidDataException("RDL has no root element.");
            if (root.Name.LocalName != "Report")
            {
                throw new InvalidDataException($"Unexpected root element '{root.Name.LocalName}' — expected 'Report'.");
            }

            var resp = new QuickEditLoadResponse
            {
                SessionId = sessionId,
                SourceReportId = sourceReportId,
                SourceReportName = sourceReportName,
            };

            // ---- Dataset header (name + id only — fields come from Tablixes) ----
            var dataset = ResolveDatasets(root);
            resp.DatasetName = dataset.CurrentDatasetName ?? string.Empty;
            resp.DatasetId = dataset.CurrentDatasetId;

            // ---- Tablix columns ----
            resp.Tablixes = ExtractTablixes(root, dataset.CurrentDatasetName);

            // ---- "Report columns" — every unique field name referenced
            //      anywhere inside a Tablix (body-cell expressions only —
            //      row-group identifiers like "Details" are not dataset
            //      columns). This is what the user actually sees rendered
            //      in the report, so it's what the Quick Edit dialog
            //      pre-checks.
            resp.DatasetFields = ExtractTablixFields(root);

            // ---- Full dataset column catalog. Preferred order:
            //      1. Caller-supplied .rsd catalog (shared datasets),
            //      2. <DataSet>/<Fields> definitions in the RDL itself
            //         (inline datasets — carries rd:TypeName),
            //      3. <QueryDesignerState>/<Tables>/<Table>/<Columns>
            //         source-query catalog (every column the underlying
            //         SQL/proc exposes, with IsSelected flag).
            //      Merged with the Tablix-derived names so a field that is
            //      rendered but missing from the catalog (legacy inlined
            //      dataset) still shows up in the dialog.
            var rdlCatalog = ExtractDataSetFieldCatalog(root);
            var sourceColumns = ExtractQueryDesignerColumns(root);
            var mergedCatalog = MergeAvailableFields(
                MergeAvailableFields(availableFields, rdlCatalog),
                sourceColumns);
            resp.AvailableDatasetFields = MergeAvailableFields(mergedCatalog, resp.DatasetFields);

            // ---- Hard-incompatibility reasons ----
            if (resp.Tablixes.Count == 0)
            {
                resp.LockedReasons.Add("Report contains no Tablix regions — Quick Edit requires at least one Tablix.");
            }
            if (resp.DatasetFields.Count == 0)
            {
                resp.LockedReasons.Add("Report does not reference any dataset fields inside its Tablix regions.");
            }

            return resp;
        }

        // ---------------------------------------------------------------- helpers

        /// <summary>
        /// Merges the dataset catalog (.rsd) columns with the fields the
        /// Tablixes reference, preserving catalog order and appending any
        /// Tablix-only field that the catalog doesn't know about.
        /// Deduped case-insensitively — RDL field names are
        /// case-insensitive, so "Invoice_Number" and "invoice_number" are
        /// the same column.
        /// </summary>
        private static List<QuickEditField> MergeAvailableFields(
            IReadOnlyList<QuickEditField>? catalog,
            List<QuickEditField> tablixFields)
        {
            var result = new List<QuickEditField>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var f in catalog ?? Array.Empty<QuickEditField>())
            {
                if (string.IsNullOrWhiteSpace(f?.Name)) continue;
                if (!seen.Add(f.Name.Trim())) continue;
                result.Add(new QuickEditField { Name = f.Name.Trim(), Type = f.Type });
            }

            foreach (var f in tablixFields)
            {
                if (string.IsNullOrWhiteSpace(f?.Name)) continue;
                if (!seen.Add(f.Name.Trim())) continue;
                result.Add(new QuickEditField { Name = f.Name.Trim(), Type = f.Type });
            }

            return result;
        }

        /// <summary>
        /// Parses the &lt;DataSet&gt;/&lt;Fields&gt; block from each DataSet in
        /// the RDL. Each &lt;Field Name="X"&gt;&lt;DataField&gt;X&lt;/DataField&gt;
        /// &lt;rd:TypeName&gt;...&lt;/rd:TypeName&gt;&lt;/Field&gt; becomes a
        /// <see cref="QuickEditField"/> with the field's type metadata.
        ///
        /// For inline (non-shared) datasets, this is the most accurate
        /// catalog — it has type info and matches the Tablix's renderable
        /// fields. For shared-dataset reports it's usually empty because
        /// the RDL only carries a &lt;SharedDataSetReference&gt;.
        /// </summary>
        private static List<QuickEditField> ExtractDataSetFieldCatalog(XElement root)
        {
            var result = new List<QuickEditField>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            // <DataSet> is usually a direct child of <Report>, but some RDLs
            // wrap it (e.g. inside a parent namespace tag). Descendants()
            // handles both cases.
            foreach (var ds in root.Descendants().Where(e => e.Name.LocalName == "DataSet"))
            {
                var fieldsContainer = Child(ds, "Fields");
                if (fieldsContainer == null) continue;

                foreach (var f in fieldsContainer.Elements().Where(e => e.Name.LocalName == "Field"))
                {
                    var name = Attr(f, "Name");
                    if (string.IsNullOrWhiteSpace(name)) continue;
                    if (!seen.Add(name)) continue;
                    var typeName = ChildValue(f, "TypeName");
                    result.Add(new QuickEditField { Name = name.Trim(), Type = string.IsNullOrWhiteSpace(typeName) ? null : typeName.Trim() });
                }
            }

            return result;
        }

        /// <summary>
        /// Parses the &lt;Query&gt;/&lt;QueryDesignerState&gt;/&lt;Tables&gt;/
        /// &lt;Table&gt;/&lt;Columns&gt; catalog embedded in the RDL by the
        /// Bold Reports query designer. Every source-query column from the
        /// underlying table is listed here, with an IsSelected flag.
        ///
        /// For an inline dataset this is the FULL source-query catalog —
        /// e.g. the 25 columns of Production.Product, of which only 13
        /// are mapped to RDL fields and only 4 are rendered in the Tablix.
        /// The Quick Edit dialog needs this catalog so the user can pick
        /// from every available column, not just the ones the Tablix
        /// currently renders.
        ///
        /// Type information is not present in this catalog — it's metadata
        /// about the underlying SQL query, not the RDL fields. Type names
        /// come from <see cref="ExtractDataSetFieldCatalog"/> via the merge.
        /// </summary>
        private static List<QuickEditField> ExtractQueryDesignerColumns(XElement root)
        {
            var result = new List<QuickEditField>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            // The catalog can live on any DataSet; collect across all.
            // Use Descendants() so we pick up DataSets that aren't direct
            // children of <Report> (some RDLs wrap them).
            foreach (var ds in root.Descendants().Where(e => e.Name.LocalName == "DataSet"))
            {
                var query = Child(ds, "Query");
                if (query == null) continue;

                var state = Child(query, "QueryDesignerState");
                if (state == null) continue;

                var tables = Child(state, "Tables");
                if (tables == null) continue;

                foreach (var tbl in tables.Elements().Where(e => e.Name.LocalName == "Table"))
                {
                    var cols = Child(tbl, "Columns");
                    if (cols == null) continue;

                    foreach (var col in cols.Elements().Where(e => e.Name.LocalName == "Column"))
                    {
                        var name = Attr(col, "Name");
                        if (string.IsNullOrWhiteSpace(name)) continue;
                        if (!seen.Add(name)) continue;
                        result.Add(new QuickEditField { Name = name.Trim() });
                    }
                }
            }

            return result;
        }

        private readonly record struct DatasetInfo(string? CurrentDatasetName, string? CurrentDatasetId);

        private static DatasetInfo ResolveDatasets(XElement root)
        {
            string? currentName = null;
            string? currentId = null;

            var inline = Children(root, "DataSet").ToList();
            if (inline.Count > 0)
            {
                var ds = inline[0];
                currentName = Attr(ds, "Name");
                var query = Child(ds, "Query");
                var dsr = Child(query, "DataSourceReference");
                if (dsr != null) currentId = ChildValue(dsr, "DataSourceReference");
            }
            else
            {
                // Shared dataset reference: <DataSetReference><SharedDataSetReference>...
                var shared = root.Descendants()
                    .FirstOrDefault(e => e.Name.LocalName == "SharedDataSetReference");
                if (shared != null)
                {
                    currentName = Attr(shared.Parent?.Parent, "Name");
                    currentId = shared.Value;
                }
            }

            return new DatasetInfo(currentName, currentId);
        }

        private static List<QuickEditTablix> ExtractTablixes(XElement root, string? datasetName)
        {
            var result = new List<QuickEditTablix>();
            foreach (var t in root.Descendants().Where(e => e.Name.LocalName == "Tablix"))
            {
                var name = Attr(t, "Name") ?? "(unnamed)";
                var cols = new List<string>();
                var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                // Body cell expressions — every dataset field the Tablix
                // renders inside its <TablixCell> bodies via
                // `=Fields!X.Value` etc. This is what the user actually sees
                // in the report's data rows, and is the only source of
                // truth for which dataset columns belong on a Tablix.
                //
                // Row-group TablixMember.Group names are deliberately NOT
                // used here: the Quick Edit dialog renders the full
                // dataset catalog (so the user can pick any column, not
                // just those the source already uses), and row-group names
                // like "Details" are NOT dataset columns — they're RDL
                // group identifiers that don't correspond to a selectable
                // field. Including them was confusing and produced rows
                // like "Details" that couldn't be added or removed
                // meaningfully.
                //
                // Auto-generated row-group names that leak into a body
                // cell via `=Fields!Details.Value` are also filtered here
                // so the per-Tablix pre-check list stays clean.
                var bodyCells = t.Descendants().Where(e => e.Name.LocalName == "TablixCell").ToList();
                foreach (var cell in bodyCells)
                {
                    foreach (var r in ExtractFieldRefs(cell))
                    {
                        if (IsAutoGeneratedRowGroupName(r)) continue;
                        if (seen.Add(r)) cols.Add(r);
                    }
                }

                result.Add(new QuickEditTablix
                {
                    Name = name,
                    DatasetName = datasetName ?? string.Empty,
                    SelectedColumns = cols,
                    Filters = ExtractFilters(t),
                    Sorts = ExtractSorts(t),
                });
            }
            return result;
        }

        /// <summary>
        /// Parses a Tablix's &lt;Filters&gt; block so the UI can pre-populate
        /// filter rows from the source report. Only filter entries that
        /// reference a dataset field via Fields!X are kept — any other
        /// expression form (Parameters, etc.) is skipped because Quick
        /// Edit only round-trips field-based filters.
        /// </summary>
        private static List<QuickEditFilter> ExtractFilters(XElement tablix)
        {
            var result = new List<QuickEditFilter>();
            var container = Child(tablix, "Filters");
            if (container == null) return result;

            foreach (var f in container.Elements().Where(e => e.Name.LocalName == "Filter"))
            {
                var expr = ChildValue(f, "FilterExpression");
                var fieldName = ExtractFieldNameFromExpression(expr);
                if (string.IsNullOrWhiteSpace(fieldName)) continue;

                var op = ChildValue(f, "Operator") ?? "Equal";
                var valuesContainer = Child(f, "FilterValues");
                var values = valuesContainer == null
                    ? new List<string>()
                    : valuesContainer.Elements()
                        .Where(e => e.Name.LocalName == "FilterValue")
                        .Select(e => StripExpression(e.Attribute("DataType") == null ? e.Value : e.Value))
                        .Where(v => !string.IsNullOrWhiteSpace(v))
                        .Select(v => v!.Trim())
                        .ToList();

                // Best-effort multi-value inference: if the operator is "In",
                // the source had multiple FilterValue children OR a
                // FilterValue expression referencing a MultiValue parameter.
                var multi = values.Count > 1
                    || string.Equals(op, "In", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(op, "NotIn", StringComparison.OrdinalIgnoreCase);

                var firstValue = values.FirstOrDefault() ?? "";
                var dataType = InferDataType(firstValue);

                // Parameter name is derived from the FilterValues reference
                // when present, otherwise synthesised.
                string? paramName = null;
                if (valuesContainer != null)
                {
                    var firstFv = valuesContainer.Elements()
                        .FirstOrDefault(e => e.Name.LocalName == "FilterValue");
                    if (firstFv != null)
                    {
                        paramName = ExtractParameterNameFromExpression(firstFv.Value);
                    }
                }
                paramName ??= $"QuickEdit_{SanitizeIdentifier(fieldName)}_Filter";

                result.Add(new QuickEditFilter
                {
                    FieldName = fieldName,
                    Operator = op,
                    DataType = dataType,
                    MultiValue = multi,
                    PromptLabel = fieldName,
                    ParameterName = paramName,
                    DefaultValues = multi ? values : (values.Count > 0 ? new List<string> { values[0] } : new List<string>()),
                });
            }

            return result;
        }

        /// <summary>
        /// Parses a Tablix's &lt;SortExpressions&gt; block. Only expressions
        /// that reference a single dataset field via Fields!X.Value are
        /// kept.
        /// </summary>
        private static List<QuickEditSort> ExtractSorts(XElement tablix)
        {
            var result = new List<QuickEditSort>();
            var container = Child(tablix, "SortExpressions");
            if (container == null) return result;

            foreach (var s in container.Elements().Where(e => e.Name.LocalName == "SortExpression"))
            {
                var value = ChildValue(s, "Value");
                var fieldName = ExtractFieldNameFromExpression(value);
                if (string.IsNullOrWhiteSpace(fieldName)) continue;
                var direction = ChildValue(s, "Direction") ?? "Ascending";
                result.Add(new QuickEditSort
                {
                    FieldName = fieldName,
                    Direction = direction,
                });
            }

            return result;
        }

        private static string? ExtractFieldNameFromExpression(string? expr)
        {
            if (string.IsNullOrWhiteSpace(expr)) return null;
            var m = FieldRefRx.Match(expr);
            return m.Success ? m.Groups["name"].Value : null;
        }

        private static string? ExtractParameterNameFromExpression(string? expr)
        {
            if (string.IsNullOrWhiteSpace(expr)) return null;
            var m = System.Text.RegularExpressions.Regex.Match(
                expr,
                @"Parameters\s*!\s*(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*\.\s*Value",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            return m.Success ? m.Groups["name"].Value : null;
        }

        private static string InferDataType(string rawValue)
        {
            var v = rawValue?.Trim() ?? "";
            if (string.IsNullOrEmpty(v)) return "String";
            // Strip surrounding quotes the designer often adds for string literals.
            if (v.StartsWith("\"") && v.EndsWith("\"")) return "String";
            if (long.TryParse(v, out _)) return "Integer";
            if (decimal.TryParse(v, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out _)) return "Decimal";
            if (DateTime.TryParse(v, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out _)) return "DateTime";
            if (bool.TryParse(v, out _)) return "Boolean";
            return "String";
        }

        private static string SanitizeIdentifier(string? name, string fallback = "QuickEditFilter")
        {
            if (string.IsNullOrWhiteSpace(name)) return fallback;
            var sb = new System.Text.StringBuilder(name.Length);
            foreach (var ch in name)
            {
                sb.Append(char.IsLetterOrDigit(ch) || ch == '_' ? ch : '_');
            }
            var s = sb.ToString().Trim('_');
            if (string.IsNullOrEmpty(s)) s = fallback;
            if (char.IsDigit(s[0])) s = "_" + s;
            return s;
        }

        private static string StripExpression(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return "";
            var v = raw.Trim();
            // "=Parameters!X.Value" -> "X"; "=Fields!X.Value" -> "X"; "<X>" -> "X"
            if (v.StartsWith("=")) v = v.Substring(1).Trim();
            var pm = ExtractParameterNameFromExpression(v);
            if (pm != null) return pm;
            var fm = ExtractFieldNameFromExpression(v);
            if (fm != null) return fm;
            return v;
        }

        /// <summary>
        /// Walks every Tablix in the report and collects every distinct
        /// dataset field name referenced from its body cell expressions
        /// (=Fields!X.Value). Deduped case-insensitively.
        ///
        /// Row-group identifiers (e.g. the auto-generated "Details" name
        /// Bold Reports inserts into every flat Tablix's
        /// &lt;TablixRowHierarchy&gt; / &lt;TablixMember&gt; / &lt;Group&gt;)
        /// are explicitly NOT collected here — they're synthetic RDL
        /// labels, not dataset columns, and a column called "Details"
        /// that the user can't toggle meaningfully was showing up in
        /// the catalog.
        /// </summary>
        private static List<QuickEditField> ExtractTablixFields(XElement root)
        {
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var result = new List<QuickEditField>();

            foreach (var t in root.Descendants().Where(e => e.Name.LocalName == "Tablix"))
            {
                var bodyCells = t.Descendants().Where(e => e.Name.LocalName == "TablixCell").ToList();
                foreach (var cell in bodyCells)
                {
                    foreach (var r in ExtractFieldRefs(cell))
                    {
                        if (IsAutoGeneratedRowGroupName(r)) continue;
                        if (seen.Add(r))
                            result.Add(new QuickEditField { Name = r });
                    }
                }
            }

            return result;
        }

        /// <summary>
        /// Bold Reports inserts a synthetic &lt;Group Name="Details" /&gt; into
        /// every flat Tablix's row hierarchy (no explicit row groups) so the
        /// body row can repeat. That name is NOT a dataset column, but it
        /// can leak into the body-cell extraction via a stray
        /// `=Fields!Details.Value` reference and end up on the catalog.
        ///
        /// Filter the well-known auto-generated names here so the dialog
        /// never offers them as toggleable columns. Real dataset fields
        /// that happen to share a name with one of these are still safe —
        /// the catalog merge de-dupes case-insensitively, so the typed
        /// &lt;DataSet&gt;/&lt;Fields&gt; entry wins.
        /// </summary>
        private static readonly HashSet<string> AutoGeneratedRowGroupNames =
            new(StringComparer.OrdinalIgnoreCase) { "Details" };

        private static bool IsAutoGeneratedRowGroupName(string fieldName)
        {
            return !string.IsNullOrEmpty(fieldName)
                && AutoGeneratedRowGroupNames.Contains(fieldName);
        }

        // ---- Local-name matchers (namespace-tolerant) ----

        private static IEnumerable<XElement> Children(XElement? parent, string localName)
        {
            if (parent == null) yield break;
            foreach (var c in parent.Elements())
                if (c.Name.LocalName == localName) yield return c;
        }

        private static XElement? Child(XElement? parent, string localName)
        {
            if (parent == null) return null;
            foreach (var c in parent.Elements())
                if (c.Name.LocalName == localName) return c;
            return null;
        }

        private static string? Attr(XElement? e, string name)
            => e?.Attribute(name)?.Value;

        private static string? ChildValue(XElement? e, string localName)
        {
            var c = Child(e, localName);
            return c?.Value;
        }

        private static List<string> ExtractFieldRefs(XElement node)
        {
            var refs = new List<string>();
            if (node == null) return refs;
            var sb = new StringBuilder();
            foreach (var t in node.DescendantNodesAndSelf())
                if (t is XText txt) sb.Append(txt.Value);
            var bag = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (Match m in FieldRefRx.Matches(sb.ToString()))
                if (m.Groups["name"].Success) bag.Add(m.Groups["name"].Value);
            return bag.ToList();
        }
    }
}
