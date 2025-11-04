/**
 * Format date value for display
 * @param {*} value - Value to check and format
 * @returns {string} Formatted value
 */
export function formatValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  // Check if value is an ISO date string
  if (typeof value === 'string' && isISODateString(value)) {
    return formatDate(value);
  }

  // Check if value is a Date object
  if (value instanceof Date) {
    return formatDate(value);
  }

  return value;
}

/**
 * Check if string is an ISO date string
 * @param {string} str - String to check
 * @returns {boolean}
 */
function isISODateString(str) {
  // Match ISO 8601 date format (YYYY-MM-DDTHH:mm:ss.sssZ or similar)
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  return isoDateRegex.test(str);
}

/**
 * Format date to readable format
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  const d = new Date(date);

  // Check if date is valid
  if (isNaN(d.getTime())) {
    return date;
  }

  // Format: YYYY-MM-DD HH:mm:ss
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
