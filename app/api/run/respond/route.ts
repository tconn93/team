import { NextResponse } from 'next/server';
import { resolveQuestion } from '@/lib/question';

export const runtime = 'nodejs';

/**
 * POST /api/run/respond — resolve a pending user question from an agent.
 *
 * Body: { id: string, answer: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, answer } = body;

    if (!id || typeof answer !== 'string') {
      return NextResponse.json(
        { error: 'Missing required fields: id and answer (string)' },
        { status: 400 },
      );
    }

    const resolved = resolveQuestion(id, answer);

    if (!resolved) {
      return NextResponse.json(
        { error: 'Question not found or already resolved' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, id, answer });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}