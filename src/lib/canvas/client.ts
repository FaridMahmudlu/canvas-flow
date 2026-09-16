/**
 * Canvas API HTTP Client
 *
 * Server-side only. Handles authentication, pagination, rate limiting,
 * retries, and error handling for the Canvas LMS REST API.
 *
 * Supports multi-tenant context (custom baseUrl & decrypted token per user)
 * with backward-compatible fallback to environment variables.
 *
 * The Canvas access token is NEVER exposed to the browser.
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

export interface CanvasContext {
  baseUrl: string;
  token: string;
}

export function getCanvasConfig(overrideContext?: CanvasContext | null) {
  if (overrideContext?.baseUrl && overrideContext?.token) {
    return {
      baseUrl: overrideContext.baseUrl.replace(/\/+$/, ''),
      token: overrideContext.token.trim(),
      mockMode: false,
    };
  }

  const baseUrl = process.env.CANVAS_BASE_URL || 'https://canvas.instructure.com';
  const token = process.env.CANVAS_TOKEN;
  const isProduction = process.env.NODE_ENV === 'production';
  const mockMode = !isProduction && process.env.CANVAS_MOCK_MODE === 'true';

  if (mockMode) {
    return { baseUrl: 'https://canvas.instructure.com', token: 'mock-token', mockMode: true };
  }

  if (!token) {
    throw new CanvasAuthError(
      'Canvas access token is not configured. Please connect your Canvas LMS account in Settings.',
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ''), token, mockMode: false };
}

// ─── Pagination Parser ────────────────────────────────────────────────

export function parseLinkHeader(header: string | null): CanvasPaginationLinks {
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

export interface CanvasRequestOptions {
  context?: CanvasContext | null;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  params?: Record<string, string | string[] | number | boolean | undefined>;
  /** Timeout in milliseconds. Default: 10000 */
  timeout?: number;
  /** Max retries for transient errors. Default: 1 */
  maxRetries?: number;
}

export interface CanvasTelemetry {
  lastRateLimitRemaining?: number;
  lastRequestCost?: number;
  lastHttpStatus?: number;
  lastLatencyMs?: number;
  lastRetryAfter?: number;
  last429At?: Date;
  totalRequestsInCycle: number;
}

let cycleTelemetry: CanvasTelemetry = {
  totalRequestsInCycle: 0,
};

export function resetCycleTelemetry(): void {
  cycleTelemetry = {
    totalRequestsInCycle: 0,
    lastRateLimitRemaining: cycleTelemetry.lastRateLimitRemaining,
    lastRequestCost: cycleTelemetry.lastRequestCost,
    lastHttpStatus: cycleTelemetry.lastHttpStatus,
    lastLatencyMs: cycleTelemetry.lastLatencyMs,
    lastRetryAfter: cycleTelemetry.lastRetryAfter,
    last429At: cycleTelemetry.last429At,
  };
}

export function getLatestCanvasTelemetry(): Readonly<CanvasTelemetry> {
  return cycleTelemetry;
}

function recordResponseTelemetry(
  response: Response,
  reqStart: number,
): {
  rateLimitRemaining?: number;
  requestCost?: number;
  retryAfter?: number;
  latencyMs: number;
} {
  const latencyMs = Math.round(performance.now() - reqStart);

  cycleTelemetry.totalRequestsInCycle++;
  cycleTelemetry.lastHttpStatus = response.status;
  cycleTelemetry.lastLatencyMs = latencyMs;

  const rateLimitHeader = response.headers.get('X-Rate-Limit-Remaining');
  const rateLimitRemaining = rateLimitHeader ? parseFloat(rateLimitHeader) : undefined;
  if (rateLimitRemaining !== undefined && !isNaN(rateLimitRemaining)) {
    cycleTelemetry.lastRateLimitRemaining = rateLimitRemaining;
  }

  const costHeader = response.headers.get('X-Request-Cost');
  const requestCost = costHeader ? parseFloat(costHeader) : undefined;
  if (requestCost !== undefined && !isNaN(requestCost)) {
    cycleTelemetry.lastRequestCost = requestCost;
  }

  const retryAfterHeader = response.headers.get('Retry-After');
  const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
  if (retryAfter !== undefined && !isNaN(retryAfter)) {
    cycleTelemetry.lastRetryAfter = retryAfter;
  }

  if (response.status === 429) {
    cycleTelemetry.last429At = new Date();
  }

  return { rateLimitRemaining, requestCost, retryAfter, latencyMs };
}

export interface CanvasResponse<T> {
  data: T;
  pagination: CanvasPaginationLinks;
  rateLimitRemaining?: number;
  requestCost?: number;
  latencyMs?: number;
  httpStatus?: number;
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
  const { baseUrl, token } = getCanvasConfig(options.context);
  const {
    method = 'GET',
    body,
    params,
    timeout = 10000,
    maxRetries = 1,
  } = options;

  // Build URL: support absolute pagination URLs directly, or resolve relative paths against baseUrl
  const url = path.startsWith('http://') || path.startsWith('https://')
    ? new URL(path)
    : new URL(path.startsWith('/api/v1') ? path : `/api/v1${path.startsWith('/') ? path : `/${path}`}`, baseUrl);

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

      const reqStart = performance.now();
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const { rateLimitRemaining, requestCost, retryAfter, latencyMs } =
        recordResponseTelemetry(response, reqStart);

      // Handle errors
      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        let parsedError: CanvasErrorResponse | undefined;
        try {
          parsedError = JSON.parse(errorBody) as CanvasErrorResponse;
        } catch {
          // Not JSON
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
            const retryMs = retryAfter !== undefined
              ? retryAfter * 1000
              : Math.min(1000 * Math.pow(2, attempt), 30000);

            if (attempt < maxRetries) {
              await sleep(retryMs);
              continue;
            }
            throw new CanvasRateLimitError(retryMs);
          }
          default:
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

      return {
        data,
        pagination,
        rateLimitRemaining,
        requestCost,
        latencyMs,
        httpStatus: response.status,
      };
    } catch (error) {
      if (error instanceof CanvasApiError) {
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
 */
export async function canvasPaginatedRequest<T>(
  path: string,
  options: CanvasRequestOptions = {},
): Promise<T[]> {
  const allData: T[] = [];
  const params = { ...options.params, per_page: options.params?.per_page ?? '100' };

  let currentTarget: string | null = path;
  let isFirstPage = true;

  while (currentTarget) {
    // First page uses options.params; subsequent pages already include query params in Link header
    const response: CanvasResponse<T[]> = await canvasRequest<T[]>(
      currentTarget,
      isFirstPage ? { ...options, params } : { ...options, params: undefined },
    );

    if (Array.isArray(response.data)) {
      allData.push(...response.data);
    }

    if (response.pagination.next && response.pagination.next !== currentTarget) {
      currentTarget = response.pagination.next;
      isFirstPage = false;
    } else {
      currentTarget = null;
    }

    if (response.rateLimitRemaining !== undefined && response.rateLimitRemaining < 50) {
      await sleep(500);
    }
  }

  return allData;
}

/**
 * Test the Canvas API connection by fetching the current user.
 */
export async function testCanvasConnection(context?: CanvasContext | null): Promise<{
  connected: boolean;
  user?: { id: number; name: string };
  error?: string;
}> {
  try {
    const { data } = await canvasRequest<{ id: number; name: string }>('/users/self', { context });
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
