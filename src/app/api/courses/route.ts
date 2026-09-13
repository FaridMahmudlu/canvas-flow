import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/courses — Returns synced courses with task counts.
 */
export async function GET() {
  try {
    const now = new Date();

    const courses = await prisma.course.findMany({
      include: {
        tasks: {
          select: {
            id: true,
            dueAt: true,
            isSubmitted: true,
            isLocked: true,
            submissionState: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

interface CourseTaskSummary {
  id: string;
  dueAt: Date | null;
  isSubmitted: boolean;
  isLocked: boolean;
  submissionState: string | null;
}

interface CourseWithTasks {
  id: string;
  canvasCourseId: number;
  name: string;
  code: string | null;
  workflowState: string;
  color: string | null;
  lastSyncedAt: Date | null;
  tasks: CourseTaskSummary[];
}

    const enriched = (courses as unknown as CourseWithTasks[]).map((course) => {
      const pending = course.tasks.filter(
        (t) => !t.isSubmitted && !t.isLocked,
      ).length;

      const overdue = course.tasks.filter(
        (t) =>
          !t.isSubmitted &&
          t.dueAt &&
          t.dueAt.getTime() < now.getTime(),
      ).length;

      const dueThisWeek = course.tasks.filter((t) => {
        if (t.isSubmitted || !t.dueAt) return false;
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        return t.dueAt.getTime() >= now.getTime() && t.dueAt.getTime() <= weekFromNow.getTime();
      }).length;

      // Next deadline
      const upcomingDue = course.tasks
        .filter((t) => !t.isSubmitted && t.dueAt && t.dueAt.getTime() > now.getTime())
        .sort((a, b) => (a.dueAt!.getTime() - b.dueAt!.getTime()));

      const nextDeadline = upcomingDue.length > 0 ? upcomingDue[0].dueAt : null;

      return {
        id: course.id,
        canvasCourseId: course.canvasCourseId,
        name: course.name,
        code: course.code,
        workflowState: course.workflowState,
        color: course.color,
        lastSyncedAt: course.lastSyncedAt?.toISOString() ?? null,
        stats: {
          pending,
          overdue,
          dueThisWeek,
          total: course.tasks.length,
        },
        nextDeadline: nextDeadline?.toISOString() ?? null,
      };
    });

    return NextResponse.json(
      { courses: enriched },
      {
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch courses' },
      { status: 500 },
    );
  }
}
