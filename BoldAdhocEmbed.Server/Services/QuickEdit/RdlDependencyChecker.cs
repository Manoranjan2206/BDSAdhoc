using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace BoldAdhocEmbed.Server.Services.QuickEdit
{
    /// <summary>
    /// Scans an RDL for references to a removed field. Anything that
    /// still mentions Fields!X.Value after removal will break at
    /// render time, so we surface those references up front.
    ///
    /// Heuristic only. We walk every text node in PageHeader,
    /// PageFooter and Body and match Fields!X.Value references.
    /// Custom code modules (RDL embedded assemblies) and Lookup /
    /// LookupSet calls are not covered.
    ///
    /// Namespace-tolerant: matches by LocalName.
    /// </summary>
    public interface IRdlDependencyChecker
    {
        IReadOnlyList<FieldReference> FindReferencesTo(string rdlXml, string fieldName);
    }

    public record FieldReference(string Container, string Context, string ElementPath);

    public class RdlDependencyChecker : IRdlDependencyChecker
    {
        private static readonly Regex FieldRefRx =
            new(@"Fields!\s*(?<name>[A-Za-z_][A-Za-z0-9_]*)",
                RegexOptions.IgnoreCase | RegexOptions.Compiled);

        public IReadOnlyList<FieldReference> FindReferencesTo(string rdlXml, string fieldName)
        {
            if (string.IsNullOrWhiteSpace(rdlXml) || string.IsNullOrWhiteSpace(fieldName))
                return Array.Empty<FieldReference>();

            XDocument doc;
            try { doc = XDocument.Parse(rdlXml); }
            catch { return Array.Empty<FieldReference>(); }

            var root = doc.Root;
            if (root == null) return Array.Empty<FieldReference>();

            var refs = new List<FieldReference>();
            string[] containers = { "PageHeader", "PageFooter", "Body" };

            foreach (var container in containers)
            {
                var parent = root.Elements().FirstOrDefault(e => e.Name.LocalName == container);
                if (parent == null) continue;

                // Skip Tablix descendants — any Fields!X.Value inside a
                // Tablix cell is one the rebuilder is about to remove
                // when the user unchecks that column. Flagging it as a
                // blocker would refuse every column removal.
                foreach (var elem in parent.DescendantsAndSelf())
                {
                    if (IsInsideTablix(elem)) continue;

                    var sb = new StringBuilder();
                    foreach (var t in elem.DescendantNodesAndSelf())
                        if (t is XText txt) sb.Append(txt.Value);
                    var text = sb.ToString();
                    if (string.IsNullOrEmpty(text)) continue;

                    foreach (Match m in FieldRefRx.Matches(text))
                    {
                        if (string.Equals(m.Groups["name"].Value, fieldName, StringComparison.OrdinalIgnoreCase))
                        {
                            refs.Add(new FieldReference(
                                container,
                                Truncate(text, 80),
                                string.IsNullOrEmpty(elem.Name.NamespaceName) ? elem.Name.LocalName : elem.Name.ToString()));
                            break;
                        }
                    }
                }
            }
            return refs;
        }

        private static bool IsInsideTablix(XElement elem)
        {
            for (var p = elem.Parent; p != null; p = p.Parent)
                if (p.Name.LocalName == "Tablix") return true;
            return false;
        }

        private static string Truncate(string s, int n) => s.Length <= n ? s : s.Substring(0, n) + "…";
    }
}
