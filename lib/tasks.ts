import fs from 'fs';
import path from 'path';
import { getPool, isDbAvailable, initSchema } from './db';

const DATA_DIR = path.join(process.cwd(), 'data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

export type TaskStatus = 'backlog' | 'in_progress' | 'review' | 'done' | 'blocked';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedAgent: string | null;
  createdBy: 'scout' | 'reviewer' | 'orchestrator' | 'user';
  parentTaskId?: string;
  dependencies?: string[];
  result?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TaskBoard {
  tasks: Task[];
  lastUpdated: string;
}

let dbReady = false;
let dbChecked = false;

async function ensureDb(): Promise<boolean> {
  if (dbChecked) return dbReady;
  dbChecked = true;
  try {
    dbReady = await isDbAvailable();
    if (dbReady) {
      await initSchema();
      console.log('[Tasks] Using Postgres storage');
    } else {
      console.log('[Tasks] Postgres unavailable, using JSON file storage');
    }
  } catch {
    dbReady = false;
    console.log('[Tasks] Postgres unavailable, using JSON file storage');
  }
  return dbReady;
}

// Ensure data dir exists for JSON fallback
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readBoard(): TaskBoard {
  ensureDataDir();
  if (!fs.existsSync(TASKS_FILE)) {
    const empty: TaskBoard = { tasks: [], lastUpdated: new Date().toISOString() };
    fs.writeFileSync(TASKS_FILE, JSON.stringify(empty, null, 2));
    return empty;
  }
  return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
}

function writeBoard(board: TaskBoard): void {
  ensureDataDir();
  board.lastUpdated = new Date().toISOString();
  fs.writeFileSync(TASKS_FILE, JSON.stringify(board, null, 2));
}

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    assignedAgent: row.assigned_agent as string | null,
    createdBy: row.created_by as Task['createdBy'],
    parentTaskId: row.parent_task_id as string | undefined,
    dependencies: row.dependencies as string[] | undefined,
    result: row.result as string | undefined,
    reviewNotes: row.review_notes as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    startedAt: row.started_at as string | undefined,
    completedAt: row.completed_at as string | undefined,
  };
}

// === CRUD Operations ===

export async function listTasks(filters?: Partial<Pick<Task, 'status' | 'priority' | 'assignedAgent' | 'createdBy'>>): Promise<Task[]> {
  if (await ensureDb()) {
    const pool = getPool();
    let sql = 'SELECT * FROM tasks';
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters) {
      if (filters.status) { conditions.push(`status = $${paramIdx++}`); params.push(filters.status); }
      if (filters.priority) { conditions.push(`priority = $${paramIdx++}`); params.push(filters.priority); }
      if (filters.assignedAgent) { conditions.push(`assigned_agent = $${paramIdx++}`); params.push(filters.assignedAgent); }
      if (filters.createdBy) { conditions.push(`created_by = $${paramIdx++}`); params.push(filters.createdBy); }
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY CASE priority WHEN \'critical\' THEN 0 WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 WHEN \'low\' THEN 3 END, created_at ASC';

    const result = await pool.query(sql, params);
    return result.rows.map(rowToTask);
  }

  // JSON fallback
  let tasks = readBoard().tasks;
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined) {
        tasks = tasks.filter(t => t[key as keyof Task] === value);
      }
    }
  }
  return tasks.sort((a, b) => {
    const priorityOrder: Record<TaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export async function getTask(id: string): Promise<Task | null> {
  if (await ensureDb()) {
    const result = await getPool().query('SELECT * FROM tasks WHERE id = $1', [id]);
    return result.rows[0] ? rowToTask(result.rows[0]) : null;
  }
  return readBoard().tasks.find(t => t.id === id) || null;
}

export async function createTask(input: {
  title: string;
  description: string;
  priority?: TaskPriority;
  assignedAgent?: string | null;
  createdBy?: Task['createdBy'];
  parentTaskId?: string;
  dependencies?: string[];
}): Promise<Task> {
  const task: Task = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: input.title,
    description: input.description,
    status: 'backlog',
    priority: input.priority || 'medium',
    assignedAgent: input.assignedAgent || null,
    createdBy: input.createdBy || 'user',
    parentTaskId: input.parentTaskId,
    dependencies: input.dependencies || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (await ensureDb()) {
    await getPool().query(
      `INSERT INTO tasks (id, title, description, status, priority, assigned_agent, created_by, parent_task_id, dependencies, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
      [task.id, task.title, task.description, task.status, task.priority, task.assignedAgent, task.createdBy, task.parentTaskId || null, task.dependencies || []]
    );
  } else {
    const board = readBoard();
    board.tasks.push(task);
    writeBoard(board);
  }

  return task;
}

export async function updateTask(id: string, updates: Partial<Pick<Task, 'status' | 'priority' | 'assignedAgent' | 'result' | 'reviewNotes' | 'description' | 'title'>>): Promise<Task | null> {
  if (await ensureDb()) {
    const existing = await getTask(id);
    if (!existing) return null;

    const startedAt = updates.status === 'in_progress' && !existing.startedAt ? 'NOW()' : undefined;
    const completedAt = updates.status === 'done' ? 'NOW()' : undefined;

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIdx = 1;

    for (const [key, value] of Object.entries(updates)) {
      const colMap: Record<string, string> = {
        status: 'status',
        priority: 'priority',
        assignedAgent: 'assigned_agent',
        result: 'result',
        reviewNotes: 'review_notes',
        description: 'description',
        title: 'title',
      };
      const col = colMap[key];
      if (col) {
        setClauses.push(`${col} = $${paramIdx++}`);
        params.push(value);
      }
    }

    if (startedAt) setClauses.push(`started_at = ${startedAt}`);
    if (completedAt) setClauses.push(`completed_at = ${completedAt}`);

    params.push(id);
    await getPool().query(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`, params);
    return getTask(id);
  }

  // JSON fallback
  const board = readBoard();
  const task = board.tasks.find(t => t.id === id);
  if (!task) return null;

  if (updates.status === 'in_progress' && !task.startedAt) {
    task.startedAt = new Date().toISOString();
  }
  if (updates.status === 'done') {
    task.completedAt = new Date().toISOString();
  }

  Object.assign(task, updates, { updatedAt: new Date().toISOString() });
  writeBoard(board);
  return task;
}

export async function deleteTask(id: string): Promise<boolean> {
  if (await ensureDb()) {
    const result = await getPool().query('DELETE FROM tasks WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
  const board = readBoard();
  const index = board.tasks.findIndex(t => t.id === id);
  if (index === -1) return false;
  board.tasks.splice(index, 1);
  writeBoard(board);
  return true;
}

export async function pickNextTask(agentId?: string): Promise<Task | null> {
  const tasks = await listTasks();
  const completedIds = new Set(tasks.filter(t => t.status === 'done').map(t => t.id));

  const eligible = tasks.filter(t => {
    if (t.status !== 'backlog' && t.status !== 'in_progress') return false;
    if (agentId && t.assignedAgent && t.assignedAgent !== agentId) return false;
    if (t.dependencies && !t.dependencies.every(dep => completedIds.has(dep))) return false;
    return true;
  });

  return eligible[0] || null;
}

export async function getFollowUpTasks(parentTaskId: string): Promise<Task[]> {
  if (await ensureDb()) {
    const result = await getPool().query('SELECT * FROM tasks WHERE parent_task_id = $1', [parentTaskId]);
    return result.rows.map(rowToTask);
  }
  return readBoard().tasks.filter(t => t.parentTaskId === parentTaskId);
}

export async function getBoardStats(): Promise<{ total: number; byStatus: Record<TaskStatus, number>; byPriority: Record<TaskPriority, number> }> {
  if (await ensureDb()) {
    const pool = getPool();
    const [statusRes, priorityRes, totalRes] = await Promise.all([
      pool.query("SELECT status, COUNT(*) as count FROM tasks GROUP BY status"),
      pool.query("SELECT priority, COUNT(*) as count FROM tasks GROUP BY priority"),
      pool.query("SELECT COUNT(*) as total FROM tasks"),
    ]);

    const byStatus: Record<string, number> = { backlog: 0, in_progress: 0, review: 0, done: 0, blocked: 0 };
    for (const row of statusRes.rows) {
      byStatus[row.status] = parseInt(row.count);
    }

    const byPriority: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const row of priorityRes.rows) {
      byPriority[row.priority] = parseInt(row.count);
    }

    return { total: parseInt(totalRes.rows[0].total), byStatus: byStatus as Record<TaskStatus, number>, byPriority: byPriority as Record<TaskPriority, number> };
  }

  // JSON fallback
  const tasks = readBoard().tasks;
  return {
    total: tasks.length,
    byStatus: {
      backlog: tasks.filter(t => t.status === 'backlog').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      review: tasks.filter(t => t.status === 'review').length,
      done: tasks.filter(t => t.status === 'done').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
    },
    byPriority: {
      critical: tasks.filter(t => t.priority === 'critical').length,
      high: tasks.filter(t => t.priority === 'high').length,
      medium: tasks.filter(t => t.priority === 'medium').length,
      low: tasks.filter(t => t.priority === 'low').length,
    },
  };
}