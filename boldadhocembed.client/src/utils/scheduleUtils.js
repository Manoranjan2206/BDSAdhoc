/**
 * Cleans tenant prefixes like 'AlphaCorp_' or 'BetaSolutions_' from schedule and report names.
 */
export function cleanScheduleName(name) {
  if (!name) return '';
  return String(name).replace(/^(AlphaCorp|BetaSolutions|GammaIndustries|DeltaEnterprises)_/i, '').trim();
}

/**
 * Strips metadata tags like [Tenant:...] or [Owner:...] from schedule descriptions.
 */
export function cleanScheduleDescription(desc) {
  if (!desc) return '';
  return String(desc)
    .replace(/\[Tenant:[^\]]*\]/gi, '')
    .replace(/\[Owner:[^\]]*\]/gi, '')
    .trim();
}

/**
 * Maps export format code or string to readable display label.
 */
export function mapExportType(value) {
  const nameMap = {
    Pdf: 'PDF',
    Word: 'Word',
    Excel: 'Excel',
    CSV: 'CSV',
    HTML: 'HTML',
    PPT: 'PPT',
    Image: 'Image',
    Xml: 'XML',
  };
  const codeMap = {
    '1': 'Excel',
    '2': 'HTML',
    '3': 'PDF',
    '4': 'Word',
    '5': 'Image',
    '6': 'PPT',
    '7': 'CSV',
    '8': 'XML',
  };
  if (value == null) return 'PDF';
  const key = String(value);
  return nameMap[key] || codeMap[key] || key;
}

/**
 * Normalizes export type format code into standard PascalCase key.
 */
export function exportCodeToKey(value) {
  if (value == null) return 'Pdf';
  const s = String(value).trim();
  const codeMap = {
    '1': 'Excel',
    '2': 'Html',
    '3': 'Pdf',
    '4': 'Word',
    '5': 'Image',
    '6': 'Ppt',
    '7': 'Csv',
    '8': 'Xml',
  };
  if (codeMap[s]) return codeMap[s];
  const lower = s.toLowerCase();
  if (lower === 'pdf') return 'Pdf';
  if (lower.includes('excel')) return 'Excel';
  if (lower.includes('word')) return 'Word';
  if (lower.includes('csv')) return 'Csv';
  if (lower.includes('html')) return 'Html';
  if (lower.includes('ppt')) return 'Ppt';
  if (lower.includes('image')) return 'Image';
  return s;
}
