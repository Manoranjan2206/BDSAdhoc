using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security;
using System.Text;

namespace BoldAdhocEmbed.Server.Services.ReportBuilder
{
    /// <summary>
    /// A single field selected for the generated report.
    /// </summary>
    public class ReportField
    {
        public string Name { get; set; } = string.Empty;
        /// <summary>CLR type name, e.g. System.String, System.Decimal.</summary>
        public string TypeName { get; set; } = "System.String";
    }

    public interface IRdlGenerator
    {
        /// <summary>
        /// Builds a plain-tablix RDL (bold header row + detail row) that
        /// binds to a shared dataset. The result is accepted verbatim by
        /// the Bold Reports v1.0 /reports create endpoint and renders with
        /// data on the first request.
        /// </summary>
        string Generate(ReportGenerationRequest request);
    }

    public class ReportGenerationRequest
    {
        public string ReportName { get; set; } = string.Empty;
        /// <summary>Shared dataset GUID (Bold Reports item id).</summary>
        public string SharedDataSetId { get; set; } = string.Empty;
        /// <summary>Dataset name as it should appear inside the RDL.</summary>
        public string DataSetName { get; set; } = "DataSet1";
        /// <summary>The shared data source GUID the dataset lives under.</summary>
        public string DataSourceId { get; set; } = string.Empty;
        public List<ReportField> Fields { get; set; } = new();
        // Optional. Each filter becomes a Tablix <Filter> + matching
        // <ReportParameter>. Empty list = no filters.
        public List<ReportFilter> Filters { get; set; } = new();
        // Optional. Each entry becomes a <SortExpression> on the Tablix.
        public List<ReportSort> Sorts { get; set; } = new();
    }

    public class ReportFilter
    {
        public string FieldName { get; set; } = string.Empty;
        public string Operator { get; set; } = "Equal";
        public string DataType { get; set; } = "String";
        public bool MultiValue { get; set; } = false;
        public string? PromptLabel { get; set; }
        public string? ParameterName { get; set; }
        public List<string> DefaultValues { get; set; } = new();
    }

    public class ReportSort
    {
        public string FieldName { get; set; } = string.Empty;
        public string Direction { get; set; } = "Ascending";
    }

    /// <summary>
    /// Deterministic RDL builder. Produces the 2016/01 report-definition
    /// schema that Bold Reports' designer and rendering engine expect. The
    /// layout is intentionally minimal — a single Tablix with one header
    /// row and one detail row — so a brand-new report is valid and
    /// previewable immediately, and the user can refine it later in the
    /// full designer.
    /// </summary>
    public class RdlGenerator : IRdlGenerator
    {
        private const string Ns = "http://schemas.microsoft.com/sqlserver/reporting/2016/01/reportdefinition";
        private const string RdNs = "http://schemas.microsoft.com/SQLServer/reporting/reportdesigner";

        // Each column is a fixed width; the body/page widths are derived
        // from the column count so wide selections still produce a valid,
        // non-overlapping layout.
        private const double ColumnWidthInches = 2.0;

        public string Generate(ReportGenerationRequest request)
        {
            if (request == null) throw new ArgumentNullException(nameof(request));
            if (string.IsNullOrWhiteSpace(request.SharedDataSetId))
                throw new ArgumentException("SharedDataSetId is required", nameof(request));
            if (request.Fields == null || request.Fields.Count == 0)
                throw new ArgumentException("At least one field is required", nameof(request));

            var fields = request.Fields
                .Where(f => !string.IsNullOrWhiteSpace(f.Name))
                .ToList();
            if (fields.Count == 0)
                throw new ArgumentException("At least one named field is required", nameof(request));

            var dataSetName = SanitizeName(request.DataSetName, "DataSet1");
            var n = fields.Count;
            var totalWidth = (ColumnWidthInches * n).ToString(CultureInfo.InvariantCulture);

            var sb = new StringBuilder();
            sb.AppendLine("<?xml version=\"1.0\" encoding=\"utf-8\"?>");
            sb.Append("<Report xmlns:rd=\"").Append(RdNs).Append("\" xmlns=\"").Append(Ns).AppendLine("\">");

            // --- DataSources ---------------------------------------------------
            sb.AppendLine("  <DataSources>");
            sb.AppendLine("    <DataSource Name=\"DataSource1\">");
            sb.AppendLine("      <rd:SecurityType>None</rd:SecurityType>");
            sb.Append("      <DataSourceReference>").Append(Esc(request.DataSourceId)).AppendLine("</DataSourceReference>");
            sb.AppendLine("    </DataSource>");
            sb.AppendLine("  </DataSources>");

            // --- DataSets ------------------------------------------------------
            sb.AppendLine("  <DataSets>");
            sb.Append("    <DataSet Name=\"").Append(Esc(dataSetName)).AppendLine("\">");
            sb.AppendLine("      <Fields>");
            foreach (var f in fields)
            {
                sb.Append("        <Field Name=\"").Append(Esc(f.Name)).AppendLine("\">");
                sb.Append("          <DataField>").Append(Esc(f.Name)).AppendLine("</DataField>");
                sb.Append("          <rd:TypeName>").Append(Esc(NormalizeTypeName(f.TypeName))).AppendLine("</rd:TypeName>");
                sb.AppendLine("        </Field>");
            }
            sb.AppendLine("      </Fields>");
            sb.AppendLine("      <Query>");
            sb.AppendLine("        <DataSourceName>DataSource1</DataSourceName>");
            sb.AppendLine("        <CommandText />");
            sb.AppendLine("      </Query>");
            sb.AppendLine("      <SharedDataSet>");
            sb.Append("        <SharedDataSetReference>").Append(Esc(request.SharedDataSetId)).AppendLine("</SharedDataSetReference>");
            sb.AppendLine("      </SharedDataSet>");
            sb.AppendLine("    </DataSet>");
            sb.AppendLine("  </DataSets>");

            // --- ReportParameters (only if filters were requested) ------
            // Each Quick Create filter creates a matching parameter so the
            // viewer prompts the user for the filter value at run time.
            // ValidValues pull from the shared dataset so Bold Reports
            // renders a dropdown of actual values.
            if (request.Filters != null && request.Filters.Count > 0)
            {
                sb.AppendLine("  <ReportParameters>");
                foreach (var f in request.Filters)
                {
                    if (string.IsNullOrWhiteSpace(f.FieldName)) continue;
                    var paramName = !string.IsNullOrWhiteSpace(f.ParameterName)
                        ? f.ParameterName
                        : $"QuickEdit_{SanitizeName(f.FieldName, "Param")}_Param";
                    var dataType = f.DataType ?? "String";
                    var prompt = !string.IsNullOrWhiteSpace(f.PromptLabel) ? f.PromptLabel : f.FieldName;
                    sb.Append("    <ReportParameter Name=\"").Append(Esc(paramName)).AppendLine("\">");
                    sb.Append("      <DataType>").Append(Esc(dataType)).AppendLine("</DataType>");
                    sb.Append("      <Prompt>").Append(Esc(prompt)).AppendLine("</Prompt>");
                    if (f.MultiValue)
                        sb.AppendLine("      <MultiValue>true</MultiValue>");
                    sb.AppendLine("      <ValidValues>");
                    sb.AppendLine("        <DataSetReference>");
                    sb.Append("          <DataSetName>").Append(Esc(dataSetName)).AppendLine("</DataSetName>");
                    sb.Append("          <ValueField>").Append(Esc(f.FieldName)).AppendLine("</ValueField>");
                    sb.Append("          <LabelField>").Append(Esc(f.FieldName)).AppendLine("</LabelField>");
                    sb.AppendLine("        </DataSetReference>");
                    sb.AppendLine("      </ValidValues>");
                    sb.AppendLine("    </ReportParameter>");
                }
                sb.AppendLine("  </ReportParameters>");

                // Layout — one row of up to 4 prompts.
                var paramNames = request.Filters
                    .Where(f => !string.IsNullOrWhiteSpace(f.FieldName))
                    .Select(f => !string.IsNullOrWhiteSpace(f.ParameterName)
                        ? f.ParameterName
                        : $"QuickEdit_{SanitizeName(f.FieldName, "Param")}_Param")
                    .ToList();
                sb.AppendLine("  <ReportParametersLayout>");
                sb.AppendLine("    <GridLayoutDefinition>");
                sb.Append("      <NumberOfColumns>").Append(Math.Min(4, Math.Max(1, paramNames.Count))).AppendLine("</NumberOfColumns>");
                sb.Append("      <NumberOfRows>").Append(Math.Max(1, (int)Math.Ceiling(paramNames.Count / 4.0))).AppendLine("</NumberOfRows>");
                sb.AppendLine("      <CellDefinitions>");
                for (int i = 0; i < paramNames.Count; i++)
                {
                    sb.AppendLine("        <CellDefinition>");
                    sb.Append("          <ColumnIndex>").Append(i % 4).AppendLine("</ColumnIndex>");
                    sb.Append("          <RowIndex>").Append(i / 4).AppendLine("</RowIndex>");
                    sb.Append("          <ParameterName>").Append(Esc(paramNames[i])).AppendLine("</ParameterName>");
                    sb.AppendLine("        </CellDefinition>");
                }
                sb.AppendLine("      </CellDefinitions>");
                sb.AppendLine("    </GridLayoutDefinition>");
                sb.AppendLine("  </ReportParametersLayout>");
            }

            // --- Body / Tablix -------------------------------------------------
            sb.AppendLine("  <ReportSections>");
            sb.AppendLine("    <ReportSection>");
            sb.AppendLine("      <Body>");
            sb.AppendLine("        <ReportItems>");
            sb.AppendLine("          <Tablix Name=\"Tablix1\">");

            // --- Tablix-level filters -------------------------------------
            // Emit each filter as <Filter> with a <FilterValue> that
            // references the matching <ReportParameter>. We emit filters
            // BEFORE <TablixBody> per the RDL schema.
            if (request.Filters != null && request.Filters.Count > 0)
            {
                sb.AppendLine("            <Filters>");
                foreach (var f in request.Filters)
                {
                    if (string.IsNullOrWhiteSpace(f.FieldName)) continue;
                    var paramName = !string.IsNullOrWhiteSpace(f.ParameterName)
                        ? f.ParameterName
                        : $"QuickEdit_{SanitizeName(f.FieldName, "Param")}_Param";
                    var op = SanitizeOperator(f.Operator);
                    sb.AppendLine("              <Filter>");
                    sb.Append("                <FilterExpression>=Fields!").Append(Esc(f.FieldName)).AppendLine(".Value</FilterExpression>");
                    sb.Append("                <Operator>").Append(Esc(op)).AppendLine("</Operator>");
                    sb.AppendLine("                <FilterValues>");
                    sb.Append("                  <FilterValue DataType=\"").Append(Esc(f.DataType ?? "String")).Append("\">=Parameters!")
                        .Append(Esc(paramName)).AppendLine(".Value</FilterValue>");
                    sb.AppendLine("                </FilterValues>");
                    sb.AppendLine("              </Filter>");
                }
                sb.AppendLine("            </Filters>");
            }

            // --- Tablix-level sort expressions -----------------------------
            if (request.Sorts != null && request.Sorts.Count > 0)
            {
                sb.AppendLine("            <SortExpressions>");
                foreach (var s in request.Sorts)
                {
                    if (string.IsNullOrWhiteSpace(s.FieldName)) continue;
                    var dir = string.Equals(s.Direction, "Descending", StringComparison.OrdinalIgnoreCase)
                        ? "Descending" : "Ascending";
                    sb.AppendLine("              <SortExpression>");
                    sb.Append("                <Value>=Fields!").Append(Esc(s.FieldName)).AppendLine(".Value</Value>");
                    sb.Append("                <Direction>").Append(Esc(dir)).AppendLine("</Direction>");
                    sb.AppendLine("              </SortExpression>");
                }
                sb.AppendLine("            </SortExpressions>");
            }

            sb.AppendLine("            <TablixBody>");

            // Column widths
            sb.AppendLine("              <TablixColumns>");
            for (var i = 0; i < n; i++)
            {
                sb.AppendLine("                <TablixColumn>");
                sb.Append("                  <Width>").Append(ColumnWidthInches.ToString(CultureInfo.InvariantCulture)).AppendLine("in</Width>");
                sb.AppendLine("                </TablixColumn>");
            }
            sb.AppendLine("              </TablixColumns>");

            sb.AppendLine("              <TablixRows>");
            // Header row
            sb.AppendLine("                <TablixRow>");
            sb.AppendLine("                  <Height>0.25in</Height>");
            sb.AppendLine("                  <TablixCells>");
            for (var i = 0; i < n; i++)
            {
                AppendCell(sb, $"hdr_{i}", Literal(Humanize(fields[i].Name)), bold: true, isHeader: true);
            }
            sb.AppendLine("                  </TablixCells>");
            sb.AppendLine("                </TablixRow>");

            // Detail row
            sb.AppendLine("                <TablixRow>");
            sb.AppendLine("                  <Height>0.25in</Height>");
            sb.AppendLine("                  <TablixCells>");
            for (var i = 0; i < n; i++)
            {
                // Textbox named after the field so CSV/Excel exports carry
                // meaningful column headers instead of generic data_N.
                AppendCell(sb, SanitizeName(fields[i].Name, $"data_{i}"),
                    $"=Fields!{Esc(fields[i].Name)}.Value", bold: false, isHeader: false);
            }
            sb.AppendLine("                  </TablixCells>");
            sb.AppendLine("                </TablixRow>");
            sb.AppendLine("              </TablixRows>");
            sb.AppendLine("            </TablixBody>");

            // Column hierarchy: one static member per column
            sb.AppendLine("            <TablixColumnHierarchy>");
            sb.AppendLine("              <TablixMembers>");
            for (var i = 0; i < n; i++)
            {
                sb.AppendLine("                <TablixMember />");
            }
            sb.AppendLine("              </TablixMembers>");
            sb.AppendLine("            </TablixColumnHierarchy>");

            // Row hierarchy: header (static) + detail group
            sb.AppendLine("            <TablixRowHierarchy>");
            sb.AppendLine("              <TablixMembers>");
            sb.AppendLine("                <TablixMember>");
            sb.AppendLine("                  <KeepWithGroup>After</KeepWithGroup>");
            sb.AppendLine("                </TablixMember>");
            sb.AppendLine("                <TablixMember>");
            sb.AppendLine("                  <Group Name=\"Details\" />");
            sb.AppendLine("                </TablixMember>");
            sb.AppendLine("              </TablixMembers>");
            sb.AppendLine("            </TablixRowHierarchy>");

            sb.Append("            <DataSetName>").Append(Esc(dataSetName)).AppendLine("</DataSetName>");
            sb.AppendLine("            <Top>0.5in</Top>");
            sb.AppendLine("            <Left>0.25in</Left>");
            sb.AppendLine("            <Height>0.5in</Height>");
            sb.Append("            <Width>").Append(totalWidth).AppendLine("in</Width>");
            sb.AppendLine("          </Tablix>");
            sb.AppendLine("        </ReportItems>");
            sb.AppendLine("        <Height>2in</Height>");
            sb.AppendLine("      </Body>");
            sb.Append("      <Width>").Append(totalWidth).AppendLine("in</Width>");
            sb.AppendLine("      <Page>");
            sb.AppendLine("        <PageHeight>11in</PageHeight>");
            sb.AppendLine("        <PageWidth>8.5in</PageWidth>");
            sb.AppendLine("        <Margins>");
            sb.AppendLine("          <Left>0.5in</Left>");
            sb.AppendLine("          <Right>0.5in</Right>");
            sb.AppendLine("          <Top>0.5in</Top>");
            sb.AppendLine("          <Bottom>0.5in</Bottom>");
            sb.AppendLine("        </Margins>");
            sb.AppendLine("      </Page>");
            sb.AppendLine("    </ReportSection>");
            sb.AppendLine("  </ReportSections>");
            sb.Append("</Report>");

            return sb.ToString();
        }

        private static void AppendCell(StringBuilder sb, string textboxName, string value, bool bold, bool isHeader)
        {
            sb.AppendLine("                    <TablixCell>");
            sb.AppendLine("                      <CellContents>");
            sb.Append("                        <Textbox Name=\"").Append(Esc(textboxName)).AppendLine("\">");
            sb.AppendLine("                          <CanGrow>true</CanGrow>");
            sb.AppendLine("                          <KeepTogether>true</KeepTogether>");
            sb.AppendLine("                          <Paragraphs>");
            sb.AppendLine("                            <Paragraph>");
            sb.AppendLine("                              <TextRuns>");
            sb.AppendLine("                                <TextRun>");
            sb.Append("                                  <Value>").Append(value).AppendLine("</Value>");
            if (bold)
            {
                sb.AppendLine("                                  <Style>");
                sb.AppendLine("                                    <FontWeight>Bold</FontWeight>");
                sb.AppendLine("                                  </Style>");
            }
            else
            {
                sb.AppendLine("                                  <Style />");
            }
            sb.AppendLine("                                </TextRun>");
            sb.AppendLine("                              </TextRuns>");
            sb.AppendLine("                              <Style />");
            sb.AppendLine("                            </Paragraph>");
            sb.AppendLine("                          </Paragraphs>");
            sb.Append("                          <rd:DefaultName>").Append(Esc(textboxName)).AppendLine("</rd:DefaultName>");
            sb.AppendLine("                          <Style>");
            sb.AppendLine("                            <Border>");
            sb.AppendLine("                              <Style>Solid</Style>");
            sb.AppendLine("                            </Border>");
            if (isHeader)
            {
                sb.AppendLine("                            <BackgroundColor>#f2f2f2</BackgroundColor>");
            }
            sb.AppendLine("                            <PaddingLeft>2pt</PaddingLeft>");
            sb.AppendLine("                            <PaddingRight>2pt</PaddingRight>");
            sb.AppendLine("                            <PaddingTop>2pt</PaddingTop>");
            sb.AppendLine("                            <PaddingBottom>2pt</PaddingBottom>");
            sb.AppendLine("                          </Style>");
            sb.AppendLine("                        </Textbox>");
            sb.AppendLine("                      </CellContents>");
            sb.AppendLine("                    </TablixCell>");
        }

        // A plain literal caption (not an expression). Prefixing with a
        // leading space would make Bold Reports treat it as an expression
        // when it starts with '='. Our humanized captions never do.
        private static string Literal(string text) => Esc(text);

        private static string NormalizeTypeName(string? typeName)
        {
            if (string.IsNullOrWhiteSpace(typeName)) return "System.String";
            var t = typeName.Trim();
            // Accept both full and short forms.
            return t.StartsWith("System.", StringComparison.OrdinalIgnoreCase)
                ? t
                : t.ToLowerInvariant() switch
                {
                    "string" => "System.String",
                    "int" or "int32" or "integer" => "System.Int32",
                    "long" or "int64" => "System.Int64",
                    "decimal" or "number" => "System.Decimal",
                    "double" or "float" => "System.Double",
                    "bool" or "boolean" => "System.Boolean",
                    "datetime" => "System.DateTime",
                    "date" or "dateonly" => "System.DateOnly",
                    _ => "System.String",
                };
        }

        // Converts a snake_case / camelCase field into a Title Case caption.
        private static string Humanize(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return name;
            var withSpaces = name.Replace('_', ' ').Replace('-', ' ');
            var parts = withSpaces.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            return string.Join(" ", parts.Select(p =>
                p.Length == 0 ? p : char.ToUpperInvariant(p[0]) + p.Substring(1)));
        }

        // RDL Name attributes must be valid identifiers (letters, digits,
        // underscore; not starting with a digit). Fall back to a safe
        // default when the field name can't be used verbatim.
        private static string SanitizeName(string? name, string fallback)
        {
            if (string.IsNullOrWhiteSpace(name)) return fallback;
            var sb = new StringBuilder();
            foreach (var ch in name)
            {
                if (char.IsLetterOrDigit(ch) || ch == '_') sb.Append(ch);
                else sb.Append('_');
            }
            if (sb.Length == 0) return fallback;
            if (char.IsDigit(sb[0])) sb.Insert(0, '_');
            return sb.ToString();
        }

        // Allowed Tablix <Filter>/<Operator> values per the RDL schema.
        // Anything else falls back to "Equal" so the RDL stays valid.
        private static readonly HashSet<string> AllowedOperators = new(StringComparer.OrdinalIgnoreCase)
        {
            "Equal", "NotEqual", "In", "NotIn", "Like", "NotLike",
            "GreaterThan", "GreaterThanOrEqual", "LessThan", "LessThanOrEqual", "Between", "TopN", "BottomN",
        };

        private static string SanitizeOperator(string? op)
        {
            if (string.IsNullOrWhiteSpace(op)) return "Equal";
            return AllowedOperators.Contains(op) ? op : "Equal";
        }

        private static string Esc(string? s) =>
            string.IsNullOrEmpty(s) ? string.Empty : SecurityElement.Escape(s);
    }
}
