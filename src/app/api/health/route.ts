import { NextResponse } from 'next/server';
import { testCanvasConnection } from '@/lib/canvas/client';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health — Safe production health check endpoint.
 * Returns only operational readiness states with zero sensitive secrets.
 */
export async function GET() {
  try {
    // 1. Verify database connection
    let dbStatus = 'disconnected';
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'disconnected';
    }

    // 2. Verify Canvas connectivity
    const canvasResult = await testCanvasConnection();
    const canvasStatus = canvasResult.connected ? 'reachable' : 'unreachable';

    // 3. Verify Push configuration
    const hasVapidPublic = !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY);
    const hasVapidPrivate = !!process.env.VAPID_PRIVATE_KEY;
    const pushStatus = hasVapidPublic && hasVapidPrivate ? 'configured' : 'unconfigured';

    const isHealthy = dbStatus === 'connected' && canvasStatus === 'reachable';

    return NextResponse.json(
      {
        status: isHealthy ? 'ok' : 'degraded',
        database: dbStatus,
        canvas: canvasStatus,
        push: pushStatus,
        timestamp: new Date().toISOString(),
      },
      { status: isHealthy ? 200 : 503 },
    );
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        database: 'unknown',
        canvas: 'unknown',
        push: 'unknown',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
