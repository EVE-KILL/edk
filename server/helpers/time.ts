/**
 * Time utility functions
 */

/**
 * Convert a date to a human-readable "time ago" format
 * @param date The date to convert
 * @returns Human-readable string like "5 mins ago" or "2 days ago"
 */
export function timeAgo(date: Date): string {
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return `${seconds} sec ago`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`

  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`

  const years = Math.floor(days / 365)
  return `${years} year${years !== 1 ? 's' : ''} ago`
}
