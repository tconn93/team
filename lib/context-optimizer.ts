import Anthropic from '@anthropic-ai/sdk';
import { createAnthropicClient } from './anthropic/client';
import { FAST_MODEL } from './models';
import * as memawi from './memawi';

const CONTEXT_TOKEN_LIMIT = 300_000;

// When true, use Memawi's API for context extraction/consolidation.
// When false (default), use the local FAST_MODEL for context management.
const USE_MEMAWI_EXTRACT = process.env.MEMAWI_EXTRACT_CONSOLID === 'true';

const OPTIMIZER_SYSTEM_PROMPT = `You are a context optimization agent. Your job is to compress and optimize an AI agent's session context (CONTEXT.md) while preserving all critical information.

Rules for optimization:
1. PRESERVE all key decisions, conclusions, and action items — never lose important outcomes
2. PRESERVE all file paths, variable names, API endpoints, and technical specifics
3. PRESERVE any unresolved issues, bugs, or blockers that are still active
4. PRESERVE the most recent state of each task (latest status, latest code changes)
5. REMOVE redundant information — if the same fact appears multiple times, keep it once
6. REMOVE completed intermediate steps that are no longer relevant
7. REMOVE verbose logs, debug output, and raw data that has already been summarized
8. COMPRESS lengthy descriptions into concise summaries
9. MERGE related sections that cover the same topic
10. Keep the CONTEXT.md format — use markdown headers, bullet points, and code blocks

The optimized context should be roughly 30-50% of the original size while retaining all actionable information.
An agent reading this optimized context should be able to continue working seamlessly.`;

/**
 * Result of a context optimization pass.
 */
export interface OptimizationResult {
  originalTokens: number;
  optimizedTokens: number;
  compressionRatio: number;
  content: string;
}

/**
 * Check if an agent's context needs optimization and run it if needed.
 * Routes to either Memawi's consolidate endpoint or local FAST_MODEL based on MEMAWI_EXTRACT_CONSOLID.
 * Returns null if no optimization was needed.
 */
export async function optimizeIfNeeded(
  agentId: string,
  apiKey: string
): Promise<OptimizationResult | null> {
  const context = await memawi.getAgentContextFile(agentId);

  if (!context || !memawi.isContextOverflow(context, CONTEXT_TOKEN_LIMIT)) {
    return null;
  }

  const originalTokens = memawi.estimateTokens(context);
  console.log(`[ContextOptimizer] Agent ${agentId}: context is ${originalTokens} tokens (limit: ${CONTEXT_TOKEN_LIMIT}), optimizing via ${USE_MEMAWI_EXTRACT ? 'Memawi' : 'local FAST_MODEL'}...`);

  let result: OptimizationResult;

  if (USE_MEMAWI_EXTRACT) {
    result = await optimizeContextViaMemawi(agentId, context);
  } else {
    result = await optimizeContextViaLLM(context, apiKey);
  }

  // Update the agent's context with the optimized version
  await memawi.updateAgentContext(agentId, result.content);

  console.log(`[ContextOptimizer] Agent ${agentId}: ${originalTokens} → ${result.optimizedTokens} tokens (${Math.round(result.compressionRatio * 100)}% reduction)`);

  return result;
}

/**
 * Optimize context using Memawi's consolidate/extract API endpoint.
 */
async function optimizeContextViaMemawi(agentId: string, context: string): Promise<OptimizationResult> {
  const originalTokens = memawi.estimateTokens(context);

  const result = await memawi.consolidateAgentContext(agentId);

  const optimizedTokens = memawi.estimateTokens(result);

  return {
    originalTokens,
    optimizedTokens,
    compressionRatio: originalTokens > 0 ? 1 - optimizedTokens / originalTokens : 0,
    content: result || context,
  };
}

/**
 * Optimize context by calling the Anthropic API to compress it (local FAST_MODEL).
 */
async function optimizeContextViaLLM(context: string, apiKey: string): Promise<OptimizationResult> {
  const client = createAnthropicClient(apiKey);
  const originalTokens = memawi.estimateTokens(context);

  const response = await client.messages.create({
    model: FAST_MODEL,
    max_tokens: 16384,
    system: OPTIMIZER_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Optimize the following agent CONTEXT.md file. Compress it while preserving all critical information, decisions, technical details, and active tasks. Remove redundancy and verbose content.

Return ONLY the optimized CONTEXT.md content, ready to use as a replacement. Do not include any explanation or preamble — just the optimized markdown content.

<context_file>
${context}
</context_file>`,
      },
    ],
  });

  const optimizedContent = response.content
    .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
    .map(block => block.text)
    .join('\n');

  const optimizedTokens = memawi.estimateTokens(optimizedContent);

  return {
    originalTokens,
    optimizedTokens,
    compressionRatio: 1 - optimizedTokens / originalTokens,
    content: optimizedContent,
  };
}

/**
 * Build the full system prompt context block for an agent by combining
 * MEMORY.md, CONTEXT.md, TODO.md, and TaskList.md.
 * Also triggers context optimization if the context is too large.
 */
export async function buildAgentContextBlock(
  agentId: string,
  taskDescription: string,
  apiKey?: string
): Promise<string> {
  const metadata = await memawi.getAgentMetadata(agentId);
  const parts: string[] = [];

  // Long-term memory (always included)
  if (metadata.memory) {
    parts.push(`<long-term-memory>\n${metadata.memory}\n</long-term-memory>`);
  }

  // Current session context (may need optimization)
  if (metadata.context) {
    if (apiKey && memawi.isContextOverflow(metadata.context, CONTEXT_TOKEN_LIMIT)) {
      // Trigger async optimization — don't block the current run
      optimizeIfNeeded(agentId, apiKey).catch(err => {
        console.error(`[ContextOptimizer] Failed to optimize context for ${agentId}:`, err);
      });
    }
    parts.push(`<session-context>\n${metadata.context}\n</session-context>`);
  }

  // TODO and task tracking
  if (metadata.todo) {
    parts.push(`<todo>\n${metadata.todo}\n</todo>`);
  }

  if (metadata.taskList) {
    parts.push(`<task-list>\n${metadata.taskList}\n</task-list>`);
  }

  // Also fetch relevant memories via semantic search
  try {
    const contextResult = await memawi.getContext({
      q: taskDescription,
      agentId,
      tokenLimit: 800,
    });
    if (!contextResult.empty && contextResult.context) {
      parts.push(`<relevant-memories>\n${contextResult.context}\n</relevant-memories>`);
    }
  } catch {
    // Semantic search unavailable — skip
  }

  return parts.length > 0 ? '\n\n' + parts.join('\n\n') : '';
}