import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { decryptToken } from '@/lib/crypto';

export interface AuthenticatedUser {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}

export interface CanvasConnectionContext {
  id: string;
  userId: string;
  baseUrl: string;
  token: string;
  instanceName?: string | null;
  canvasUserId?: number | null;
  canvasUserName?: string | null;
}

/**
 * Validate and sanitize callbackUrl to prevent Open Redirect vulnerabilities.
 * Ensures the destination is an internal path and not a protocol-relative
 * or external URI (e.g. //evil.com or https://evil.com).
 */
export function getSafeCallbackUrl(url: string | null | undefined): string {
  if (!url) return '/';
  const trimmed = url.trim();

  // Must begin with a single slash, not double slash, and not contain protocol or backslash
  if (
    trimmed.startsWith('/') &&
    !trimmed.startsWith('//') &&
    !trimmed.startsWith('/\\') &&
    !trimmed.includes('\\') &&
    !trimmed.includes(':')
  ) {
    return trimmed;
  }

  return '/';
}

/**
 * Get current session user from Auth.js, or null if unauthenticated.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return null;
    }
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    };
  } catch (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
}

/**
 * Require authentication for API route handlers. Returns user or a 401 NextResponse.
 */
export async function requireAuth(): Promise<{ user: AuthenticatedUser } | { response: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      response: NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      ),
    };
  }
  return { user };
}

/**
 * Require authenticated user or throw error. Useful in server actions or loaders.
 */
export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

/**
 * Retrieve and decrypt the user's active Canvas connection.
 */
export async function getUserCanvasContext(userId: string): Promise<CanvasConnectionContext | null> {
  const connection = await prisma.canvasConnection.findFirst({
    where: {
      userId,
      isActive: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  if (!connection) {
    return null;
  }

  try {
    const token = decryptToken(
      connection.encryptedToken,
      connection.tokenIv,
      connection.tokenTag
    );

    return {
      id: connection.id,
      userId: connection.userId,
      baseUrl: connection.instanceUrl,
      token,
      instanceName: connection.instanceName,
      canvasUserId: connection.canvasUserId,
      canvasUserName: connection.canvasUserName,
    };
  } catch (err) {
    console.error(`Failed to decrypt token for connection ${connection.id}:`, err);
    return null;
  }
}
