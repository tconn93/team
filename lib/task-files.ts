import { listTasks, type Task } from './tasks';
import { createAnthropicClient } from './anthropic/client';
import { FAST_MODEL } from './models';
import * as memawi from './memawi';

/**
 * Build TaskList.md content for an agent.
 *
 * Format:
 *   # TaskList — {agentName}
 *
 *   ## Current Task (IN PROGRESS)
 *   - [task id] Task title — description excerpt
 *
 *   ## Queued Tasks
 *   - [task id] Task title (priority)
 *
 *   ## Completed
 *   - [task id] Task title ✓
 */
export function buildTaskListContent(
  currentTask: Task | null,
  allTasks: Task[],
  agentName: string
): string {
  const lines: string[] = [`# TaskList — ${agentName}`, ''];

  if (currentTask) {
    lines.push('## Current Task (IN PROGRESS)');
    lines.push(`- [${currentTask.id}] **${currentTask.title}** (${currentTask.priority})`);
    if (currentTask.description) {
      const desc = currentTask.description.length > 200
        ? currentTask.description.substring(0, 200) + '...'
        : currentTask.description;
      lines.push(`  ${desc}`);
    }
    lines.push('');
  }

  const queued = allTasks.filter(t => t.status === 'backlog' && t.id !== currentTask?.id);
  if (queued.length > 0) {
    lines.push('## Queued Tasks');
    for (const t of queued) {
      lines.push(`- [${t.id}] ${t.title} (${t.priority})`);
    }
    lines.push('');
  }

  const inProgress = allTasks.filter(t => t.status === 'in_progress' && t.id !== currentTask?.id);
  if (inProgress.length > 0) {
    lines.push('## In Progress (Other Agents)');
    for (const t of inProgress) {
      lines.push(`- [${t.id}] ${t.title} — ${t.assignedAgent || 'unassigned'}`);
    }
    lines.push('');
  }

  const done = allTasks.filter(t => t.status === 'done').slice(0, 10);
  if (done.length > 0) {
    lines.push('## Completed');
    for (const t of done) {
      lines.push(`- [${t.id}] ${t.title} ✓`);
    }
    lines.push('');
  }

  lines.push(`_Last updated: ${new Date().toISOString()}_`);
  return lines.join('\n');
}

/**
 * Use the AI to break down a task into smaller achievable TODO items.
 * Returns the markdown content for TODO.md.
 */
export async function breakDownTaskToTodo(
  task: Task,
  apiKey: string
): Promise<string> {
  const client = createAnthropicClient(apiKey);

  const response = await client.messages.create({
    model: FAST_MODEL,
    max_tokens: 2048,
    system: `You are a task decomposition agent. Given a task, break it down into 3-8 concrete, achievable TODO items.

Rules:
- Each item should be a specific, actionable step
- Order items by execution sequence
- Use checkbox format: - [ ] Item description
- Be concise — one line per item
- Include a brief "Done criteria" for each item when helpful
- Do NOT include any preamble, just the TODO list starting with the header

Format:
# TODO — {task title}

- [ ] First step
- [ ] Second step
...`,
    messages: [
      {
        role: 'user',
        content: `Break down this task into achievable steps:\n\n## ${task.title}\n\n${task.description}\n\nPriority: ${task.priority}${task.assignedAgent ? `\nAssigned to: ${task.assignedAgent}` : ''}`,
      },
    ],
  });

  const textBlocks = response.content.filter(
    (block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text'
  );
  return textBlocks.map(b => b.text).join('\n').trim();
}

/**
 * Generate a blank TODO.md for a task (used when we can't reach the AI).
 */
export function buildBlankTodo(task: Task): string {
  return [
    `# TODO — ${task.title}`,
    '',
    `- [ ] ${task.description.split('\n')[0] || task.title}`,
    `- [ ] Complete implementation`,
    `- [ ] Verify results`,
    '',
    `_Created: ${new Date().toISOString()}_`,
  ].join('\n');
}

/**
 * Update both TaskList.md and TODO.md for an agent when a task starts.
 *
 * - TaskList.md gets the full task board state with the current task marked as IN PROGRESS
 * - TODO.md gets wiped and regenerated with a broken-down version of the current task
 */
export async function updateTaskFilesForAgent(
  agentId: string,
  agentName: string,
  currentTask: Task,
  apiKey: string
): Promise<void> {
  // Fetch all tasks for the task list
  const allTasks = await listTasks();

  // Build and write TaskList.md
  const taskListContent = buildTaskListContent(currentTask, allTasks, agentName);
  await memawi.updateAgentTaskList(agentId, taskListContent);

  // Wipe TODO.md and regenerate with task breakdown
  let todoContent: string;
  try {
    todoContent = await breakDownTaskToTodo(currentTask, apiKey);
  } catch {
    // AI breakdown failed — use a simple template
    todoContent = buildBlankTodo(currentTask);
  }
  await memawi.updateAgentTodoFile(agentId, todoContent);
}

/**
 * Clear the TODO.md when a task completes (agent goes idle).
 */
export async function clearTodoOnCompletion(agentId: string): Promise<void> {
  await memawi.updateAgentTodoFile(agentId, [
    '# TODO',
    '',
    '_No active task. Awaiting next assignment._',
    '',
    `_Cleared: ${new Date().toISOString()}_`,
  ].join('\n'));
}