import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/db';
import { encryptToken } from '@/lib/crypto';

export async function GET(req: NextRequest) {
  const authRes = await requireAuth();
  if ('response' in authRes) return authRes.response;
  const { user } = authRes;

  try {
    const connections = await prisma.canvasConnection.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        instanceUrl: true,
        instanceName: true,
        canvasUserId: true,
        canvasUserName: true,
        isActive: true,
        lastVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ connections });
  } catch (error) {
    console.error('Error fetching Canvas connections:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve Canvas connections' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authRes = await requireAuth();
  if ('response' in authRes) return authRes.response;
  const { user } = authRes;

  try {
    const body = await req.json();
    let { instanceUrl, accessToken, instanceName } = body;

    if (!instanceUrl || !accessToken) {
      return NextResponse.json(
        { error: 'Canvas instance URL and Access Token are required' },
        { status: 400 }
      );
    }

    // Normalize instance URL
    instanceUrl = instanceUrl.trim().replace(/\/+$/, '');
    if (!instanceUrl.startsWith('http://') && !instanceUrl.startsWith('https://')) {
      instanceUrl = `https://${instanceUrl}`;
    }
    accessToken = accessToken.trim();

    // Verify token by calling Canvas API /api/v1/users/self
    let canvasUser: { id: number; name: string; avatar_url?: string };
    try {
      const verifyRes = await fetch(`${instanceUrl}/api/v1/users/self`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      });

      if (verifyRes.status === 401) {
        return NextResponse.json(
          { error: 'Canvas rejected this access token. Please ensure it has not expired and has proper permissions.' },
          { status: 401 }
        );
      }

      if (!verifyRes.ok) {
        return NextResponse.json(
          { error: `Canvas responded with status ${verifyRes.status}. Check that the URL is correct.` },
          { status: 400 }
        );
      }

      canvasUser = await verifyRes.json();
    } catch (netErr) {
      console.error('Network error contacting Canvas:', netErr);
      return NextResponse.json(
        { error: 'Could not connect to the specified Canvas URL. Please verify the address.' },
        { status: 400 }
      );
    }

    // Encrypt the access token
    const { encrypted, iv, tag } = encryptToken(accessToken);

    // Derive a default institution name if none provided
    if (!instanceName) {
      try {
        const urlObj = new URL(instanceUrl);
        instanceName = urlObj.hostname.replace('canvas.', '').split('.')[0].toUpperCase();
      } catch {
        instanceName = 'Canvas LMS';
      }
    }

    // Upsert the connection
    const connection = await prisma.canvasConnection.upsert({
      where: {
        userId_instanceUrl: {
          userId: user.id,
          instanceUrl,
        },
      },
      create: {
        userId: user.id,
        instanceUrl,
        instanceName,
        encryptedToken: encrypted,
        tokenIv: iv,
        tokenTag: tag,
        canvasUserId: canvasUser.id,
        canvasUserName: canvasUser.name,
        isActive: true,
        lastVerifiedAt: new Date(),
      },
      update: {
        instanceName,
        encryptedToken: encrypted,
        tokenIv: iv,
        tokenTag: tag,
        canvasUserId: canvasUser.id,
        canvasUserName: canvasUser.name,
        isActive: true,
        lastVerifiedAt: new Date(),
      },
    });

    // Update user profile if needed
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: user.name || canvasUser.name,
        avatarUrl: canvasUser.avatar_url || undefined,
      },
    });


    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        instanceUrl: connection.instanceUrl,
        instanceName: connection.instanceName,
        canvasUserId: connection.canvasUserId,
        canvasUserName: connection.canvasUserName,
      },
    });
  } catch (error) {
    console.error('Error saving Canvas connection:', error);
    return NextResponse.json(
      { error: 'Failed to connect Canvas instance. Please try again.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const authRes = await requireAuth();
  if ('response' in authRes) return authRes.response;
  const { user } = authRes;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    await prisma.canvasConnection.deleteMany({
      where: {
        id,
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting Canvas connection:', error);
    return NextResponse.json(
      { error: 'Failed to remove connection' },
      { status: 500 }
    );
  }
}
