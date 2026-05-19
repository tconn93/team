import Anthropic from '@anthropic-ai/sdk';
import { createAnthropicClient, getAgentModel } from './client';
import { predefinedAgents } from '../agents';
import type { Agent } from '../types';
import { buildAgentContextBlock } from '../context-optimizer';
import * as memawi from '../memawi';

// Types for agent events and results
export interface AgentEvent {
  type: 'agent_thinking' | 'tool_call' | 'tool_result' | 'agent_complete' | 'agent_error';
  agentId: string;
  agentName?: string;
  content?: string;
  tool?: string;
  input?: Record<string, unknown>;
  result?: unknown;
  tokens?: { input: number; output: number };
}

export interface AgentRunResult {
  success: boolean;
  output: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AgentRunConfig {
  agent: Agent;
  goal: string;
  apiKey: string;
  maxIterations?: number;
  maxTokens?: number;
  useMemory?: boolean;
  onEvent?: (event: AgentEvent) => void;
}

/**
 * Run an agent in "goal mode" — the autonomous agentic loop.
 * This is the core of how each subagent works like Claude Code:
 * 1. Receive a goal
 * 2. Call Anthropic Messages API with available tools
 * 3. If the response contains tool_use, execute tools and feed results back
 * 4. Loop until the agent produces a final text response (stop_reason: end_turn)
 * 5. Return the final result
 */
export async function runAgentWithGoal(config: AgentRunConfig): Promise<AgentRunResult> {
  const { agent, goal, apiKey, onEvent } = config;
  const maxIterations = config.maxIterations || 10;
  const maxTokens = config.maxTokens || agent.guardrails?.maxTokens || 4096;
  const model = getAgentModel(agent.model, agent.provider);

  const client = createAnthropicClient(apiKey);

  // Dynamically import tools to get the right set for this agent
  const { getToolsForAgent } = await import('./tools');
  const { definitions: tools, executors: toolExecutors } = getToolsForAgent(agent.id);

  // Retrieve agent context from Memawi memory if enabled
  // This includes MEMORY.md (long-term), CONTEXT.md (session), TODO.md, and TaskList.md
  let contextPrefix = '';
  if (config.useMemory !== false) {
    try {
      contextPrefix = await buildAgentContextBlock(agent.id, goal, apiKey);
    } catch {
      // Memawi unavailable — continue without memory context
    }
  }

  // Build the initial conversation
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: goal,
    },
  ];

  // Augment the system prompt with memory context
  const systemPrompt = agent.systemPrompt + contextPrefix;

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  onEvent?.({
    type: 'agent_thinking',
    agentId: agent.id,
    agentName: agent.name,
    content: `Starting goal: "${goal.substring(0, 100)}${goal.length > 100 ? '...' : ''}"`,
  });

  for (let i = 0; i < maxIterations; i++) {
    try {
      onEvent?.({
        type: 'agent_thinking',
        agentId: agent.id,
        agentName: agent.name,
        content: `Iteration ${i + 1}: Analyzing and deciding next action...`,
      });

      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
        tools: tools.length > 0 ? tools : undefined,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      // Check if the agent is done (no tool use, end_turn)
      const hasToolUse = response.content.some(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      if (!hasToolUse) {
        // Agent has completed — extract final text
        const textBlocks = response.content.filter(
          (block): block is Anthropic.TextBlock => block.type === 'text'
        );
        const finalText = textBlocks.map(b => b.text).join('\n');

        onEvent?.({
          type: 'agent_complete',
          agentId: agent.id,
          agentName: agent.name,
          content: finalText,
          tokens: { input: totalInputTokens, output: totalOutputTokens },
        });

        // Store the task result in Memawi memory for future context
        if (config.useMemory !== false) {
          try {
            await memawi.rememberTaskResult({
              agentId: agent.id,
              taskTitle: goal.substring(0, 100),
              result: finalText,
            });
          } catch {
            // Memawi unavailable — continue without storing
          }
        }

        return {
          success: true,
          output: finalText,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        };
      }

      // Add assistant response to conversation
      messages.push({
        role: 'assistant',
        content: response.content,
      });

      // Process tool calls — execute independent calls in parallel
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      if (toolUseBlocks.length > 0) {
        // Execute all tool calls in parallel
        const executionPromises = toolUseBlocks.map(async (block) => {
          onEvent?.({
            type: 'tool_call',
            agentId: agent.id,
            agentName: agent.name,
            tool: block.name,
            input: block.input as Record<string, unknown>,
          });

          const executor = toolExecutors.get(block.name);
          let result: Record<string, unknown>;
          try {
            result = executor
              ? await executor(block.input as Record<string, unknown>)
              : { error: `Unknown tool: ${block.name}` };
          } catch (error) {
            result = {
              error: error instanceof Error ? error.message : 'Tool execution failed',
            };
          }

          onEvent?.({
            type: 'tool_result',
            agentId: agent.id,
            agentName: agent.name,
            tool: block.name,
            result,
          });

          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: typeof result === 'string' ? result : JSON.stringify(result),
          };
        });

        const results = await Promise.all(executionPromises);
        toolResults.push(...results);
      }

      // Add tool results to conversation
      messages.push({
        role: 'user',
        content: toolResults,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during agent execution';
      onEvent?.({
        type: 'agent_error',
        agentId: agent.id,
        agentName: agent.name,
        content: `Error: ${errorMessage}`,
      });

      return {
        success: false,
        output: `Agent error: ${errorMessage}`,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      };
    }
  }

  // Max iterations reached
  onEvent?.({
    type: 'agent_complete',
    agentId: agent.id,
    agentName: agent.name,
    content: 'Maximum iterations reached. Returning partial results.',
    tokens: { input: totalInputTokens, output: totalOutputTokens },
  });

  return {
    success: false,
    output: 'Maximum iterations reached without completing the task.',
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
  };
}