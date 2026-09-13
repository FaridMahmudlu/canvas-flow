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

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        course: true,
        notifications: {
          orderBy: { scheduledFor: 'asc' },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const now = new Date();
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

    const priorityInput = {
      dueAt: task.dueAt,
      availableAt: task.availableAt,
      isLocked: locked,
      isSubmitted: task.isSubmitted,
      isOverdue: overdue,
      pointsPossible: task.pointsPossible,
      sourceType: task.sourceType as 'assignment' | 'quiz' | 'event',
    };

    const priority = computePriority(priorityInput, now);
    const priorityScore = computePriorityScore(priorityInput, now);

    return NextResponse.json({
      task: {
        id: task.id,
        source: 'canvas',
        sourceType: task.sourceType,
        canvasId: task.canvasTaskId,
        courseId: task.courseId,
        courseName: task.course.name,
        courseCode: task.course.code,
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
        notifications: task.notifications.map((n: { id: string; type: string; scheduledFor: Date; sentAt: Date | null; state: string }) => ({
          id: n.id,
          type: n.type,
          scheduledFor: n.scheduledFor.toISOString(),
          sentAt: n.sentAt?.toISOString() ?? null,
          state: n.state,
        })),
        lastSyncedAt: task.lastSyncedAt.toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch task' },
      { status: 500 },
    );
  }
}
