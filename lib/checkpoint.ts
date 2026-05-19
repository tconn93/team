/**
 * Agent execution checkpointing for crash recovery and state persistence.
 *
 * Checkpoints save the full conversation state at each iteration of the
 * agent loop. On recovery, an agent can resume from the last checkpoint
 * instead of starting over.
 */

import { getPool } from './db';

export interface Checkpoint {
  id: string;
  runId: string;
  agentId: string;
  iteration: number;
  messages: unknown[];
  systemPrompt: string;
  goal: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  createdAt: Date;
}

/**
 * Save a checkpoint for an agent's execution state.
 * Persists to Postgres if available, otherwise logs only.
 */
export async function saveCheckpoint(checkpoint: Checkpoint): Promise<boolean> {
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO checkpoints (id, run_id, agent_id, iteration, messages, system_prompt, goal, total_input_tokens, total_output_tokens)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (run_id, agent_id, iteration) DO UPDATE SET
         messages = EXCLUDED.messages,
         total_input_tokens = EXCLUDED.total_input_tokens,
         total_output_tokens = EXCLUDED.total_output_tokens`,
      [
        checkpoint.id,
        checkpoint.runId,
        checkpoint.agentId,
        checkpoint.iteration,
        JSON.stringify(checkpoint.messages),
        checkpoint.systemPrompt,
        checkpoint.goal,
        checkpoint.totalInputTokens,
        checkpoint.totalOutputTokens,
      ],
    );
    return true;
  } catch {
    // DB unavailable — checkpoint not persisted, execution continues
    return false;
  }
}

/**
 * Load the latest checkpoint for a given run/agent.
 * Returns null if no checkpoint exists.
 */
export async function loadLatestCheckpoint(
  runId: string,
  agentId: string,
): Promise<Checkpoint | null> {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM checkpoints
       WHERE run_id = $1 AND agent_id = $2
       ORDER BY iteration DESC LIMIT 1`,
      [runId, agentId],
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      runId: row.run_id,
      agentId: row.agent_id,
      iteration: row.iteration,
      messages: typeof row.messages === 'string' ? JSON.parse(row.messages) : row.messages,
      systemPrompt: row.system_prompt,
      goal: row.goal,
      totalInputTokens: row.total_input_tokens || 0,
      totalOutputTokens: row.total_output_tokens || 0,
      createdAt: new Date(row.created_at),
    };
  } catch {
    return null;
  }
}

/**
 * Delete checkpoints for a completed run.
 */
export async function clearCheckpoints(runId: string): Promise<void> {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM checkpoints WHERE run_id = $1', [runId]);
  } catch {
    // DB unavailable — nothing to clear
  }
}