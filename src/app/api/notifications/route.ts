import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications — Returns recent notifications and counts for the authenticated user.
 */
export async function GET() {
  try {
    const authRes = await requireAuth();
    if ('response' in authRes) return authRes.response;
    const { user } = authRes;

    const userScope = {
      OR: [
        { userId: user.id },
        { task: { userId: user.id } },
      ],
    };

    const notifications = await prisma.notification.findMany({
      where: userScope,
      take: 50,
      orderBy: { scheduledFor: 'desc' },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            sourceType: true,
            dueAt: true,
            course: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    const pendingCount = await prisma.notification.count({
      where: {
        state: 'pending',
        ...userScope,
      },
    });

    const sentCount = await prisma.notification.count({
      where: {
        state: 'sent',
        ...userScope,
      },
    });

    interface DbNotificationItem {
      id: string;
      taskId: string;
      type: string;
      scheduledFor: Date;
      sentAt: Date | null;
      state: string;
      errorMessage: string | null;
      createdAt: Date;
      task: {
        id: string;
        title: string;
        sourceType: string;
        dueAt: Date | null;
        course: {
          name: string;
        };
      };
    }

    return NextResponse.json({
      notifications: (notifications as unknown as DbNotificationItem[]).map((n) => ({
        id: n.id,
        taskId: n.taskId,
        taskTitle: n.task.title,
        courseName: n.task.course.name,
        type: n.type,
        scheduledFor: n.scheduledFor.toISOString(),
        sentAt: n.sentAt?.toISOString() ?? null,
        state: n.state,
        errorMessage: n.errorMessage,
        createdAt: n.createdAt.toISOString(),
      })),
      stats: {
        pending: pendingCount,
        sent: sentCount,
        total: notifications.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch notifications' },
      { status: 500 },
    );
  }
}
