import { NextResponse } from 'next/server';
import { testCanvasConnection } from '@/lib/canvas/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health/canvas — Verifies Canvas API connection and token validity.
 */
export async function GET() {
  const result = await testCanvasConnection();

  if (result.connected) {
    return NextResponse.json({
      status: 'ok',
      connected: true,
      user: result.user,
      canvasUrl: process.env.CANVAS_BASE_URL || 'https://canvas.elte.hu',
      mockMode: process.env.CANVAS_MOCK_MODE === 'true',
    });
  }

  return NextResponse.json(
    {
      status: 'error',
      connected: false,
      error: result.error || 'Failed to connect to Canvas API',
      canvasUrl: process.env.CANVAS_BASE_URL || 'https://canvas.elte.hu',
      mockMode: process.env.CANVAS_MOCK_MODE === 'true',
    },
    { status: 502 },
  );
}
