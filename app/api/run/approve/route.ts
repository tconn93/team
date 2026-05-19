import { NextResponse } from 'next/server';
import { resolveApproval } from '@/lib/approval';

export const runtime = 'nodejs';

/**
 * POST /api/run/approve — resolve a pending HITL approval request.
 *
 * Body: { id: string, approved: boolean, modifiedInput?: Record<string, unknown> }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, approved, modifiedInput } = body;

    if (!id || typeof approved !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: id and approved (boolean)' },
        { status: 400 },
      );
    }

    const resolved = resolveApproval(id, approved, modifiedInput);

    if (!resolved) {
      return NextResponse.json(
        { error: 'Approval request not found or already resolved' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, id, approved });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}