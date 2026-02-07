/**
 * Strip HTML tags from a string, preserving text content.
 * Converts <br>, <p>, and block-level closing tags to newlines.
 */
export function stripHtmlTags(html: string): string {
  if (!html) return '';

  return html
    // Convert <br> and </p> to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    // Strip all remaining HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse multiple newlines into at most two
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
