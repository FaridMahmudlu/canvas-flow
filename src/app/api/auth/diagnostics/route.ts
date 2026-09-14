import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/diagnostics
 * Safe development-only diagnostics endpoint.
 * In production, returns 404.
 * Never exposes secrets, JWT tokens, hashes, or encryption keys.
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  try {
    const session = await auth();

    return NextResponse.json({
      environment: process.env.NODE_ENV || 'development',
      diagnostics: {
        sessionExists: !!session?.user,
        userId: session?.user?.id || null,
        userEmail: session?.user?.email || null,
        sessionExpires: session?.expires || null,
        authSecretConfigured: !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET),
        encryptionKeyConfigured: !!process.env.ENCRYPTION_KEY,
        databaseConfigured: !!process.env.DATABASE_URL,
        authTrustHostConfigured: !!process.env.AUTH_TRUST_HOST,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Diagnostics error' },
      { status: 500 }
    );
  }
}
