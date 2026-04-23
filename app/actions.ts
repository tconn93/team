'use server';

import { TeamForgeCoordinator } from '@/lib/mastra/coordinator';
import type { ApiKeyConfig } from '@/lib/llm/router';

/**
 * Server Action: Runs a full mission using the Mastra-powered Coordinator
 * This runs entirely on the server, preventing any Node.js/Prisma modules from reaching the client bundle.
 */
export async function runMissionServerAction(goal: string, apiKeys: ApiKeyConfig = {}) {
  'use server';
  
  try {
    const coordinator = new TeamForgeCoordinator('xai', 'grok-3-beta', apiKeys);
    
    const result = await coordinator.runMission(goal, (message: string) => {
      // In a real implementation this could stream updates via Server Sent Events
      console.log('[Coordinator Stream]:', message);
    });

    return {
      success: true,
      plan: result.plan,
      summary: result.summary,
      deliverables: result.deliverables || [],
    };
  } catch (error) {
    console.error('Server Action failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
