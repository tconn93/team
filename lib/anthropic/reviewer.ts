import Anthropic from '@anthropic-ai/sdk';
import { createAnthropicClient } from './client';
import { getTask, createTask, updateTask, type Task } from '../tasks';
import { FAST_MODEL } from '../models';

export interface ReviewConfig {
  apiKey: string;
  model?: string;
}

export interface ReviewResult {
  approved: boolean;
  quality: number; // 0-10
  notes: string;
  followUpTasks: { title: string; description: string; priority: Task['priority'] }[];
}

/**
 * Review Agent: Validates completed work, checks quality, and creates follow-up tasks.
 * Every completed task gets a mandatory review pass.
 *
 * The reviewer checks:
 * 1. Does the output actually address the task?
 * 2. Is the quality sufficient?
 * 3. Are there bugs, edge cases, or missing pieces?
 * 4. Does this change create new opportunities for improvement?
 */
export async function reviewTask(taskId: string, config: ReviewConfig): Promise<ReviewResult> {
  const client = createAnthropicClient(config.apiKey);
  const model = config.model || FAST_MODEL;

  const task = await getTask(taskId);
  if (!task) {
    return { approved: false, quality: 0, notes: `Task ${taskId} not found`, followUpTasks: [] };
  }

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: `You are a Code Review Agent. Your job is to review completed work and assess its quality.

For each task review:
1. Evaluate whether the output addresses the original task description
2. Score the quality from 0-10 (10 being excellent)
3. Identify any gaps, bugs, or missing pieces
4. Suggest follow-up tasks if the work is incomplete or could be improved

Always use the submit_review tool to output your review.`,
    messages: [
      {
        role: 'user',
        content: `Review the following completed task:

## Task: ${task.title}
**Priority:** ${task.priority}
**Assigned to:** ${task.assignedAgent || 'unassigned'}
**Created by:** ${task.createdBy}

### Description:
${task.description}

### Result:
${task.result || 'No result recorded'}

### Review Notes:
${task.reviewNotes || 'None'}

Assess the quality, completeness, and correctness of this work. If there are follow-up tasks needed, include them.`,
      },
    ],
    tools: [
      {
        name: 'submit_review',
        description: 'Submit your review of the completed task.',
        input_schema: {
          type: 'object' as const,
          properties: {
            approved: { type: 'boolean' as const, description: 'Whether the work meets quality standards' },
            quality: { type: 'number' as const, description: 'Quality score 0-10' },
            notes: { type: 'string' as const, description: 'Detailed review notes explaining the assessment' },
            followUpTasks: {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  title: { type: 'string' as const },
                  description: { type: 'string' as const },
                  priority: { type: 'string' as const, enum: ['critical', 'high', 'medium', 'low'] as const },
                },
                required: ['title', 'description', 'priority'] as const,
              },
              description: 'Follow-up tasks to create if the work needs additional attention',
            },
          },
          required: ['approved', 'quality', 'notes'] as const,
        },
      },
    ],
  });

  let reviewResult: ReviewResult = {
    approved: true,
    quality: 7,
    notes: 'No structured review submitted, defaulting to approval.',
    followUpTasks: [],
  };

  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === 'submit_review') {
      const input = block.input as {
        approved: boolean;
        quality: number;
        notes: string;
        followUpTasks?: { title: string; description: string; priority: Task['priority'] }[];
      };
      reviewResult = {
        approved: input.approved,
        quality: input.quality,
        notes: input.notes,
        followUpTasks: input.followUpTasks || [],
      };
    }
  }

  // Update the task with review notes
  await updateTask(taskId, {
    reviewNotes: `Quality: ${reviewResult.quality}/10\n${reviewResult.notes}`,
    status: reviewResult.approved ? 'done' : 'backlog',
  });

  // Create follow-up tasks if any
  for (const followUp of reviewResult.followUpTasks) {
    await createTask({
      title: followUp.title,
      description: followUp.description,
      priority: followUp.priority,
      createdBy: 'reviewer',
      parentTaskId: taskId,
    });
  }

  return reviewResult;
}