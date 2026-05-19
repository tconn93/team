'use server';

/**
 * Server actions are no longer the primary execution path.
 * Mission execution now goes through the SSE endpoint at /api/run
 * which uses the Anthropic Messages API directly.
 *
 * This file is kept for backwards compatibility but the real
 * execution happens in lib/anthropic/ via the API route.
 */

export async function runMissionServerAction(_goal: string, _apiKeys: Record<string, string> = {}) {
  // Deprecated: mission execution now happens via /api/run SSE endpoint
  // which streams events in real-time using the Anthropic Messages API
  return {
    success: false,
    error: 'Use the /api/run endpoint for real-time mission execution via Anthropic Messages API',
  };
}