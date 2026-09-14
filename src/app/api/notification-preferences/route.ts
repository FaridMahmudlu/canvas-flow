import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

const DEFAULT_PREFERENCES = {
  taskAvailable: true,
  before24h: true,
  before6h: true,
  before1h: true,
  overdue: true,
  newAssignments: true,
  newQuizzes: true,
  changedDeadlines: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
};

/**
 * GET /api/notification-preferences — Retrieve user's notification preferences.
 */
export async function GET() {
  try {
    const authRes = await requireAuth();
    if ('response' in authRes) return authRes.response;
    const { user } = authRes;

    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId: user.id },
    });

    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: {
          userId: user.id,
          ...DEFAULT_PREFERENCES,
        },
      });
    }

    return NextResponse.json({ preferences: prefs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch preferences' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/notification-preferences — Update user's notification preferences.
 */
export async function PUT(request: NextRequest) {
  try {
    const authRes = await requireAuth();
    if ('response' in authRes) return authRes.response;
    const { user } = authRes;

    const body = await request.json();

    const updated = await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      update: {
        taskAvailable: body.taskAvailable ?? true,
        before24h: body.before24h ?? true,
        before6h: body.before6h ?? true,
        before1h: body.before1h ?? true,
        overdue: body.overdue ?? true,
        newAssignments: body.newAssignments ?? true,
        newQuizzes: body.newQuizzes ?? true,
        changedDeadlines: body.changedDeadlines ?? true,
        quietHoursStart: body.quietHoursStart ?? null,
        quietHoursEnd: body.quietHoursEnd ?? null,
      },
      create: {
        userId: user.id,
        taskAvailable: body.taskAvailable ?? true,
        before24h: body.before24h ?? true,
        before6h: body.before6h ?? true,
        before1h: body.before1h ?? true,
        overdue: body.overdue ?? true,
        newAssignments: body.newAssignments ?? true,
        newQuizzes: body.newQuizzes ?? true,
        changedDeadlines: body.changedDeadlines ?? true,
        quietHoursStart: body.quietHoursStart ?? '22:00',
        quietHoursEnd: body.quietHoursEnd ?? '08:00',
      },
    });

    return NextResponse.json({ preferences: updated, success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update preferences' },
      { status: 500 },
    );
  }
}
