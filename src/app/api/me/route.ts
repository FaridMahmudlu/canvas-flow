import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/me — Returns current authenticated user and connected Canvas info.
 */
export async function GET() {
  try {
    const sessionUser = await getCurrentUser();

    if (!sessionUser) {
      // Check if there is any user in DB (for backward compatibility during initial setup)
      const firstUser = await prisma.user.findFirst({
        include: {
          canvasConnections: {
            where: { isActive: true },
            take: 1,
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (!firstUser) {
        return NextResponse.json(
          { error: 'Unauthorized. Please sign in.' },
          { status: 401 }
        );
      }

      const activeConn = firstUser.canvasConnections[0];
      return NextResponse.json({
        user: {
          id: firstUser.id,
          name: firstUser.name,
          email: firstUser.email,
          avatar_url: firstUser.avatarUrl,
          hasCanvasConnection: !!activeConn,
          canvasInstanceUrl: activeConn?.instanceUrl,
          canvasInstanceName: activeConn?.instanceName,
        },
      });
    }

    // Authenticated user
    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: {
        canvasConnections: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
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
        canvasInstanceUrl: activeConn?.instanceUrl,
        canvasInstanceName: activeConn?.instanceName,
      },
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch user' },
      { status: 500 },
    );
  }
}
