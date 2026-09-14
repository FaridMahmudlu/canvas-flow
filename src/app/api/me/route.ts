import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/me — Returns current authenticated user and connected Canvas info.
 * Strictly scoped to authenticated session user.
 */
export async function GET() {
  try {
    const authRes = await requireAuth();
    if ('response' in authRes) return authRes.response;
    const { user } = authRes;

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        canvasConnections: {
          where: { isActive: true },
          take: 1,
          select: {
            id: true,
            instanceUrl: true,
            instanceName: true,
            canvasUserName: true,
            lastVerifiedAt: true,
          },
        },
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User account not found' },
        { status: 404 }
      );
    }

    const activeConn = dbUser.canvasConnections[0];

    return NextResponse.json({
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        avatar_url: dbUser.avatarUrl,
        hasCanvasConnection: !!activeConn,
        canvasInstanceUrl: activeConn?.instanceUrl || null,
        canvasInstanceName: activeConn?.instanceName || null,
      },
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}
