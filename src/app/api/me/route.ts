import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/me — Returns current authenticated user profile, timezone, and Canvas connection.
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
        timezone: true,
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
        { status: 404 },
      );
    }

    const activeConn = dbUser.canvasConnections[0];

    return NextResponse.json({
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        avatar_url: dbUser.avatarUrl,
        timezone: dbUser.timezone || 'Europe/Budapest',
        hasCanvasConnection: !!activeConn,
        canvasInstanceUrl: activeConn?.instanceUrl || null,
        canvasInstanceName: activeConn?.instanceName || null,
      },
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/me — Update user profile details (name, timezone).
 */
export async function PATCH(req: NextRequest) {
  try {
    const authRes = await requireAuth();
    if ('response' in authRes) return authRes.response;
    const { user } = authRes;

    const body = await req.json();
    const { name, timezone } = body;

    const updateData: { name?: string; timezone?: string } = {};

    if (typeof name === 'string') {
      const cleanName = name.trim().slice(0, 100);
      if (cleanName) {
        updateData.name = cleanName;
      }
    }

    if (typeof timezone === 'string') {
      const cleanTz = timezone.trim();
      try {
        // Validate timezone string
        Intl.DateTimeFormat(undefined, { timeZone: cleanTz });
        updateData.timezone = cleanTz;
      } catch {
        return NextResponse.json(
          { error: 'Invalid IANA timezone format (e.g. Europe/Budapest, UTC, America/New_York)' },
          { status: 400 },
        );
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided to update' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        timezone: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        avatar_url: updatedUser.avatarUrl,
        timezone: updatedUser.timezone,
      },
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/me — Permanently delete user account and cascade-delete all owned data.
 */
export async function DELETE() {
  try {
    const authRes = await requireAuth();
    if ('response' in authRes) return authRes.response;
    const { user } = authRes;

    // Cascade delete user and all associated records
    await prisma.user.delete({
      where: { id: user.id },
    });

    return NextResponse.json({
      success: true,
      message: 'User account and all associated academic data have been permanently deleted.',
    });
  } catch (error) {
    console.error('Error deleting user account:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 },
    );
  }
}
