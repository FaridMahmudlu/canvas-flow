import { NextResponse } from 'next/server';
import { syncAll, getLastSyncInfo } from '@/lib/sync/engine';
import { requireAuth } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/sync — Get last sync status and adaptive controller state for authenticated user
 */
export async function GET() {
  try {
    const authRes = await requireAuth();
    if ('response' in authRes) return authRes.response;
    const { user } = authRes;

    const { lastSync, syncState, recentRuns } = await getLastSyncInfo(user.id);

    return NextResponse.json({
      lastSync: lastSync
        ? {
            id: lastSync.id,
            status: lastSync.status,
            startedAt: lastSync.startedAt,
            completedAt: lastSync.completedAt,
            durationMs: lastSync.durationMs,
            coursesCount: lastSync.coursesCount,
            tasksCount: lastSync.tasksCount,
            newTasks: lastSync.newTasks,
            updatedTasks: lastSync.updatedTasks,
            notificationsCount: lastSync.notificationsCount,
            rateLimitRemaining: lastSync.rateLimitRemaining,
            requestCost: lastSync.requestCost,
            targetIntervalSeconds: lastSync.targetIntervalSeconds,
            currentIntervalSeconds: lastSync.currentIntervalSeconds,
            detectionLatencyMs: lastSync.detectionLatencyMs,
            errorMessage: lastSync.errorMessage,
            errorType: lastSync.errorType,
          }
        : null,
      syncState: syncState
        ? {
            targetIntervalSeconds: syncState.targetIntervalSeconds,
            currentIntervalSeconds: syncState.currentIntervalSeconds,
            consecutiveSuccesses: syncState.consecutiveSuccesses,
            lastRateLimitRemaining: syncState.lastRateLimitRemaining,
            lastRequestCost: syncState.lastRequestCost,
            last429At: syncState.last429At,
            backoffUntil: syncState.backoffUntil,
            lastSyncAt: syncState.lastSyncAt,
            lastSuccessSyncAt: syncState.lastSuccessSyncAt,
            lastDetectionLatencyMs: syncState.lastDetectionLatencyMs,
            avgDetectionLatencyMs: syncState.avgDetectionLatencyMs,
            worstDetectionLatencyMs: syncState.worstDetectionLatencyMs,
          }
        : null,
      recentRuns: recentRuns || [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get sync status' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/sync — Trigger a safe manual sync for the authenticated user
 */
export async function POST() {
  try {
    const authRes = await requireAuth();
    if ('response' in authRes) return authRes.response;
    const { user } = authRes;

    const result = await syncAll('manual', user.id);
    if (!result.success && result.backoffRemainingSec) {
      return NextResponse.json(result, { status: 429 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 },
    );
  }
}
