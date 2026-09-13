import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/canvas/api';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/me — Returns current user information.
 * Tries Canvas API first, then falls back to local database if offline.
 */
export async function GET() {
  try {
    // Try getting user from Canvas API
    try {
      const canvasUser = await getCurrentUser();
      return NextResponse.json({ user: canvasUser });
    } catch {
      // If Canvas API fails or credentials not configured, check local DB
      const localUser = await prisma.user.findFirst({
        orderBy: { updatedAt: 'desc' },
      });

      if (localUser) {
        return NextResponse.json({
          user: {
            id: localUser.canvasUserId,
            name: localUser.name,
            email: localUser.email,
            avatar_url: localUser.avatarUrl,
          },
        });
      }

      // Default fallback student profile
      return NextResponse.json({
        user: {
          id: 0,
          name: 'ELTE Student',
          email: null,
          avatar_url: null,
        },
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch user' },
      { status: 500 },
    );
  }
}
