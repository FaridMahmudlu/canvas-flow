import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/push/subscribe — Returns the VAPID public key for browser push registration.
 */
export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || null;
  return NextResponse.json(
    { publicKey },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * POST /api/push/subscribe — Register or update browser push subscription for authenticated user.
 */
export async function POST(request: NextRequest) {
  try {
    const authRes = await requireAuth();
    if ('response' in authRes) return authRes.response;
    const { user } = authRes;

    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: 'Invalid push subscription payload' },
        { status: 400 },
      );
    }

    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
        userId: user.id,
      },
      create: {
        userId: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    return NextResponse.json({ success: true, id: subscription.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save subscription' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/push/subscribe — Unregister push subscription for authenticated user.
 */
export async function DELETE(request: NextRequest) {
  try {
    const authRes = await requireAuth();
    if ('response' in authRes) return authRes.response;
    const { user } = authRes;

    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 });
    }

    await prisma.pushSubscription.deleteMany({
      where: {
        endpoint,
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete subscription' },
      { status: 500 },
    );
  }
}
