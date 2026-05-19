import { getPool, isDbAvailable, initSchema } from './db';
import type { Run, AgentMessage } from './types';

let dbReady = false;
let dbChecked = false;

async function ensureDb(): Promise<boolean> {
  if (dbChecked) return dbReady;
  dbChecked = true;
  try {
    dbReady = await isDbAvailable();
    if (dbReady) {
      await initSchema();
      console.log('[Runs] Using Postgres storage');
    } else {
      console.log('[Runs] Postgres unavailable, runs not persisted to DB');
    }
  } catch {
    dbReady = false;
  }
  return dbReady;
}

function messageToRow(msg: AgentMessage) {
  return {
    id: msg.id,
    agent_id: msg.agentId,
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
    tool_calls: msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
    output: msg.output ? JSON.stringify(msg.output) : null,
  };
}

function rowToMessage(row: Record<string, unknown>): AgentMessage {
  return {
    id: row.id as string,
    agentId: row.agent_id as string,
    role: row.role as AgentMessage['role'],
    content: row.content as string,
    timestamp: new Date(row.timestamp as string),
    toolCalls: row.tool_calls ? JSON.parse(row.tool_calls as string) : undefined,
    output: row.output ? JSON.parse(row.output as string) : undefined,
  };
}

/**
 * Save a run to Postgres.
 */
export async function saveRun(run: Run): Promise<void> {
  if (!await ensureDb()) return;

  const pool = getPool();
  await pool.query(
    `INSERT INTO runs (id, goal, status, plan, messages, agents_used, cost, duration, created_at, outputs)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status,
       plan = EXCLUDED.plan,
       messages = EXCLUDED.messages,
       agents_used = EXCLUDED.agents_used,
       cost = EXCLUDED.cost,
       duration = EXCLUDED.duration,
       outputs = EXCLUDED.outputs`,
    [
      run.id,
      run.goal,
      run.status,
      run.plan ? JSON.stringify(run.plan) : null,
      JSON.stringify(run.messages.map(messageToRow)),
      run.agentsUsed,
      run.cost,
      run.duration,
      run.createdAt instanceof Date ? run.createdAt.toISOString() : run.createdAt,
      run.outputs ? JSON.stringify(run.outputs) : null,
    ]
  );
}

/**
 * Get a run by ID from Postgres.
 */
export async function getRun(id: string): Promise<Run | null> {
  if (!await ensureDb()) return null;

  const result = await getPool().query('SELECT * FROM runs WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    goal: row.goal,
    status: row.status,
    plan: row.plan ? JSON.parse(row.plan) : undefined,
    messages: JSON.parse(row.messages).map(rowToMessage),
    agentsUsed: row.agents_used,
    cost: parseFloat(row.cost),
    duration: row.duration,
    createdAt: new Date(row.created_at),
    outputs: row.outputs ? JSON.parse(row.outputs) : undefined,
  };
}

/**
 * List all runs from Postgres, most recent first.
 */
export async function listRuns(limit = 50): Promise<Run[]> {
  if (!await ensureDb()) return [];

  const result = await getPool().query(
    'SELECT * FROM runs ORDER BY created_at DESC LIMIT $1',
    [limit]
  );

  return result.rows.map(row => ({
    id: row.id,
    goal: row.goal,
    status: row.status,
    plan: row.plan ? JSON.parse(row.plan) : undefined,
    messages: JSON.parse(row.messages).map(rowToMessage),
    agentsUsed: row.agents_used,
    cost: parseFloat(row.cost),
    duration: row.duration,
    createdAt: new Date(row.created_at),
    outputs: row.outputs ? JSON.parse(row.outputs) : undefined,
  }));
}