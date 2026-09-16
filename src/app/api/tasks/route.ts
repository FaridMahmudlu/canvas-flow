import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  computeTaskStatus,
  computePriority,
  computePriorityScore,
  isTaskAvailable,
  isTaskOverdue,
  isTaskLocked,
} from '@/lib/tasks/availability';
import { requireAuth } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tasks — Returns all tasks with filtering, sorting, search, scoped strictly to authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const authRes = await requireAuth();
    if ('response' in authRes) return authRes.response;
    const { user } = authRes;

    const { searchParams } = request.nextUrl;
    const statusFilter = searchParams.get('status');
    const courseId = searchParams.get('courseId');
    const typeFilter = searchParams.get('type');
    const search = searchParams.get('search');
    const semester = searchParams.get('semester');
    const includeDesc = searchParams.get('includeDescription') === 'true';

    // Build where clause with strict user scoping and input sanitization
    const where: Record<string, unknown> = {
      userId: user.id,
    };

    if (courseId && typeof courseId === 'string' && courseId.length <= 64) {
      where.courseId = courseId;
    }
    if (typeFilter && ['assignment', 'quiz', 'event'].includes(typeFilter)) {
      where.sourceType = typeFilter;
    }
    if (search && typeof search === 'string') {
      const cleanSearch = search.slice(0, 100).trim();
      if (cleanSearch) {
        where.title = { contains: cleanSearch, mode: 'insensitive' };
      }
    }
    if (semester && semester !== 'all' && typeof semester === 'string') {
      const cleanSemester = semester.slice(0, 30).trim();
      if (cleanSemester) {
        where.course = { semester: cleanSemester };
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      include: { course: true },
      orderBy: [{ dueAt: 'asc' }],
    });

    interface DbTaskWithCourse {
      id: string;
      canvasTaskId: string;
      courseId: string;
      sourceType: string;
      title: string;
      description: string | null;
      htmlUrl: string | null;
      availableAt: Date | null;
      dueAt: Date | null;
      lockAt: Date | null;
      isLocked: boolean;
      lockExplanation: string | null;
      pointsPossible: number | null;
      submissionTypes: string[];
      published: boolean;
      isSubmitted: boolean;
      submittedAt: Date | null;
      submissionState: string | null;
      grade: string | null;
      score: number | null;
      attempt: number | null;
      quizTimeLimit: number | null;
      quizAllowedAttempts: number | null;
      lastSyncedAt: Date;
      course: {
        id: string;
        name: string;
        code: string | null;
        semester: string | null;
      };
    }

    const now = new Date();

    const enrichedTasks = (tasks as unknown as DbTaskWithCourse[]).map((task) => {
      const dueAt = task.dueAt;
      const availableAt = task.availableAt;
      const lockAt = task.lockAt;

      const isSubmitted =
        task.isSubmitted ||
        task.score != null ||
        task.grade != null ||
        task.submittedAt != null ||
        task.submissionState === 'complete' ||
        task.submissionState === 'graded' ||
        task.submissionState === 'submitted';

      const locked = isTaskLocked(task.isLocked, lockAt, now);
      const available = isTaskAvailable(availableAt, lockAt, task.isLocked, now);
      const overdue = isTaskOverdue(dueAt, isSubmitted, now);

      const status = computeTaskStatus(
        {
          dueAt,
          availableAt,
          lockAt,
          isLocked: locked,
          isSubmitted,
          submissionWorkflowState: task.submissionState || (task.score != null ? 'complete' : null),
        },
        now,
      );

      const priorityInput = {
        dueAt,
        availableAt,
        isLocked: locked,
        isSubmitted,
        isOverdue: overdue,
        pointsPossible: task.pointsPossible,
      };

      const priority = computePriority(priorityInput, now);
      const priorityScore = computePriorityScore(priorityInput, now);

      return {
        id: task.id,
        source: 'canvas',
        sourceType: task.sourceType,
        canvasId: task.canvasTaskId,
        courseId: task.courseId,
        courseName: task.course.name,
        courseCode: task.course.code,
        courseSemester: task.course.semester,
        title: task.title,
        description: includeDesc ? task.description : null,
        url: task.htmlUrl,
        availableAt: task.availableAt ? task.availableAt.toISOString() : null,
        dueAt: task.dueAt ? task.dueAt.toISOString() : null,
        lockAt: task.lockAt ? task.lockAt.toISOString() : null,
        isAvailable: available,
        isLocked: locked,
        isOverdue: overdue,
        isSubmitted,
        status,
        priority,
        priorityScore,
        pointsPossible: task.pointsPossible,
        submissionTypes: task.submissionTypes,
        score: task.score,
        grade: task.grade,
        submission: task.submittedAt || task.grade || task.score != null || task.submissionState ? {
          submittedAt: task.submittedAt ? task.submittedAt.toISOString() : null,
          attempt: task.attempt,
          grade: task.grade,
          score: task.score,
          workflowState: task.submissionState,
        } : null,
        lockExplanation: task.lockExplanation,
        quizDetails:
          task.quizTimeLimit != null || task.quizAllowedAttempts != null
            ? {
                timeLimit: task.quizTimeLimit,
                allowedAttempts: task.quizAllowedAttempts,
              }
            : null,
        lastSyncedAt: task.lastSyncedAt.toISOString(),
      };
    });

    // Apply status filter in memory
    const filteredTasks = statusFilter && statusFilter !== 'all'
      ? enrichedTasks.filter((t) => t.status === statusFilter)
      : enrichedTasks;

    // Calculate aggregated stats
    const stats = {
      dueSoon: enrichedTasks.filter((t) => (t.status as string) === 'due-soon' || (t.status as string) === 'due_soon').length,
      availableNow: enrichedTasks.filter((t) => t.status === 'available').length,
      overdue: enrichedTasks.filter((t) => t.status === 'overdue').length,
      submitted: enrichedTasks.filter((t) => t.status === 'submitted' || t.status === 'completed').length,
      upcoming: enrichedTasks.filter((t) => t.status === 'upcoming').length,
      locked: enrichedTasks.filter((t) => t.status === 'locked').length,
      total: enrichedTasks.length,
    };

    return NextResponse.json({
      tasks: filteredTasks,
      stats,
      total: filteredTasks.length,
    });
  } catch (error) {
    console.error('Error in GET /api/tasks:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 },
    );
  }
}
