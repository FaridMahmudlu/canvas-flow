import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/me/export — Exports user's academic and productivity data in clean JSON.
 * Secrets, password hashes, and encryption tokens are strictly excluded.
 */
export async function GET() {
  try {
    const authRes = await requireAuth();
    if ('response' in authRes) return authRes.response;
    const { user } = authRes;

    const fullData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        timezone: true,
        createdAt: true,
        updatedAt: true,
        canvasConnections: {
          select: {
            id: true,
            instanceUrl: true,
            instanceName: true,
            canvasUserId: true,
            canvasUserName: true,
            isActive: true,
            lastVerifiedAt: true,
            createdAt: true,
          },
        },
        courses: {
          select: {
            id: true,
            canvasCourseId: true,
            name: true,
            code: true,
            semester: true,
            workflowState: true,
            timezone: true,
            lastSyncedAt: true,
            tasks: {
              select: {
                id: true,
                canvasTaskId: true,
                sourceType: true,
                title: true,
                htmlUrl: true,
                dueAt: true,
                availableAt: true,
                status: true,
                pointsPossible: true,
                isSubmitted: true,
                submittedAt: true,
                submissionState: true,
                grade: true,
                score: true,
                attempt: true,
                quizTimeLimit: true,
                quizAllowedAttempts: true,
                lastSyncedAt: true,
              },
            },
          },
        },
        notificationPreferences: {
          select: {
            taskAvailable: true,
            before24h: true,
            before6h: true,
            before1h: true,
            overdue: true,
            newAssignments: true,
            newQuizzes: true,
            changedDeadlines: true,
            quietHoursStart: true,
            quietHoursEnd: true,
          },
        },
        notifications: {
          take: 100,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            scheduledFor: true,
            sentAt: true,
            state: true,
            createdAt: true,
          },
        },
        syncRuns: {
          take: 50,
          orderBy: { startedAt: 'desc' },
          select: {
            id: true,
            status: true,
            startedAt: true,
            completedAt: true,
            durationMs: true,
            coursesCount: true,
            tasksCount: true,
            newTasks: true,
            updatedTasks: true,
            notificationsCount: true,
            triggeredBy: true,
          },
        },
      },
    });

    if (!fullData) {
      return NextResponse.json({ error: 'User data not found' }, { status: 404 });
    }

    const exportPayload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      user: {
        id: fullData.id,
        name: fullData.name,
        email: fullData.email,
        role: fullData.role,
        timezone: fullData.timezone,
        createdAt: fullData.createdAt,
      },
      canvasConnections: fullData.canvasConnections,
      courses: fullData.courses,
      notificationPreferences: fullData.notificationPreferences,
      recentNotifications: fullData.notifications,
      recentSyncRuns: fullData.syncRuns,
    };

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="canvasflow-export-${user.id}-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    console.error('Error exporting user data:', error);
    return NextResponse.json(
      { error: 'Failed to export account data' },
      { status: 500 },
    );
  }
}
