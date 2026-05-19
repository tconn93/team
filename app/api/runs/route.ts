import { saveRun, listRuns, getRun } from '@/lib/db-runs';

export async function POST(request: Request) {
  try {
    const run = await request.json();
    if (!run.id || !run.goal) {
      return Response.json({ error: 'Run must have id and goal' }, { status: 400 });
    }
    await saveRun(run);
    return Response.json({ saved: true, id: run.id });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to save run' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (id) {
    const run = await getRun(id);
    if (!run) {
      return Response.json({ error: 'Run not found' }, { status: 404 });
    }
    return Response.json(run);
  }

  const limit = parseInt(url.searchParams.get('limit') || '50');
  const runs = await listRuns(limit);
  return Response.json(runs);
}