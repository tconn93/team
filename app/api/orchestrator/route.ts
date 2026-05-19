import { OrchestratorLoop } from '@/lib/anthropic/loop';
import { quickScan, runScout } from '@/lib/anthropic/scout';
import { getBoardStats } from '@/lib/tasks';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const apiKey = body.apiKey || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: 'Anthropic API key required. Pass apiKey in the request body.' },
      { status: 400 }
    );
  }

  const action = body.action || 'cycle';

  switch (action) {
    case 'cycle': {
      // Process one task from the board
      const loop = new OrchestratorLoop({
        apiKey,
        reviewEnabled: body.reviewEnabled !== false,
      });

      const task = await loop.runCycle();
      if (!task) {
        return Response.json({ message: 'No tasks available. Run scout first or add tasks manually.', stats: await getBoardStats() });
      }
      return Response.json({ message: 'Cycle completed', task });
    }

    case 'continuous': {
      // Process tasks continuously until board is empty
      const maxCycles = body.maxCycles || 10;
      const loop = new OrchestratorLoop({
        apiKey,
        reviewEnabled: body.reviewEnabled !== false,
      });

      const cyclesCompleted = await loop.runContinuous(maxCycles);
      return Response.json({
        message: `Completed ${cyclesCompleted} cycles`,
        cyclesCompleted,
        stats: await getBoardStats(),
      });
    }

    case 'scout': {
      // Run the feature scout to identify improvement opportunities
      try {
        const findings = await runScout({ apiKey });
        return Response.json({
          message: `Scout found ${findings.length} improvement opportunities`,
          findings,
          stats: await getBoardStats(),
        });
      } catch (error) {
        // Fallback to quick scan if API call fails
        const findings = await quickScan();
        return Response.json({
          message: `Scout (quick scan) found ${findings.length} improvement opportunities`,
          findings,
          stats: getBoardStats(),
        });
      }
    }

    case 'quick-scan': {
      // Run a lightweight scan without API calls
      const findings = await quickScan();
      return Response.json({
        message: `Quick scan found ${findings.length} improvement opportunities`,
        findings,
        stats: await getBoardStats(),
      });
    }

    case 'status': {
      return Response.json({
        stats: await getBoardStats(),
      });
    }

    default:
      return Response.json(
        { error: `Unknown action: ${action}. Valid actions: cycle, continuous, scout, quick-scan, status` },
        { status: 400 }
      );
  }
}