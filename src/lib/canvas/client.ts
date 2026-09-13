/**
 * Canvas API HTTP Client
 *
 * Server-side only. Handles authentication, pagination, rate limiting,
 * retries, and error handling for the Canvas LMS REST API.
 *
 * The CANVAS_TOKEN is NEVER exposed to the browser — this module
 * should only be imported in server components, API routes, or server actions.
 */

import type { CanvasPaginationLinks, CanvasErrorResponse } from './types';

// ─── Error Classes ─────────────────────────────────────────────────────

export class CanvasApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public responseBody?: unknown,
  ) {
    super(message);
    this.name = 'CanvasApiError';
  }
}

export class CanvasAuthError extends CanvasApiError {
  constructor(message = 'Your Canvas token is invalid or expired.') {
    super(message, 401);
    this.name = 'CanvasAuthError';
  }
}

export class CanvasForbiddenError extends CanvasApiError {
  constructor(message = 'Canvas denied access to this resource.') {
    super(message, 403);
    this.name = 'CanvasForbiddenError';
  }
}

export class CanvasNotFoundError extends CanvasApiError {
  constructor(message = 'The requested Canvas resource was not found.') {
    super(message, 404);
    this.name = 'CanvasNotFoundError';
  }
}

export class CanvasRateLimitError extends CanvasApiError {
  constructor(
    public retryAfterMs: number,
    message = 'Canvas rate limit reached. Retrying shortly.',
  ) {
    super(message, 429);
    this.name = 'CanvasRateLimitError';
  }
}

// ─── Configuration ─────────────────────────────────────────────────────

function getConfig() {
  const baseUrl = process.env.CANVAS_BASE_URL || 'https://canvas.elte.hu';
  const token = process.env.CANVAS_TOKEN;
  const isProduction = process.env.NODE_ENV === 'production';
  // Mock mode is strictly forbidden in production
  const mockMode = !isProduction && process.env.CANVAS_MOCK_MODE === 'true';

  if (mockMode) {
    return { baseUrl: 'https://canvas.elte.hu', token: 'mock-token', mockMode: true };
  }

  if (!token) {
    throw new CanvasAuthError(
      'CANVAS_TOKEN is not configured. Configure your ELTE Canvas access token in production environment variables.',
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ''), token, mockMode: false };
}

// ─── Pagination Parser ────────────────────────────────────────────────

function parseLinkHeader(header: string | null): CanvasPaginationLinks {
  if (!header) return {};

  const links: CanvasPaginationLinks = {};
  const parts = header.split(',');

  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="(\w+)"/);
    if (match) {
      const [, url, rel] = match;
      if (rel === 'current' || rel === 'next' || rel === 'prev' || rel === 'first' || rel === 'last') {
        links[rel] = url;
      }
    }
  }

  return links;
}

// ─── Request Options ───────────────────────────────────────────────────

interface CanvasRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  params?: Record<string, string | string[] | number | boolean | undefined>;
  /** Timeout in milliseconds. Default: 30000 */
  timeout?: number;
  /** Max retries for transient errors. Default: 3 */
  maxRetries?: number;
}

interface CanvasResponse<T> {
  data: T;
  pagination: CanvasPaginationLinks;
  rateLimitRemaining?: number;
}

// ─── Core Client ───────────────────────────────────────────────────────

/**
 * Make a single request to the Canvas API.
 * Handles auth, errors, rate limiting, retries, and timeouts.
 */
export async function canvasRequest<T>(
  path: string,
  options: CanvasRequestOptions = {},
): Promise<CanvasResponse<T>> {
  const { baseUrl, token } = getConfig();
  const {
    method = 'GET',
    body,
    params,
    timeout = 30000,
    maxRetries = 3,
  } = options;

  // Build URL with query params
  const url = new URL(`/api/v1${path}`, baseUrl);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) {
          url.searchParams.append(key, v);
        }
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      };

      if (body) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Rate limit info
      const rateLimitRemaining = response.headers.get('X-Rate-Limit-Remaining')
        ? Number(response.headers.get('X-Rate-Limit-Remaining'))
        : undefined;

      // Handle errors
      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        let parsedError: CanvasErrorResponse | undefined;
        try {
          parsedError = JSON.parse(errorBody) as CanvasErrorResponse;
        } catch {
          // Not JSON — that's fine
        }

        switch (response.status) {
          case 401:
            throw new CanvasAuthError();
          case 403:
            throw new CanvasForbiddenError(
              parsedError?.message || 'Canvas denied access to this resource.',
            );
          case 404:
            throw new CanvasNotFoundError();
          case 429: {
            const retryAfter = response.headers.get('Retry-After');
            const retryMs = retryAfter
              ? parseInt(retryAfter, 10) * 1000
              : Math.min(1000 * Math.pow(2, attempt), 30000);

            if (attempt < maxRetries) {
              await sleep(retryMs);
              continue;
            }
            throw new CanvasRateLimitError(retryMs);
          }
          default:
            // Retry on 5xx
            if (response.status >= 500 && attempt < maxRetries) {
              await sleep(Math.min(1000 * Math.pow(2, attempt), 10000));
              continue;
            }
            throw new CanvasApiError(
              parsedError?.message ||
                `Canvas API error: ${response.status} ${response.statusText}`,
              response.status,
              parsedError,
            );
        }
      }

      // Parse response
      const data = (await response.json()) as T;
      const pagination = parseLinkHeader(response.headers.get('Link'));

      return { data, pagination, rateLimitRemaining };
    } catch (error) {
      if (error instanceof CanvasApiError) {
        // Don't retry auth/forbidden/not-found errors
        if (
          error instanceof CanvasAuthError ||
          error instanceof CanvasForbiddenError ||
          error instanceof CanvasNotFoundError
        ) {
          throw error;
        }
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        lastError = new Error(`Canvas API request timed out after ${timeout}ms`);
        if (attempt < maxRetries) {
          await sleep(1000 * Math.pow(2, attempt));
          continue;
        }
      }

      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt >= maxRetries) {
        throw lastError;
      }

      await sleep(1000 * Math.pow(2, attempt));
    }
  }

  throw lastError || new Error('Canvas API request failed after retries');
}

/**
 * Fetch all pages of a paginated Canvas API endpoint.
 * Follows the `next` link header until exhausted.
 */
export async function canvasPaginatedRequest<T>(
  path: string,
  options: CanvasRequestOptions = {},
): Promise<T[]> {
  const allData: T[] = [];
  const { baseUrl, token } = getConfig();

  // Ensure per_page is set for efficiency
  const params = { ...options.params, per_page: options.params?.per_page ?? '100' };

  let currentPath: string | null = path;
  let isFullUrl = false;

  while (currentPath) {
    let response: CanvasResponse<T[]>;

    if (isFullUrl) {
      // For pagination, Canvas returns full URLs. We need to call them directly.
      const fetchResponse = await fetch(currentPath, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!fetchResponse.ok) {
        // Let the main handler deal with errors
        const pathOnly = new URL(currentPath).pathname.replace('/api/v1', '');
        response = await canvasRequest<T[]>(pathOnly, { ...options, params });
        allData.push(...response.data);
        break;
      }

      const data = (await fetchResponse.json()) as T[];
      const pagination = parseLinkHeader(fetchResponse.headers.get('Link'));
      response = { data, pagination };
    } else {
      response = await canvasRequest<T[]>(currentPath, { ...options, params });
    }

    allData.push(...response.data);

    // Follow next page
    if (response.pagination.next) {
      currentPath = response.pagination.next;
      isFullUrl = true;
    } else {
      currentPath = null;
    }

    // Safety: rate limit awareness — slow down if remaining is low
    if (response.rateLimitRemaining !== undefined && response.rateLimitRemaining < 50) {
      await sleep(500);
    }
  }

  return allData;
}

/**
 * Test the Canvas API connection by fetching the current user.
 * Returns true if the connection is successful.
 */
export async function testCanvasConnection(): Promise<{
  connected: boolean;
  user?: { id: number; name: string };
  error?: string;
}> {
  try {
    const { data } = await canvasRequest<{ id: number; name: string }>('/users/self');
    return { connected: true, user: data };
  } catch (error) {
    const message =
      error instanceof CanvasApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unknown error';
    return { connected: false, error: message };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
