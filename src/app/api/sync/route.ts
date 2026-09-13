import { NextResponse } from 'next/server';
import { syncAll, getLastSyncInfo } from '@/lib/sync/engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/sync — Get last sync status
 */
export async function GET() {
  try {
    const lastSync = await getLastSyncInfo();
    return NextResponse.json({
      lastSync: lastSync
        ? {
            id: lastSync.id,
            status: lastSync.status,
            startedAt: lastSync.startedAt,
            completedAt: lastSync.completedAt,
            coursesCount: lastSync.coursesCount,
            tasksCount: lastSync.tasksCount,
            errorMessage: lastSync.errorMessage,
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get sync status' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/sync — Trigger a manual sync
 */
export async function POST() {
  try {
    const result = await syncAll('manual');
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 },
    );
  }
}
