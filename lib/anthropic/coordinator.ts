import Anthropic from '@anthropic-ai/sdk';
import { createAnthropicClient } from './client';
import { runAgentWithGoal, type AgentEvent } from './agent-runner';
import { predefinedAgents } from '../agents';
import type { Subtask, Agent } from '../types';
import { DEFAULT_MODEL } from '../models';

// The coordinator's planning tool
const createPlanTool: Anthropic.Tool = {
  name: 'create_execution_plan',
  description:
    'Create a structured execution plan for a user goal. Break the goal into specific subtasks and assign each to the most appropriate specialized agent. Consider dependencies between tasks.',
  input_schema: {
    type: 'object' as const,
    properties: {
      subtasks: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            id: {
              type: 'string' as const,
              description: 'Unique identifier for this subtask (e.g., "t1", "t2")',
            },
            title: {
              type: 'string' as const,
              description: 'Brief, descriptive title for this subtask',
            },
            description: {
              type: 'string' as const,
              description: 'Detailed description of what needs to be accomplished and what output is expected',
            },
            assignedAgent: {
              type: 'string' as const,
              description: 'ID of the agent to assign this subtask to. Available agents: ' +
                predefinedAgents.map(a => `${a.id} (${a.role})`).join(', '),
            },
            dependencies: {
              type: 'array' as const,
              items: { type: 'string' as const },
              description: 'IDs of subtasks that must be completed before this one can start',
            },
          },
          required: ['id', 'title', 'description', 'assignedAgent'],
        },
        description: 'Ordered list of subtasks to execute',
      },
      strategy: {
        type: 'string' as const,
        description: 'Brief description of the overall strategy for accomplishing the goal',
      },
    },
    required: ['subtasks'],
  },
};

export interface PlanSubtask {
  id: string;
  title: string;
  description: string;
  assignedAgent: string;
  dependencies?: string[];
}

export interface MissionPlan {
  id: string;
  goal: string;
  strategy?: string;
  subtasks: PlanSubtask[];
}

export interface MissionResult {
  plan: MissionPlan;
  results: Record<string, { success: boolean; output: string }>;
  summary: string;
  deliverables: { type: string; title: string }[];
  totalTokens: { input: number; output: number };
}

export class Coordinator {
  private apiKey: string;
  private hitlEnabled: boolean;
  private guardrailsEnabled: boolean;
  private checkpointingEnabled: boolean;

  constructor(apiKey: string, settings?: { hitlEnabled?: boolean; guardrailsEnabled?: boolean; checkpointingEnabled?: boolean }) {
    this.apiKey = apiKey;
    this.hitlEnabled = settings?.hitlEnabled ?? false;
    this.guardrailsEnabled = settings?.guardrailsEnabled ?? false;
    this.checkpointingEnabled = settings?.checkpointingEnabled ?? false;
  }

  /**
   * Run the full mission: plan → delegate → synthesize
   */
  async runMission(
    goal: string,
    onEvent: (event: AgentEvent) => void
  ): Promise<MissionResult> {
    const client = createAnthropicClient(this.apiKey);

    // Phase 1: Generate execution plan
    onEvent({
      type: 'agent_thinking',
      agentId: 'coordinator',
      agentName: 'Coordinator',
      content: `Analyzing goal: "${goal.substring(0, 80)}..." and creating execution plan.`,
    });

    const plan = await this.generatePlan(client, goal);

    onEvent({
      type: 'agent_complete',
      agentId: 'coordinator',
      agentName: 'Coordinator',
      content: `Plan created with ${plan.subtasks.length} subtasks. Deploying agents...`,
    });

    // Phase 2: Execute subtasks respecting dependencies
    const results: Record<string, { success: boolean; output: string }> = {};
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Group tasks by dependency level for parallel execution
    const levels = this.groupByDependencyLevel(plan.subtasks);

    for (const level of levels) {
      // Run tasks in this level in parallel
      const promises = level.map(async (task) => {
        const agent = this.getAgentForTask(task.assignedAgent);
        if (!agent) {
          onEvent({
            type: 'agent_error',
            agentId: task.assignedAgent,
            content: `Unknown agent: ${task.assignedAgent}`,
          });
          results[task.id] = { success: false, output: `Unknown agent: ${task.assignedAgent}` };
          return;
        }

        // Build the subtask goal with context from dependency results
        const taskGoal = this.buildTaskGoal(task, results);

        onEvent({
          type: 'agent_thinking',
          agentId: agent.id,
          agentName: agent.name,
          content: `Starting task: "${task.title}"`,
        });

        const result = await runAgentWithGoal({
          agent,
          goal: taskGoal,
          apiKey: this.apiKey,
          runId: `mission-${Date.now()}`,
          maxIterations: 8,
          hitlEnabled: this.hitlEnabled,
          guardrailsEnabled: this.guardrailsEnabled,
          checkpointingEnabled: this.checkpointingEnabled,
          onEvent,
        });

        totalInputTokens += result.inputTokens;
        totalOutputTokens += result.outputTokens;
        results[task.id] = { success: result.success, output: result.output };
      });

      await Promise.all(promises);
    }

    // Phase 3: Synthesize final results
    const summary = await this.synthesize(client, goal, plan, results);

    onEvent({
      type: 'agent_complete',
      agentId: 'coordinator',
      agentName: 'Coordinator',
      content: summary,
    });

    return {
      plan,
      results,
      summary,
      deliverables: this.extractDeliverables(results),
      totalTokens: { input: totalInputTokens, output: totalOutputTokens },
    };
  }

  /**
   * Use Anthropic Messages API to generate a structured execution plan.
   * The coordinator calls the create_execution_plan tool with the plan.
   */
  private async generatePlan(client: Anthropic, goal: string): Promise<MissionPlan> {
    const agentList = predefinedAgents
      .map(a => `- ${a.id}: ${a.role}. Skills: ${a.skills.join(', ')}. Tools: ${a.tools.join(', ')}`)
      .join('\n');

    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: `You are the Coordinator Agent. Your job is to break down complex user goals into structured execution plans with specific subtasks assigned to the right specialized agents.

Available agents:
${agentList}

Create a detailed, actionable plan. Each subtask should be clear enough that an agent can work on it autonomously. Consider dependencies between tasks — if one task needs the output of another, mark it as a dependency.

Always use the create_execution_plan tool to output your plan.`,
      messages: [
        {
          role: 'user',
          content: goal,
        },
      ],
      tools: [createPlanTool],
    });

    // Extract the plan from the tool call
    for (const block of response.content) {
      if (block.type === 'tool_use' && block.name === 'create_execution_plan') {
        const input = block.input as {
          subtasks: PlanSubtask[];
          strategy?: string;
        };
        return {
          id: `plan-${Date.now()}`,
          goal,
          strategy: input.strategy,
          subtasks: input.subtasks.map((s) => ({
            ...s,
            status: 'pending' as const,
            estimatedTime: 15 + Math.floor(Math.random() * 20),
          })),
        };
      }
    }

    // Fallback: if no tool call, create a default plan
    return {
      id: `plan-${Date.now()}`,
      goal,
      subtasks: [
        {
          id: 't1',
          title: 'Research & Analysis',
          description: goal,
          assignedAgent: 'researcher',
        },
        {
          id: 't2',
          title: 'Detailed Analysis',
          description: `Perform detailed analysis based on: ${goal}`,
          assignedAgent: 'analyst',
          dependencies: ['t1'],
        },
        {
          id: 't3',
          title: 'Strategy & Recommendations',
          description: `Develop strategy and recommendations for: ${goal}`,
          assignedAgent: 'writer',
          dependencies: ['t2'],
        },
      ],
    };
  }

  /**
   * Build a goal for a specific subtask, including context from completed dependencies.
   */
  private buildTaskGoal(task: PlanSubtask, results: Record<string, { success: boolean; output: string }>): string {
    let goal = `## Task: ${task.title}\n\n${task.description}`;

    // Include results from dependency tasks as context
    if (task.dependencies && task.dependencies.length > 0) {
      goal += '\n\n## Context from previous work:\n';
      for (const depId of task.dependencies) {
        const depResult = results[depId];
        if (depResult) {
          const truncated = depResult.output.substring(0, 2000);
          goal += `\n### Results from ${depId}:\n${truncated}${depResult.output.length > 2000 ? '...' : ''}\n`;
        }
      }
    }

    goal += '\n\nComplete this task thoroughly. Use your available tools as needed. Provide a clear, detailed response.';
    return goal;
  }

  /**
   * Group tasks by dependency level for parallel execution.
   * Tasks with no dependencies run first, then tasks whose dependencies are met run next, etc.
   */
  private groupByDependencyLevel(subtasks: PlanSubtask[]): PlanSubtask[][] {
    const levels: PlanSubtask[][] = [];
    const completed = new Set<string>();

    while (completed.size < subtasks.length) {
      const level = subtasks.filter((task) => {
        if (completed.has(task.id)) return false;
        const deps = task.dependencies || [];
        return deps.every((dep) => completed.has(dep));
      });

      if (level.length === 0) {
        // Circular dependency or error — add remaining tasks
        const remaining = subtasks.filter((t) => !completed.has(t.id));
        levels.push(remaining);
        break;
      }

      levels.push(level);
      level.forEach((t) => completed.add(t.id));
    }

    return levels;
  }

  /**
   * Get the agent definition for a task assignment.
   */
  private getAgentForTask(agentId: string): Agent | undefined {
    return predefinedAgents.find((a) => a.id === agentId);
  }

  /**
   * Use Anthropic Messages API to synthesize all results into a final summary.
   */
  private async synthesize(
    client: Anthropic,
    goal: string,
    plan: MissionPlan,
    results: Record<string, { success: boolean; output: string }>
  ): Promise<string> {
    const resultsSummary = plan.subtasks
      .map((task) => {
        const result = results[task.id];
        return `### ${task.title} (${task.assignedAgent})\n${result ? result.output.substring(0, 1500) : 'No results'}`;
      })
      .join('\n\n');

    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 2048,
      system:
        'You are the Coordinator Agent synthesizing the final results of a multi-agent mission. Create a comprehensive but concise summary highlighting key findings, deliverables, and actionable recommendations.',
      messages: [
        {
          role: 'user',
          content: `## Original Goal\n${goal}\n\n## Agent Results\n${resultsSummary}\n\nSynthesize these results into a clear, actionable summary with key findings and recommendations.`,
        },
      ],
    });

    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((b) => b.text)
      .join('\n');
  }

  /**
   * Extract deliverable types from results.
   */
  private extractDeliverables(
    results: Record<string, { success: boolean; output: string }>
  ): { type: string; title: string }[] {
    const deliverables: { type: string; title: string }[] = [];

    for (const [taskId, result] of Object.entries(results)) {
      const task = predefinedAgents.find((a) => a.id === taskId);
      if (!result.success) continue;

      if (result.output.includes('chart') || result.output.includes('projection') || result.output.includes('financial')) {
        deliverables.push({ type: 'chart', title: `${taskId} Analysis` });
      }
      if (result.output.includes('research') || result.output.includes('market') || result.output.includes('competitor')) {
        deliverables.push({ type: 'report', title: `${taskId} Research Report` });
      }
      if (result.output.includes('strategy') || result.output.includes('plan') || result.output.includes('recommendation')) {
        deliverables.push({ type: 'report', title: `${taskId} Strategy` });
      }
    }

    if (deliverables.length === 0) {
      deliverables.push(
        { type: 'report', title: 'Complete Mission Report' },
        { type: 'chart', title: 'Analysis Summary' }
      );
    }

    return deliverables;
  }
}