import { NextRequest } from 'next/server';

/**
 * Create a NextRequest for testing API routes.
 */
export function createRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = 'GET', body, headers = {} } = options;
  const fullUrl = `http://localhost:3000${url}`;
  
  const reqHeaders = new Headers({
    'Content-Type': 'application/json',
    'x-forwarded-for': '127.0.0.1',
    ...headers,
  });

  return new NextRequest(fullUrl, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** Create a request with an exact raw body (needed for HMAC / Ed25519). */
export function createRawRequest(
  url: string,
  options: {
    method?: string;
    body: string;
    headers?: Record<string, string>;
  }
): NextRequest {
  const { method = 'POST', body, headers = {} } = options;
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: new Headers({
      'Content-Type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
      ...headers,
    }),
    body,
  });
}

/** Create a request with bot auth */
export function createAuthRequest(
  url: string,
  apiKey: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  return createRequest(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    },
  });
}

/** Create a request with admin auth */
export function createAdminRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  return createRequest(url, {
    ...options,
    headers: {
      Authorization: `Bearer test-admin-key-123`,
      ...options.headers,
    },
  });
}
