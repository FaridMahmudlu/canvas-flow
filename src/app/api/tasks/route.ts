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

export const dynamic = 'force-dynamic';

/**
 * GET /api/tasks — Returns all tasks with filtering, sorting, search.
 *
 * Query params:
 *   status — filter by computed status
 *   courseId — filter by course
 *   type — "assignment" | "quiz" | "event"
 *   search — search title
 *   sort — "priority" (default) | "dueAt" | "title"
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const statusFilter = searchParams.get('status');
    const courseId = searchParams.get('courseId');
    const typeFilter = searchParams.get('type');
    const search = searchParams.get('search');
    const semester = searchParams.get('semester');

    // Build where clause with input sanitization
    const where: Record<string, unknown> = {};
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

    // Transform to AcademicTask-like shape with computed fields
    const enrichedTasks = (tasks as unknown as DbTaskWithCourse[]).map((task) => {
      const dueAt = task.dueAt;
      const availableAt = task.availableAt;
      const lockAt = task.lockAt;

      const locked = isTaskLocked(task.isLocked, lockAt, now);
      const available = isTaskAvailable(availableAt, lockAt, task.isLocked, now);
      const overdue = isTaskOverdue(dueAt, task.isSubmitted, now);

      const status = computeTaskStatus(
        {
          dueAt,
          availableAt,
          lockAt,
          isLocked: locked,
          isSubmitted: task.isSubmitted,
          submissionWorkflowState: task.submissionState,
        },
        now,
      );

      const priorityInput = {
        dueAt,
        availableAt,
        isLocked: locked,
        isSubmitted: task.isSubmitted,
        isOverdue: overdue,
        pointsPossible: task.pointsPossible,
        sourceType: task.sourceType as 'assignment' | 'quiz' | 'event',
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
        semester: task.course.semester,
        title: task.title,
        description: task.description,
        url: task.htmlUrl,
        availableAt: task.availableAt?.toISOString() ?? null,
        dueAt: task.dueAt?.toISOString() ?? null,
        lockAt: task.lockAt?.toISOString() ?? null,
        isAvailable: available,
        isLocked: locked,
        isOverdue: overdue,
        isSubmitted: task.isSubmitted,
        status,
        priority,
        priorityScore,
        pointsPossible: task.pointsPossible,
        submissionTypes: task.submissionTypes,
        submission: task.isSubmitted
          ? {
              submittedAt: task.submittedAt?.toISOString() ?? null,
              attempt: task.attempt,
              grade: task.grade,
              score: task.score,
              workflowState: task.submissionState,
            }
          : null,
        lockExplanation: task.lockExplanation,
        quizDetails:
          task.sourceType === 'quiz'
            ? {
                timeLimit: task.quizTimeLimit,
                allowedAttempts: task.quizAllowedAttempts,
              }
            : null,
        lastSyncedAt: task.lastSyncedAt.toISOString(),
      };
    });

    // Apply status filter (computed field, so filter after enrichment)
    let filtered = enrichedTasks;
    if (statusFilter) {
      filtered = enrichedTasks.filter((t) => t.status === statusFilter);
    }

    // Sort by priority score (descending) then by dueAt
    filtered.sort((a, b) => {
      const scoreDiff = b.priorityScore - a.priorityScore;
      if (scoreDiff !== 0) return scoreDiff;
      // Secondary sort: due date ascending
      if (a.dueAt && b.dueAt) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      if (a.dueAt) return -1;
      if (b.dueAt) return 1;
      return 0;
    });

    // Compute stats
    const stats = {
      dueSoon: enrichedTasks.filter((t) => t.status === 'due-soon').length,
      availableNow: enrichedTasks.filter((t) => t.status === 'available').length,
      overdue: enrichedTasks.filter((t) => t.status === 'overdue').length,
      submitted: enrichedTasks.filter(
        (t) => t.status === 'submitted' || t.status === 'completed',
      ).length,
      upcoming: enrichedTasks.filter((t) => t.status === 'upcoming').length,
      locked: enrichedTasks.filter((t) => t.status === 'locked').length,
      total: enrichedTasks.length,
    };

    return NextResponse.json(
      { tasks: filtered, stats },
      {
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tasks' },
      { status: 500 },
    );
  }
}
