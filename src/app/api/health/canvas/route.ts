import { NextResponse } from 'next/server';
import { testCanvasConnection, type CanvasContext } from '@/lib/canvas/client';
import { getCurrentUser, getUserCanvasContext } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';
import { decryptToken } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health/canvas — Verifies Canvas API connection and token validity.
 * Supports authenticated user context, database active connections, and legacy fallback.
 */
export async function GET() {
  let context: CanvasContext | null = null;
  let connectionId: string | null = null;
  let instanceName = 'Canvas LMS';

  try {
    // 1. Check if user is authenticated in current session
    const user = await getCurrentUser();
    if (user?.id) {
      const userContext = await getUserCanvasContext(user.id);
      if (userContext) {
        context = { baseUrl: userContext.baseUrl, token: userContext.token };
        connectionId = userContext.id;
        instanceName = userContext.instanceName || 'ELTE Canvas';
      }
    }

    // 2. If no context from session, check the most recently updated active database connection
    if (!context) {
      const latestConn = await prisma.canvasConnection.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' },
      });
      if (latestConn) {
        try {
          const token = decryptToken(latestConn.encryptedToken, latestConn.tokenIv, latestConn.tokenTag);
          context = { baseUrl: latestConn.instanceUrl, token };
          connectionId = latestConn.id;
          instanceName = latestConn.instanceName || 'ELTE Canvas';
        } catch {
          // Decryption failed, leave context null
        }
      }
    }

    // 3. Fallback: check environment variable (legacy / local dev)
    if (!context && process.env.CANVAS_TOKEN) {
      context = {
        baseUrl: (process.env.CANVAS_BASE_URL || 'https://canvas.elte.hu').replace(/\/+$/, ''),
        token: process.env.CANVAS_TOKEN.trim(),
      };
    }

    if (!context) {
      return NextResponse.json(
        {
          status: 'error',
          connected: false,
          error: 'No active Canvas connection found. Please connect your Canvas LMS in Settings.',
          canvasUrl: process.env.CANVAS_BASE_URL || 'https://canvas.elte.hu',
          mockMode: process.env.CANVAS_MOCK_MODE === 'true',
        },
        { status: 404 },
      );
    }

    const result = await testCanvasConnection(context);

    if (result.connected) {
      // Mark connection verified in DB if associated with a record
      if (connectionId) {
        prisma.canvasConnection
          .update({
            where: { id: connectionId },
            data: { lastVerifiedAt: new Date() },
          })
          .catch(() => {});
      }

      return NextResponse.json({
        status: 'ok',
        connected: true,
        user: result.user,
        canvasUrl: context.baseUrl,
        instanceName,
        mockMode: process.env.CANVAS_MOCK_MODE === 'true',
      });
    }

    return NextResponse.json(
      {
        status: 'error',
        connected: false,
        error: result.error || 'Failed to connect to Canvas API',
        canvasUrl: context.baseUrl,
        instanceName,
        mockMode: process.env.CANVAS_MOCK_MODE === 'true',
      },
      { status: 502 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        connected: false,
        error: err instanceof Error ? err.message : 'Internal error testing Canvas connection',
        canvasUrl: process.env.CANVAS_BASE_URL || 'https://canvas.elte.hu',
      },
      { status: 500 },
    );
  }
}
