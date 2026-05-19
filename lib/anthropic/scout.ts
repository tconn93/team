import Anthropic from '@anthropic-ai/sdk';
import { createAnthropicClient } from './client';
import { createTask, type TaskPriority } from '../tasks';
import { FAST_MODEL } from '../models';

export interface ScoutConfig {
  apiKey: string;
  model?: string;
  codebasePath?: string;
}

export interface ScoutFinding {
  title: string;
  description: string;
  priority: TaskPriority;
  source: 'codebase_scan' | 'todo_comments' | 'test_gaps' | 'performance' | 'feature_idea';
}

/**
 * Feature Scout: Periodically scans the codebase and identifies improvement opportunities.
 * Creates tasks on the board for the orchestrator to dispatch.
 *
 * This agent DOES NOT do the work — it identifies what's worth doing and prioritizes it.
 */
export async function runScout(config: ScoutConfig): Promise<ScoutFinding[]> {
  const client = createAnthropicClient(config.apiKey);
  const model = config.model || FAST_MODEL;

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: `You are a Feature Scout agent. Your job is to analyze a project and identify improvement opportunities.

You have access to the project's current state. Based on the project description, identify:
1. TODO comments or unfinished features that need work
2. Test coverage gaps
3. Performance improvements
4. New feature ideas that would benefit users
5. Code quality improvements

For each finding, provide a clear title, detailed description, and priority level (critical/high/medium/low).

Always use the report_findings tool to output your discoveries.`,
    messages: [
      {
        role: 'user',
        content: `Analyze the following project for improvement opportunities. The project is a Next.js multi-agent orchestration platform called TeamForge that uses Anthropic's Messages API for agent execution.

Key areas to evaluate:
- Missing features or incomplete implementations
- Error handling and resilience improvements
- Performance and scalability concerns
- User experience improvements
- Security considerations
- Testing gaps

Current state: The app has a working agent execution pipeline using Anthropic's Messages API with goal-mode subagents, a task board for persistent work tracking, and real-time SSE streaming. It lacks: persistent storage (uses localStorage), authentication, test coverage, production deployment config, and comprehensive error recovery.

Identify the top 5-8 most impactful improvements and rank them by priority.`,
      },
    ],
    tools: [
      {
        name: 'report_findings',
        description: 'Report your findings as a list of improvement opportunities with priorities.',
        input_schema: {
          type: 'object' as const,
          properties: {
            findings: {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  title: { type: 'string' as const, description: 'Brief title for the improvement' },
                  description: { type: 'string' as const, description: 'Detailed description of what should be done and why' },
                  priority: { type: 'string' as const, enum: ['critical', 'high', 'medium', 'low'] as const, description: 'Priority level' },
                  source: { type: 'string' as const, enum: ['codebase_scan', 'todo_comments', 'test_gaps', 'performance', 'feature_idea'] as const, description: 'Category of finding' },
                },
                required: ['title', 'description', 'priority', 'source'] as const,
              },
              description: 'List of improvement findings',
            },
          },
          required: ['findings'] as const,
        },
      },
    ],
  });

  const findings: ScoutFinding[] = [];

  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === 'report_findings') {
      const input = block.input as { findings: ScoutFinding[] };
      if (input.findings && Array.isArray(input.findings)) {
        findings.push(...input.findings);
      }
    }
  }

  // Write findings to the task board
  for (const finding of findings) {
    await createTask({
      title: finding.title,
      description: finding.description,
      priority: finding.priority,
      createdBy: 'scout',
    });
  }

  return findings;
}

/**
 * Quick scan: generates a small set of high-priority findings without an API call.
 * Used when the scout should run lightweight (e.g., on startup or between full scans).
 */
export async function quickScan(): Promise<ScoutFinding[]> {
  const findings: ScoutFinding[] = [
    {
      title: 'Add persistent database storage',
      description: 'Replace localStorage with a database (SQLite/Postgres) for runs, agents, and API keys. This is needed for production reliability and multi-session persistence.',
      priority: 'high',
      source: 'feature_idea',
    },
    {
      title: 'Add comprehensive error recovery',
      description: 'Implement retry logic for failed API calls, graceful degradation when agents fail mid-task, and automatic task re-queuing when errors occur.',
      priority: 'high',
      source: 'codebase_scan',
    },
    {
      title: 'Add unit and integration tests',
      description: 'Create tests for the Anthropic agent runner, coordinator, task board, and SSE streaming endpoint. Currently no test coverage.',
      priority: 'medium',
      source: 'test_gaps',
    },
  ];

  for (const finding of findings) {
    await createTask({
      title: finding.title,
      description: finding.description,
      priority: finding.priority,
      createdBy: 'scout',
    });
  }

  return findings;
}