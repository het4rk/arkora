/**
 * Input sanitization utilities for user-generated content.
 *
 * React escapes text in JSX and Drizzle uses parameterized queries,
 * so the main risks are: invisible/control characters used for spoofing,
 * excessive whitespace, and zero-width chars for impersonation.
 */

/** Strip control characters (C0/C1) except newline, tab, and carriage return. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g

/** Zero-width and invisible formatting characters used for spoofing/impersonation. */
const INVISIBLE_CHARS = /[\u200B-\u200F\u2028-\u202F\u2060-\u2069\uFEFF\uFFF9-\uFFFB]/g

/**
 * Sanitize a block of user text (post body, reply body, community note, bio).
 * - NFKC-normalizes unicode (prevents homoglyph tricks)
 * - Strips control characters (keeps \n \t \r)
 * - Strips invisible/zero-width characters
 * - Collapses runs of 3+ newlines to 2
 * - Trims leading/trailing whitespace
 */
export function sanitizeText(input: string): string {
  return input
    .normalize('NFKC')
    .replace(CONTROL_CHARS, '')
    .replace(INVISIBLE_CHARS, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Sanitize a single-line field (post title, pseudo handle).
 * Same as sanitizeText but also collapses all whitespace to single spaces.
 */
export function sanitizeLine(input: string): string {
  return input
    .normalize('NFKC')
    .replace(CONTROL_CHARS, '')
    .replace(INVISIBLE_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
}
