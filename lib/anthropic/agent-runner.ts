import Anthropic from '@anthropic-ai/sdk';
import { createAnthropicClient, getAgentModel } from './client';
import { predefinedAgents } from '../agents';
import type { Agent } from '../types';
import { buildAgentContextBlock } from '../context-optimizer';
import * as memawi from '../memawi';
import { requestApproval, needsApproval } from '../approval';
import { checkToolResult, checkHallucination } from '../guardrails';
import { saveCheckpoint, loadLatestCheckpoint } from '../checkpoint';
import { DEFAULT_SETTINGS } from '../settings';
import { isDbAvailable } from '../db';

// Types for agent events and results
export interface AgentEvent {
  type: 'agent_thinking' | 'tool_call' | 'tool_result' | 'agent_complete' | 'agent_error' | 'tool_approval_request' | 'checkpoint_saved' | 'guardrail_flagged' | 'user_question';
  agentId: string;
  agentName?: string;
  content?: string;
  tool?: string;
  input?: Record<string, unknown>;
  result?: unknown;
  tokens?: { input: number; output: number };
  approval?: { id: string; agentId: string; agentName?: string; tool: string; input: Record<string, unknown> };
  checkpoint?: { runId: string; iteration: number; timestamp: string };
  guardrail?: { type: string; message: string; severity: 'low' | 'medium' | 'high' };
  question?: { id: string; agentId: string; question: string; options?: string[] };
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
  runId?: string;
  maxIterations?: number;
  maxTokens?: number;
  useMemory?: boolean;
  hitlEnabled?: boolean;
  guardrailsEnabled?: boolean;
  checkpointingEnabled?: boolean;
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
 *
 * Optional features (controlled by AgentRunConfig flags):
 * - HITL approval: pause before executing high-impact tools until client approves
 * - Guardrails: validate tool results and final output for hallucination signals
 * - Checkpointing: save conversation state after each iteration for crash recovery
 */
export async function runAgentWithGoal(config: AgentRunConfig): Promise<AgentRunResult> {
  const { agent, goal, apiKey, onEvent } = config;
  const maxIterations = config.maxIterations || 10;
  const maxTokens = config.maxTokens || agent.guardrails?.maxTokens || 4096;
  const model = getAgentModel(agent.model, agent.provider);
  const hitlEnabled = config.hitlEnabled ?? false;
  const guardrailsEnabled = config.guardrailsEnabled ?? false;
  const checkpointingEnabled = config.checkpointingEnabled ?? false;
  const runId = config.runId || `run-${Date.now()}`;

  const client = createAnthropicClient(apiKey);

  // Dynamically import tools to get the right set for this agent
  const { getToolsForAgent } = await import('./tools');
  const { definitions: tools, executors: toolExecutors } = getToolsForAgent(agent.id);

  // Retrieve agent context from Memawi memory if enabled
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

  // Attempt to resume from a checkpoint if checkpointing is enabled
  if (checkpointingEnabled) {
    try {
      if (await isDbAvailable()) {
        const checkpoint = await loadLatestCheckpoint(runId, agent.id);
        if (checkpoint) {
          // Restore conversation state from checkpoint
          const restoredMessages = Array.isArray(checkpoint.messages)
            ? checkpoint.messages as Anthropic.MessageParam[]
            : [];
          if (restoredMessages.length > 0) {
            messages.length = 0;
            messages.push(...restoredMessages);
            totalInputTokens = checkpoint.totalInputTokens;
            totalOutputTokens = checkpoint.totalOutputTokens;
            onEvent?.({
              type: 'agent_thinking',
              agentId: agent.id,
              agentName: agent.name,
              content: `Resumed from checkpoint at iteration ${checkpoint.iteration}`,
            });
          }
        }
      }
    } catch {
      // Checkpoint load failed — start fresh
    }
  }

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

        // Guardrail check on final output
        if (guardrailsEnabled) {
          const guardResult = await checkHallucination(finalText, apiKey, goal);
          if (guardResult.flagged) {
            onEvent?.({
              type: 'guardrail_flagged',
              agentId: agent.id,
              agentName: agent.name,
              content: `Output flagged: ${guardResult.message}`,
              guardrail: { type: guardResult.type || 'hallucination', message: guardResult.message || 'Hallucination detected', severity: guardResult.severity },
            });
          }
        }

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

        // Clear checkpoints on successful completion
        if (checkpointingEnabled) {
          try {
            const { clearCheckpoints } = await import('../checkpoint');
            await clearCheckpoints(runId);
          } catch {
            // Ignore
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
          const toolInput = block.input as Record<string, unknown>;

          onEvent?.({
            type: 'tool_call',
            agentId: agent.id,
            agentName: agent.name,
            tool: block.name,
            input: toolInput,
          });

          // HITL approval gate: if enabled and tool requires approval, pause and wait
          if (hitlEnabled && needsApproval(block.name, agent.guardrails)) {
            try {
              const approvalResult = await requestApproval({
                agentId: agent.id,
                agentName: agent.name,
                tool: block.name,
                input: toolInput,
              });

              // Emit approval request event so SSE clients see it
              onEvent?.({
                type: 'tool_approval_request',
                agentId: agent.id,
                agentName: agent.name,
                content: `Approval ${approvalResult.approved ? 'granted' : 'denied'} for ${block.name}`,
                tool: block.name,
                input: toolInput,
                approval: {
                  id: `approval-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  agentId: agent.id,
                  agentName: agent.name,
                  tool: block.name,
                  input: approvalResult.modifiedInput || toolInput,
                },
              });

              if (!approvalResult.approved) {
                return {
                  type: 'tool_result' as const,
                  tool_use_id: block.id,
                  content: JSON.stringify({ error: 'Tool execution denied by human operator' }),
                };
              }

              // Use modified input if provided
              const effectiveInput = approvalResult.modifiedInput || toolInput;
              const executor = toolExecutors.get(block.name);
              let result: Record<string, unknown>;
              try {
                result = executor ? await executor(effectiveInput) : { error: `Unknown tool: ${block.name}` };
              } catch (error) {
                result = { error: error instanceof Error ? error.message : 'Tool execution failed' };
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
            } catch (error) {
              // Approval request timed out or failed
              return {
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: JSON.stringify({ error: error instanceof Error ? error.message : 'Approval request failed' }),
              };
            }
          }

          // Ask-user tool: emit question event before blocking for response
          if (block.name === 'ask_user') {
            const questionText = (toolInput.question as string) || 'No question provided';
            const options = toolInput.options as string[] | undefined;

            onEvent?.({
              type: 'user_question',
              agentId: agent.id,
              agentName: agent.name,
              content: `Question: ${questionText}`,
              question: {
                id: `question-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                agentId: agent.id,
                question: questionText,
                options,
              },
            });

            // The executor will block until the user responds via /api/run/respond
            const executor = toolExecutors.get('ask_user');
            let result: Record<string, unknown>;
            try {
              result = executor
                ? await executor({ ...toolInput, _agentId: agent.id })
                : { error: 'Unknown tool: ask_user' };
            } catch (error) {
              result = {
                error: error instanceof Error ? error.message : 'Question request failed',
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
          }

          // Standard tool execution (no HITL)
          const executor = toolExecutors.get(block.name);
          let result: Record<string, unknown>;
          try {
            result = executor
              ? await executor(toolInput)
              : { error: `Unknown tool: ${block.name}` };
          } catch (error) {
            result = {
              error: error instanceof Error ? error.message : 'Tool execution failed',
            };
          }

          // Guardrail check on tool result
          if (guardrailsEnabled) {
            const guardResult = await checkToolResult(block.name, toolInput, result, apiKey);
            if (guardResult.flagged) {
              onEvent?.({
                type: 'guardrail_flagged',
                agentId: agent.id,
                agentName: agent.name,
                content: `Tool ${block.name} result flagged: ${guardResult.message}`,
                guardrail: { type: guardResult.type || 'hallucination', message: guardResult.message || 'Hallucination detected', severity: guardResult.severity },
              });
            }
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

      // Save checkpoint after each iteration if checkpointing is enabled
      if (checkpointingEnabled) {
        try {
          if (await isDbAvailable()) {
            const saved = await saveCheckpoint({
              id: `cp-${runId}-${agent.id}-${i}`,
              runId,
              agentId: agent.id,
              iteration: i,
              messages: messages as unknown[],
              systemPrompt,
              goal,
              totalInputTokens,
              totalOutputTokens,
              createdAt: new Date(),
            });
            if (saved) {
              onEvent?.({
                type: 'checkpoint_saved',
                agentId: agent.id,
                agentName: agent.name,
                checkpoint: { runId, iteration: i, timestamp: new Date().toISOString() },
              });
            }
          }
        } catch {
          // Checkpoint save failed — execution continues
        }
      }
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