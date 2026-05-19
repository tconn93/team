import { Coordinator } from '@/lib/anthropic/coordinator';
import type { AgentEvent } from '@/lib/anthropic/agent-runner';
import { loadSettings } from '@/lib/settings';
import { DEFAULT_SETTINGS } from '@/lib/settings';

export const runtime = 'nodejs';
export const maxDuration = 120; // Allow up to 2 minutes for long missions

interface RunRequest {
  goal: string;
  apiKeys: {
    anthropic?: string;
    openai?: string;
    xai?: string;
    google?: string;
  };
}

export async function POST(request: Request) {
  let body: RunRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { goal, apiKeys } = body;
  const anthropicKey = apiKeys?.anthropic || process.env.ANTHROPIC_API_KEY;

  if (!goal?.trim()) {
    return new Response(JSON.stringify({ error: 'Goal is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!anthropicKey) {
    return new Response(
      JSON.stringify({ error: 'Anthropic API key is required. Configure it in Settings.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: AgentEvent & { timestamp: string }) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Stream may have been closed
        }
      };

      try {
        // Send initial planning event
        sendEvent({
          type: 'agent_thinking',
          agentId: 'coordinator',
          agentName: 'Coordinator',
          content: `Mission started: "${goal.substring(0, 80)}${goal.length > 80 ? '...' : ''}"`,
          timestamp: new Date().toISOString(),
        });

        const coordinator = new Coordinator(anthropicKey, await loadSettings());
        const result = await coordinator.runMission(goal, (event: AgentEvent) => {
          sendEvent({ ...event, timestamp: new Date().toISOString() });
        });

        // Send mission complete with full results
        sendEvent({
          type: 'agent_complete' as const,
          agentId: 'coordinator',
          agentName: 'Coordinator',
          content: result.summary,
          timestamp: new Date().toISOString(),
        });

        sendEvent({
          type: 'mission_complete' as const,
          agentId: 'coordinator',
          content: JSON.stringify({
            plan: result.plan,
            results: result.results,
            deliverables: result.deliverables,
            totalTokens: result.totalTokens,
          }),
          timestamp: new Date().toISOString(),
        } as any);
      } catch (error) {
        sendEvent({
          type: 'agent_error',
          agentId: 'coordinator',
          content: error instanceof Error ? error.message : 'Unknown error during mission execution',
          timestamp: new Date().toISOString(),
        });
      } finally {
        try {
          controller.close();
        } catch {
          // Controller may already be closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}