/**
 * Pagination utility functions
 */

/**
 * Generate page numbers for pagination
 * Creates a sliding window of page numbers centered on the current page
 * @param currentPage The current page number
 * @param totalPages The total number of pages
 * @returns Array of page numbers to display
 */
export function generatePageNumbers(
  currentPage: number,
  totalPages: number
): number[] {
  const pages: number[] = [];
  const maxVisible = 5;

  if (totalPages <= maxVisible) {
    // If total pages fit in the window, show all pages
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  // Calculate start and end of the sliding window
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  const endPage = Math.min(totalPages, startPage + maxVisible - 1);

  // Adjust if we're near the end
  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return pages;
}
