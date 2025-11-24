/**
 * Time utility functions
 */

/**
 * Convert a date string/object from database to UTC Date
 * PostgreSQL returns timestamps without timezone info, but they're stored as UTC
 * @param value The date value from database (string or Date)
 * @returns Date object representing UTC time
 */
export function parseUtcDate(value: unknown): Date {
  if (!value) return new Date();
  
  // If already a Date object, return as-is
  if (value instanceof Date) return value;
  
  const str = String(value);
  
  // If it already has timezone info (Z or +/-offset), parse normally
  if (/[+-]\d{2}:?\d{2}$/.test(str) || str.endsWith('Z')) {
    return new Date(str);
  }
  
  // PostgreSQL format: "2025-11-24 15:48:02" (no timezone = UTC)
  // Append Z to indicate UTC
  if (str.includes(' ')) {
    return new Date(str.replace(' ', 'T') + 'Z');
  }
  
  // ISO format without Z: "2025-11-24T15:48:02"
  if (str.includes('T') && !str.endsWith('Z')) {
    return new Date(str + 'Z');
  }
  
  // Fallback: parse as-is
  return new Date(str);
}

/**
 * Convert a date to a human-readable "time ago" format (UTC-safe)
 * @param date The date to convert (Date object or string from database)
 * @returns Human-readable string like "5 mins ago" or "2 days ago"
 */
export function timeAgo(date: Date | string | unknown): string {
  const parsedDate = parseUtcDate(date);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - parsedDate.getTime()) / 1000);

  if (seconds < 0) return 'just now';
  if (seconds < 60) return `${seconds} sec ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;

  const years = Math.floor(days / 365);
  return `${years} year${years !== 1 ? 's' : ''} ago`;
}
