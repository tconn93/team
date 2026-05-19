import { pickNextTask, updateTask, getTask, listTasks, getBoardStats, type Task } from '../tasks';
import { runAgentWithGoal, type AgentEvent } from './agent-runner';
import { reviewTask } from './reviewer';
import { predefinedAgents } from '../agents';
import * as memawi from '../memawi';
import { updateTaskFilesForAgent, clearTodoOnCompletion } from '../task-files';

export interface LoopConfig {
  apiKey: string;
  maxConcurrent?: number;
  reviewEnabled?: boolean;
  onEvent?: (event: LoopEvent) => void;
}

export interface LoopEvent {
  type: 'task_started' | 'task_completed' | 'task_reviewed' | 'task_failed' | 'loop_idle' | 'loop_error';
  task?: Task;
  result?: string;
  review?: { approved: boolean; quality: number; notes: string };
  error?: string;
  timestamp: string;
}

/**
 * Orchestrator Loop: The always-on engine that picks tasks from the board,
 * dispatches agents, and triggers reviews.
 *
 * Usage:
 *   const loop = new OrchestratorLoop({ apiKey: '...' });
 *   await loop.runCycle();      // Process one task
 *   await loop.runContinuous(); // Keep processing until idle
 */
export class OrchestratorLoop {
  private config: LoopConfig;
  private isRunning = false;

  constructor(config: LoopConfig) {
    this.config = config;
  }

  /**
   * Process the next available task from the board.
   * Returns null if no tasks are available.
   */
  async runCycle(): Promise<Task | null> {
    const task = await pickNextTask();
    if (!task) {
      this.config.onEvent?.({
        type: 'loop_idle',
        timestamp: new Date().toISOString(),
      });
      return null;
    }

    this.config.onEvent?.({
      type: 'task_started',
      task,
      timestamp: new Date().toISOString(),
    });

    // Mark task as in progress
    await updateTask(task.id, { status: 'in_progress' });

    // Find the agent for this task
    const agent = this.getAgentForTask(task);

    // Update TaskList.md and regenerate TODO.md for this agent
    try {
      await updateTaskFilesForAgent(agent.id, agent.name, task, this.config.apiKey);
    } catch {
      // Memawi unavailable — continue without file tracking
    }

    try {
      // Build the goal from the task
      const goal = await this.buildGoalFromTask(task);

      // Run the agent in goal mode
      const result = await runAgentWithGoal({
        agent,
        goal,
        apiKey: this.config.apiKey,
        maxIterations: 10,
        onEvent: (event: AgentEvent) => {
          // Forward agent events to loop subscribers
          this.config.onEvent?.({
            type: event.type === 'agent_complete' ? 'task_completed' : 'task_started',
            task,
            result: event.content,
            timestamp: new Date().toISOString(),
          });
        },
      });

      // Update task with result
      await updateTask(task.id, {
        status: this.config.reviewEnabled ? 'review' : 'done',
        result: result.output,
      });

      // Clear TODO.md now that the task is done
      try {
        await clearTodoOnCompletion(agent.id);
      } catch {
        // Memawi unavailable — skip cleanup
      }

      // Ingest the conversation into Memawi for persistent memory
      try {
        await memawi.ingestConversation({
          messages: [
            { role: 'user', content: goal },
            { role: 'assistant', content: result.output },
          ],
          agentId: agent.id,
        });
      } catch {
        // Memawi unavailable — continue without storing
      }

      this.config.onEvent?.({
        type: 'task_completed',
        task,
        result: result.output,
        timestamp: new Date().toISOString(),
      });

      // Trigger review if enabled
      if (this.config.reviewEnabled) {
        try {
          const review = await reviewTask(task.id, {
            apiKey: this.config.apiKey,
          });

          this.config.onEvent?.({
            type: 'task_reviewed',
            task,
            review: { approved: review.approved, quality: review.quality, notes: review.notes },
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          // Review failed, but task is still completed
          console.error(`Review failed for task ${task.id}:`, error);
        }
      }

      return task;
    } catch (error) {
      await updateTask(task.id, { status: 'backlog' }); // Re-queue for retry
      this.config.onEvent?.({
        type: 'task_failed',
        task,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      return task;
    }
  }

  /**
   * Process tasks continuously until the board is empty.
   * Respects maxConcurrent limit.
   */
  async runContinuous(maxCycles: number = 50): Promise<number> {
    this.isRunning = true;
    let cyclesCompleted = 0;

    while (this.isRunning && cyclesCompleted < maxCycles) {
      const task = await this.runCycle();
      if (!task) break; // No more tasks
      cyclesCompleted++;
    }

    this.isRunning = false;
    return cyclesCompleted;
  }

  /**
   * Stop the continuous loop.
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * Get the current status of the orchestrator and task board.
   */
  async getStatus(): Promise<{ isRunning: boolean; boardStats: Awaited<ReturnType<typeof getBoardStats>> }> {
    return {
      isRunning: this.isRunning,
      boardStats: await getBoardStats(),
    };
  }

  private getAgentForTask(task: Task) {
    // If task has an assigned agent, use it
    if (task.assignedAgent) {
      const agent = predefinedAgents.find(a => a.id === task.assignedAgent);
      if (agent) return agent;
    }

    // Otherwise, pick based on task keywords
    const desc = task.description.toLowerCase() + ' ' + task.title.toLowerCase();

    if (desc.includes('brainstorm') || desc.includes('ideate') || desc.includes('feature idea') || desc.includes('analyze project') || desc.includes('improvement opportunity')) {
      return predefinedAgents.find(a => a.id === 'brainstormer') || predefinedAgents[5];
    }
    if (desc.includes('research') || desc.includes('market') || desc.includes('competitor')) {
      return predefinedAgents.find(a => a.id === 'researcher') || predefinedAgents[1];
    }
    if (desc.includes('financial') || desc.includes('data') || desc.includes('analy') || desc.includes('calculation')) {
      return predefinedAgents.find(a => a.id === 'analyst') || predefinedAgents[2];
    }
    if (desc.includes('write') || desc.includes('strategy') || desc.includes('content') || desc.includes('document')) {
      return predefinedAgents.find(a => a.id === 'writer') || predefinedAgents[3];
    }
    if (desc.includes('chart') || desc.includes('visual') || desc.includes('image') || desc.includes('design')) {
      return predefinedAgents.find(a => a.id === 'visualizer') || predefinedAgents[4];
    }

    // Default: use the brainstormer for open-ended tasks
    return predefinedAgents.find(a => a.id === 'brainstormer') || predefinedAgents[5];
  }

  private async buildGoalFromTask(task: Task): Promise<string> {
    let goal = `## Task: ${task.title}\n\n${task.description}`;

    // Include parent task context if available
    if (task.parentTaskId) {
      const parent = task.parentTaskId ? await getTask(task.parentTaskId) : null;
      if (parent) {
        goal += `\n\nParent context: ${parent.title} — ${parent.description}`;
      }
      goal += `\n\nThis is a follow-up task. Focus on the specific improvement or fix described above.`;
    }

    goal += '\n\nComplete this task thoroughly. Use your available tools as needed. Provide a clear, detailed response.';
    return goal;
  }
}

/**
 * Convenience function: run a single orchestrator cycle.
 */
export async function runOneCycle(apiKey: string): Promise<Task | null> {
  const loop = new OrchestratorLoop({ apiKey });
  return loop.runCycle();
}

/**
 * Convenience function: seed the board with initial tasks from the feature scout.
 */
export { quickScan, runScout } from './scout';