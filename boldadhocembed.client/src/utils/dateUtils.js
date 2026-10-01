/**
 * Formats a date into a localized datetime-local input string (YYYY-MM-DDTHH:mm).
 * @param {Date|string} date
 * @returns {string}
 */
export function toLocalInputValue(date = new Date()) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

/**
 * Formats a date string into readable short format.
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
