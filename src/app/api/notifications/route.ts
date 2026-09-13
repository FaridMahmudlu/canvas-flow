import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications — Returns recent notifications and counts.
 */
export async function GET() {
  try {
    const notifications = await prisma.notification.findMany({
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
      where: { state: 'pending' },
    });

    const sentCount = await prisma.notification.count({
      where: { state: 'sent' },
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
