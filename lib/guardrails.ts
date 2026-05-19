/**
 * Hallucination guardrails for agent output validation.
 *
 * When enabled, tool results and final outputs are checked for common
 * hallucination signals using a lightweight FAST_MODEL call. This adds
 * minimal latency (one short inference per check) and catches the most
 * common failure modes before they propagate.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createAnthropicClient } from './anthropic/client';
import { FAST_MODEL } from './models';

export interface GuardrailResult {
  flagged: boolean;
  type?: string;
  message?: string;
  severity: 'low' | 'medium' | 'high';
}

const GUARDRAIL_SYSTEM = `You are a hallucination detector for an AI agent system. Analyze the given content and determine if it exhibits any of these hallucination signals:

1. **Fabricated facts**: Claims presented as facts that are likely made up (fake URLs, nonexistent tools/APIs, invented statistics)
2. **Confident falsehoods**: Statements presented with high confidence that are clearly wrong or misleading
3. **Tool hallucination**: Claims about calling tools or APIs that don't exist or producing outputs those tools cannot generate
4. **Circular reasoning**: Output that loops back to the original input without adding real progress

Respond with JSON only:
- If no hallucination detected: {"flagged": false}
- If hallucination detected: {"flagged": true, "type": "<category>", "message": "<brief description>", "severity": "<low|medium|high>""}

Be conservative — only flag clear hallucinations, not uncertain or low-confidence outputs.`;

/**
 * Check agent output for hallucination signals.
 * Returns a result indicating whether the content was flagged.
 */
export async function checkHallucination(
  content: string,
  apiKey?: string,
  context?: string,
): Promise<GuardrailResult> {
  if (!content || content.length < 20) {
    return { flagged: false, severity: 'low' };
  }

  const client = createAnthropicClient(apiKey);

  const userMessage = context
    ? `Context: ${context.substring(0, 500)}\n\nContent to check: ${content.substring(0, 2000)}`
    : `Content to check: ${content.substring(0, 2000)}`;

  try {
    const response = await client.messages.create({
      model: FAST_MODEL,
      max_tokens: 200,
      system: GUARDRAIL_SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    if (!textBlock) {
      return { flagged: false, severity: 'low' };
    }

    const parsed = JSON.parse(textBlock.text);
    return {
      flagged: parsed.flagged ?? false,
      type: parsed.type,
      message: parsed.message,
      severity: parsed.severity ?? 'low',
    };
  } catch {
    // If guardrail check fails, don't block the agent — log and continue
    return { flagged: false, severity: 'low' };
  }
}

/**
 * Quick sanity check for tool results — verifies the result
 * doesn't contain obvious fabrications like fake file paths,
 * impossible command outputs, or hallucinated API responses.
 */
export async function checkToolResult(
  tool: string,
  input: Record<string, unknown>,
  result: Record<string, unknown>,
  apiKey?: string,
): Promise<GuardrailResult> {
  // Skip guardrail for read-only tools that rarely hallucinate
  const readOnlyTools = ['file_read', 'glob', 'grep', 'list_directory', 'remember', 'recall', 'web_search', 'web_fetch', 'ask_user', 'analyze_data'];
  if (readOnlyTools.includes(tool)) {
    return { flagged: false, severity: 'low' };
  }

  const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
  if (resultStr.length < 10) {
    return { flagged: false, severity: 'low' };
  }

  const context = `Tool: ${tool}\nInput: ${JSON.stringify(input).substring(0, 500)}`;
  return checkHallucination(resultStr, apiKey, context);
}