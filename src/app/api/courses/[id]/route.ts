import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/courses/[id] — Retrieve single course details, strictly owned by authenticated user.
 */
export async function GET(
  req: NextRequest,
  context: RouteContext,
) {
  try {
    const authRes = await requireAuth();
    if ('response' in authRes) return authRes.response;
    const { user } = authRes;

    const { id: courseId } = await context.params;

    if (!courseId) {
      return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
    }

    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        userId: user.id,
      },
      include: {
        tasks: {
          where: { published: true },
          select: {
            id: true,
            status: true,
            isSubmitted: true,
            dueAt: true,
            pointsPossible: true,
            score: true,
            grade: true,
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found or access denied' }, { status: 404 });
    }

    const totalTasks = course.tasks.length;
    const completedTasks = course.tasks.filter(
      (t) => t.isSubmitted || t.status === 'completed' || t.status === 'submitted',
    ).length;
    const overdueTasks = course.tasks.filter((t) => t.status === 'overdue').length;
    const pendingTasks = totalTasks - completedTasks;

    return NextResponse.json({
      course: {
        id: course.id,
        canvasCourseId: course.canvasCourseId,
        name: course.name,
        code: course.code,
        semester: course.semester,
        workflowState: course.workflowState,
        timezone: course.timezone,
        lastSyncedAt: course.lastSyncedAt?.toISOString() || null,
        stats: {
          totalTasks,
          completedTasks,
          overdueTasks,
          pendingTasks,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching course by ID:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve course details' },
      { status: 500 },
    );
  }
}
