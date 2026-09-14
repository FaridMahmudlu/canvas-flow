import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { formatSemesterLabel, sortSemesters } from '@/lib/semester';
import { requireAuth } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/courses — Returns synced courses with task counts, scoped strictly to the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const authRes = await requireAuth();
    if ('response' in authRes) return authRes.response;
    const { user } = authRes;

    const { searchParams } = request.nextUrl;
    const semester = searchParams.get('semester');

    // Build where clause with strict user scoping
    const where: Record<string, unknown> = {
      userId: user.id,
    };

    if (semester && semester !== 'all' && typeof semester === 'string') {
      const cleanSemester = semester.slice(0, 30).trim();
      if (cleanSemester) {
        where.semester = cleanSemester;
      }
    }

    const now = new Date();

    // Fetch distinct semesters for this user only
    const allCoursesForMeta = await prisma.course.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        semester: true,
        _count: { select: { tasks: true } },
      },
    });

    const semesterMap = new Map<string, { courseCount: number; taskCount: number }>();
    let totalCourses = 0;
    let totalTasks = 0;

    for (const c of allCoursesForMeta) {
      totalCourses++;
      totalTasks += c._count.tasks;
      if (c.semester) {
        const existing = semesterMap.get(c.semester) || { courseCount: 0, taskCount: 0 };
        existing.courseCount++;
        existing.taskCount += c._count.tasks;
        semesterMap.set(c.semester, existing);
      }
    }

    const sortedSemesterKeys = sortSemesters(Array.from(semesterMap.keys()));
    const availableSemesters = [
      {
        id: 'all',
        label: 'All Semesters',
        courseCount: totalCourses,
        taskCount: totalTasks,
      },
      ...sortedSemesterKeys.map((sem, idx) => {
        const stats = semesterMap.get(sem)!;
        return {
          id: sem,
          label: formatSemesterLabel(sem),
          courseCount: stats.courseCount,
          taskCount: stats.taskCount,
          isCurrent: idx === 0,
        };
      }),
    ];

    const courses = await prisma.course.findMany({
      where,
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
      semester: string | null;
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

      const upcomingDue = course.tasks
        .filter((t) => !t.isSubmitted && t.dueAt && t.dueAt.getTime() > now.getTime())
        .sort((a, b) => (a.dueAt!.getTime() - b.dueAt!.getTime()));

      const nextDeadline = upcomingDue.length > 0 ? upcomingDue[0].dueAt : null;

      return {
        id: course.id,
        canvasCourseId: course.canvasCourseId,
        name: course.name,
        code: course.code,
        semester: course.semester,
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
      { courses: enriched, availableSemesters },
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
