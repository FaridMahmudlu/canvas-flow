import { NextRequest, NextResponse } from 'next/server';
import { syncAll } from '@/lib/sync/engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  // In production, CRON_SECRET is strictly mandatory
  if (isProduction) {
    if (!cronSecret) return false;
    const authHeader = request.headers.get('authorization');
    return authHeader === `Bearer ${cronSecret}`;
  }

  // In local development, allow if secret is not set
  if (!cronSecret) return true;
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * POST/GET /api/cron/sync — Periodic background Canvas sync.
 * Protected by CRON_SECRET Bearer header.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized: invalid or missing CRON_SECRET' }, { status: 401 });
  }

  const result = await syncAll('cron');
  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized: invalid or missing CRON_SECRET' }, { status: 401 });
  }

  const result = await syncAll('cron');
  return NextResponse.json(result);
}
