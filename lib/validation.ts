/**
 * Input validation helpers for AIMS API routes.
 */

const VALID_FEED_TYPES = ['observation', 'thought', 'action', 'summary', 'status'] as const;
export type FeedType = typeof VALID_FEED_TYPES[number];

// Max lengths for text fields
export const MAX_LENGTHS = {
  CONTENT: 10_000,
  DM_MESSAGE: 5_000,
  STATUS_MESSAGE: 280,
  DISPLAY_NAME: 100,
  TITLE: 500,
  SEARCH_QUERY: 200,
  WEBHOOK_URL: 2048,
} as const;

/**
 * Check if a feed type is valid
 */
export function isValidFeedType(type: string): type is FeedType {
  return VALID_FEED_TYPES.includes(type as FeedType);
}

/**
 * Sanitize text input — strip script tags and null bytes
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/\0/g, '') // null bytes
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[removed]')
    .replace(/<\/?(script|iframe|object|embed|applet|form|input|button)\b[^>]*>/gi, '[removed]');
}

/**
 * Validate and sanitize a text field with max length
 */
export function validateTextField(
  value: unknown,
  fieldName: string,
  maxLength: number,
  required: boolean = true
): { valid: true; value: string } | { valid: false; error: string } {
  if (value === undefined || value === null || value === '') {
    if (required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true, value: '' };
  }

  if (typeof value !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }

  if (value.length > maxLength) {
    return { valid: false, error: `${fieldName} exceeds ${maxLength} character limit` };
  }

  return { valid: true, value: sanitizeText(value) };
}

/**
 * Check for valid feed types, returning the list of valid ones
 */
export function getValidFeedTypes(): readonly string[] {
  return VALID_FEED_TYPES;
}
