import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  computeTaskStatus,
  computePriority,
  isTaskAvailable,
  isTaskOverdue,
  isTaskLocked,
} from '@/lib/tasks/availability';
import { requireAuth } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/calendar — Returns tasks and events organized by date, strictly scoped to authenticated user.
 * Query params:
 *   month (1-12)
 *   year (e.g. 2026)
 */
export async function GET(request: NextRequest) {
  try {
    const authRes = await requireAuth();
    if ('response' in authRes) return authRes.response;
    const { user } = authRes;

    const { searchParams } = request.nextUrl;
    const now = new Date();

    const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10);
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);

    // Calculate start and end of target month
    const startDate = new Date(year, month - 1, 1, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Fetch tasks belonging strictly to this user
    const tasks = await prisma.task.findMany({
      where: {
        userId: user.id,
        OR: [
          {
            dueAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          {
            availableAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        ],
      },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            color: true,
          },
        },
      },
      orderBy: { dueAt: 'asc' },
    });

    interface CalendarDbTask {
      id: string;
      title: string;
      sourceType: string;
      availableAt: Date | null;
      dueAt: Date | null;
      lockAt: Date | null;
      isLocked: boolean;
      pointsPossible: number | null;
      isSubmitted: boolean;
      submissionState: string | null;
      course: {
        id: string;
        name: string;
        code: string | null;
        color: string | null;
      };
    }

    const calendarItems = (tasks as unknown as CalendarDbTask[]).map((task) => {
      const locked = isTaskLocked(task.isLocked, task.lockAt, now);
      const available = isTaskAvailable(task.availableAt, task.lockAt, task.isLocked, now);
      const overdue = isTaskOverdue(task.dueAt, task.isSubmitted, now);

      const status = computeTaskStatus(
        {
          dueAt: task.dueAt,
          availableAt: task.availableAt,
          lockAt: task.lockAt,
          isLocked: locked,
          isSubmitted: task.isSubmitted,
          submissionWorkflowState: task.submissionState,
        },
        now,
      );

      const priority = computePriority(
        {
          dueAt: task.dueAt,
          availableAt: task.availableAt,
          isLocked: locked,
          isSubmitted: task.isSubmitted,
          isOverdue: overdue,
          pointsPossible: task.pointsPossible,
          sourceType: task.sourceType as 'assignment' | 'quiz' | 'event',
        },
        now,
      );

      return {
        id: task.id,
        title: task.title,
        sourceType: task.sourceType,
        dueAt: task.dueAt?.toISOString() ?? null,
        availableAt: task.availableAt?.toISOString() ?? null,
        status,
        priority,
        isSubmitted: task.isSubmitted,
        course: task.course,
      };
    });

    // Group items by date string (YYYY-MM-DD) for fast lookup in calendar
    const itemsByDate: Record<string, typeof calendarItems> = {};

    for (const item of calendarItems) {
      const dateKey = item.dueAt ? item.dueAt.split('T')[0] : (item.availableAt ? item.availableAt.split('T')[0] : null);
      if (dateKey) {
        if (!itemsByDate[dateKey]) {
          itemsByDate[dateKey] = [];
        }
        itemsByDate[dateKey].push(item);
      }
    }

    return NextResponse.json({
      year,
      month,
      items: calendarItems,
      itemsByDate,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch calendar items' },
      { status: 500 },
    );
  }
}
