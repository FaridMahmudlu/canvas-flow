/**
 * Adaptive Synchronization Controller
 *
 * Implements deterministic adaptive polling with Canvas REST API rate-limit awareness.
 *
 * Polling Intervals:
 * - HEALTHY (> 400 remaining): 60s
 * - MILD RATE PRESSURE (200 - 400 remaining): 90s
 * - MODERATE RATE PRESSURE (100 - 200 remaining): 120s
 * - HIGH RATE PRESSURE (< 100 remaining): 180s+
 * - HTTP 429 / Throttled: Respects Retry-After or exponential backoff
 *
 * Recovery:
 * Gradually steps down towards 60s after consecutive successful cycles.
 * Never jumps straight from 429 back to 60s.
 */

import { prisma } from '../db';
import { logger } from '../logger';

export const TARGET_INTERVAL_SECONDS = 60;
export const INTERVAL_MILD_PRESSURE_SECONDS = 90;
export const INTERVAL_MODERATE_PRESSURE_SECONDS = 120;
export const INTERVAL_HIGH_PRESSURE_SECONDS = 180;
export const MAX_BACKOFF_SECONDS = 600; // 10 minutes max backoff

export interface AdaptiveEvaluation {
  currentIntervalSeconds: number;
  targetIntervalSeconds: number;
  backoffSeconds: number;
  backoffUntil: Date | null;
  rateLimitStatus: 'healthy' | 'mild' | 'moderate' | 'high' | 'throttled';
}

export interface CanSyncResult {
  allowed: boolean;
  backoffRemainingSec: number;
  reason?: string;
}

/**
 * Fetch or initialize the user-scoped SyncState record.
 */
export async function getOrCreateSyncState(userId: string) {
  let state = await prisma.syncState.findUnique({
    where: { userId },
  });

  if (!state) {
    state = await prisma.syncState.create({
      data: {
        userId,
        targetIntervalSeconds: TARGET_INTERVAL_SECONDS,
        currentIntervalSeconds: TARGET_INTERVAL_SECONDS,
        consecutiveSuccesses: 0,
      },
    });
  }

  return state;
}

/**
 * Check whether a sync is allowed to run right now for this specific user.
 */
export async function canInitiateSync(userId: string, now: Date = new Date()): Promise<CanSyncResult> {
  const state = await getOrCreateSyncState(userId);

  if (state.backoffUntil && state.backoffUntil.getTime() > now.getTime()) {
    const backoffRemainingSec = Math.ceil(
      (state.backoffUntil.getTime() - now.getTime()) / 1000,
    );
    return {
      allowed: false,
      backoffRemainingSec,
      reason: `Canvas is temporarily rate-limited. Backoff active for ${backoffRemainingSec}s.`,
    };
  }

  return {
    allowed: true,
    backoffRemainingSec: 0,
  };
}

/**
 * Pure evaluation function for calculating the next polling interval.
 */
export function calculateNextInterval(options: {
  currentInterval: number;
  consecutiveSuccesses: number;
  rateLimitRemaining?: number | null;
  is429?: boolean;
  retryAfterSec?: number | null;
}): AdaptiveEvaluation {
  const {
    currentInterval,
    consecutiveSuccesses,
    rateLimitRemaining,
    is429,
    retryAfterSec,
  } = options;

  // 1. HTTP 429 Throttling
  if (is429) {
    const backoffSec = retryAfterSec && retryAfterSec > 0
      ? Math.min(retryAfterSec, MAX_BACKOFF_SECONDS)
      : Math.min(TARGET_INTERVAL_SECONDS * 2, MAX_BACKOFF_SECONDS);

    const backoffUntil = new Date(Date.now() + backoffSec * 1000);

    return {
      currentIntervalSeconds: Math.max(currentInterval, INTERVAL_HIGH_PRESSURE_SECONDS),
      targetIntervalSeconds: TARGET_INTERVAL_SECONDS,
      backoffSeconds: backoffSec,
      backoffUntil,
      rateLimitStatus: 'throttled',
    };
  }

  // 2. High Rate Pressure (< 100 remaining bucket)
  if (rateLimitRemaining !== undefined && rateLimitRemaining !== null && rateLimitRemaining < 100) {
    return {
      currentIntervalSeconds: INTERVAL_HIGH_PRESSURE_SECONDS,
      targetIntervalSeconds: TARGET_INTERVAL_SECONDS,
      backoffSeconds: 0,
      backoffUntil: null,
      rateLimitStatus: 'high',
    };
  }

  // 3. Moderate Rate Pressure (100 - 200 remaining)
  if (rateLimitRemaining !== undefined && rateLimitRemaining !== null && rateLimitRemaining < 200) {
    return {
      currentIntervalSeconds: INTERVAL_MODERATE_PRESSURE_SECONDS,
      targetIntervalSeconds: TARGET_INTERVAL_SECONDS,
      backoffSeconds: 0,
      backoffUntil: null,
      rateLimitStatus: 'moderate',
    };
  }

  // 4. Mild Rate Pressure (200 - 400 remaining)
  if (rateLimitRemaining !== undefined && rateLimitRemaining !== null && rateLimitRemaining <= 400) {
    return {
      currentIntervalSeconds: INTERVAL_MILD_PRESSURE_SECONDS,
      targetIntervalSeconds: TARGET_INTERVAL_SECONDS,
      backoffSeconds: 0,
      backoffUntil: null,
      rateLimitStatus: 'mild',
    };
  }

  // 5. Healthy (> 400 remaining or unprovided)
  // Gradual step-down towards 60s after 3 consecutive successful cycles
  let nextInterval = currentInterval;
  if (currentInterval > TARGET_INTERVAL_SECONDS && consecutiveSuccesses >= 3) {
    if (currentInterval > INTERVAL_MODERATE_PRESSURE_SECONDS) {
      nextInterval = INTERVAL_MODERATE_PRESSURE_SECONDS;
    } else if (currentInterval > INTERVAL_MILD_PRESSURE_SECONDS) {
      nextInterval = INTERVAL_MILD_PRESSURE_SECONDS;
    } else {
      nextInterval = TARGET_INTERVAL_SECONDS;
    }
  } else if (currentInterval <= TARGET_INTERVAL_SECONDS) {
    nextInterval = TARGET_INTERVAL_SECONDS;
  }

  return {
    currentIntervalSeconds: nextInterval,
    targetIntervalSeconds: TARGET_INTERVAL_SECONDS,
    backoffSeconds: 0,
    backoffUntil: null,
    rateLimitStatus: 'healthy',
  };
}

/**
 * Record a successful sync cycle and adaptively adjust controller telemetry.
 */
export async function recordAdaptiveSyncSuccess(params: {
  userId: string;
  rateLimitRemaining?: number | null;
  requestCost?: number | null;
  detectionLatencyMs?: number | null;
  now?: Date;
}) {
  const now = params.now || new Date();
  const state = await getOrCreateSyncState(params.userId);

  const consecutive = state.consecutiveSuccesses + 1;
  const evaluation = calculateNextInterval({
    currentInterval: state.currentIntervalSeconds,
    consecutiveSuccesses: consecutive,
    rateLimitRemaining: params.rateLimitRemaining,
  });

  // Calculate rolling detection latency metrics
  let newAvg = state.avgDetectionLatencyMs;
  let newWorst = state.worstDetectionLatencyMs;

  if (params.detectionLatencyMs !== undefined && params.detectionLatencyMs !== null) {
    if (newAvg === null || newAvg === undefined) {
      newAvg = params.detectionLatencyMs;
    } else {
      // Exponential moving average (weight 0.25 to new measurement)
      newAvg = Math.round(newAvg * 0.75 + params.detectionLatencyMs * 0.25);
    }

    if (newWorst === null || newWorst === undefined || params.detectionLatencyMs > newWorst) {
      newWorst = params.detectionLatencyMs;
    }
  }

  const updated = await prisma.syncState.update({
    where: { userId: params.userId },
    data: {
      currentIntervalSeconds: evaluation.currentIntervalSeconds,
      targetIntervalSeconds: TARGET_INTERVAL_SECONDS,
      consecutiveSuccesses: consecutive,
      lastRateLimitRemaining: params.rateLimitRemaining ?? state.lastRateLimitRemaining,
      lastRequestCost: params.requestCost ?? state.lastRequestCost,
      lastSyncAt: now,
      lastSuccessSyncAt: now,
      backoffUntil: null,
      lastDetectionLatencyMs: params.detectionLatencyMs ?? state.lastDetectionLatencyMs,
      avgDetectionLatencyMs: newAvg,
      worstDetectionLatencyMs: newWorst,
    },
  });

  logger.info('Adaptive sync controller updated state', {
    userId: params.userId,
    interval: updated.currentIntervalSeconds,
    rateLimitRemaining: updated.lastRateLimitRemaining,
    consecutiveSuccesses: consecutive,
  });

  return updated;
}

/**
 * Record a rate-limited (HTTP 429) or failed sync cycle and activate backoff.
 */
export async function recordAdaptiveSyncFailure(params: {
  userId: string;
  is429: boolean;
  retryAfterSec?: number | null;
  errorType?: string;
  errorMessage?: string;
  now?: Date;
}) {
  const now = params.now || new Date();
  const state = await getOrCreateSyncState(params.userId);

  const evaluation = calculateNextInterval({
    currentInterval: state.currentIntervalSeconds,
    consecutiveSuccesses: 0,
    is429: params.is429,
    retryAfterSec: params.retryAfterSec,
  });

  const updated = await prisma.syncState.update({
    where: { userId: params.userId },
    data: {
      currentIntervalSeconds: evaluation.currentIntervalSeconds,
      consecutiveSuccesses: 0,
      last429At: params.is429 ? now : state.last429At,
      backoffUntil: evaluation.backoffUntil,
      lastSyncAt: now,
    },
  });

  logger.warn('Adaptive sync controller activated backoff', {
    userId: params.userId,
    is429: params.is429,
    backoffSeconds: evaluation.backoffSeconds,
    backoffUntil: evaluation.backoffUntil?.toISOString(),
  });

  return {
    state: updated,
    evaluation,
  };
}
