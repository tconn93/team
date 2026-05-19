/**
 * Memawi (Memora) HTTP Client — wraps the memory & context management API.
 *
 * Each TeamForge agent gets its own memory scope via agent_id.
 * The server runs at MEMAWI_URL (default: http://localhost:8765).
 */

const MEMAWI_URL = process.env.MEMAWI_URL || 'http://localhost:8765';

// === Types ===

export interface MemoryRecord {
  memory_id: string;
  content: string;
  level: 'user' | 'session' | 'agent';
  user_id?: string;
  session_id?: string;
  agent_id?: string;
  importance: number;
  tags: string[];
  source: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

export interface SearchResult {
  memory: MemoryRecord;
  score: number;
}

export interface ContextResult {
  context: string;
  empty: boolean;
}

// === Core API Functions ===

async function memawiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${MEMAWI_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const error = await res.text().catch(() => res.statusText);
    throw new Error(`Memawi API error (${res.status}): ${error}`);
  }
  return res;
}

/**
 * Store a memory for an agent.
 */
export async function remember(params: {
  content: string;
  agentId: string;
  level?: 'user' | 'session' | 'agent';
  importance?: number;
  tags?: string[];
  source?: string;
  metadata?: Record<string, unknown>;
}): Promise<MemoryRecord> {
  const res = await memawiFetch('/api/v1/memories', {
    method: 'POST',
    body: JSON.stringify({
      content: params.content,
      level: params.level || 'agent',
      agent_id: params.agentId,
      importance: params.importance ?? 0.5,
      tags: params.tags || [],
      source: params.source || 'manual',
      metadata: params.metadata || {},
    }),
  });
  return res.json();
}

/**
 * Semantic search across agent memories.
 */
export async function recall(params: {
  query: string;
  agentId: string;
  n?: number;
  level?: string;
  minImportance?: number;
  minRelevance?: number;
}): Promise<SearchResult[]> {
  const params_str = new URLSearchParams({
    q: params.query,
    agent_id: params.agentId,
    n: String(params.n || 10),
    ...(params.level && { level: params.level }),
    ...(params.minImportance && { min_importance: String(params.minImportance) }),
    ...(params.minRelevance && { min_relevance: String(params.minRelevance) }),
  }).toString();

  const res = await memawiFetch(`/api/v1/memories/search?${params_str}`);
  return res.json();
}

/**
 * Get assembled context for injecting into agent system prompts.
 */
export async function getContext(params: {
  q: string;
  agentId: string;
  tokenLimit?: number;
  level?: string;
  minRelevance?: number;
}): Promise<ContextResult> {
  const params_str = new URLSearchParams({
    q: params.q,
    agent_id: params.agentId,
    ...(params.tokenLimit && { token_limit: String(params.tokenLimit) }),
    ...(params.level && { level: params.level }),
    ...(params.minRelevance && { min_relevance: String(params.minRelevance) }),
  }).toString();

  const res = await memawiFetch(`/api/v1/context?${params_str}`);
  return res.json();
}

/**
 * Extract memories from a conversation and store them.
 */
export async function ingestConversation(params: {
  messages: { role: string; content: string }[];
  agentId: string;
  level?: string;
}): Promise<MemoryRecord[]> {
  const res = await memawiFetch('/api/v1/memories/ingest', {
    method: 'POST',
    body: JSON.stringify({
      messages: params.messages,
      level: params.level || 'agent',
      agent_id: params.agentId,
    }),
  });
  return res.json();
}

/**
 * Update an existing memory.
 */
export async function updateMemory(params: {
  memoryId: string;
  content?: string;
  importance?: number;
  tags?: string[];
  archived?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<MemoryRecord> {
  const res = await memawiFetch(`/api/v1/memories/${params.memoryId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      content: params.content,
      importance: params.importance,
      tags: params.tags,
      archived: params.archived,
      metadata: params.metadata,
    }),
  });
  return res.json();
}

/**
 * Delete a memory.
 */
export async function forget(memoryId: string): Promise<void> {
  await memawiFetch(`/api/v1/memories/${memoryId}`, { method: 'DELETE' });
}

/**
 * List memories for an agent.
 */
export async function listMemories(params: {
  agentId: string;
  level?: string;
  includeArchived?: boolean;
  limit?: number;
}): Promise<MemoryRecord[]> {
  const params_str = new URLSearchParams({
    agent_id: params.agentId,
    ...(params.level && { level: params.level }),
    include_archived: String(params.includeArchived || false),
    limit: String(params.limit || 50),
  }).toString();

  const res = await memawiFetch(`/api/v1/memories?${params_str}`);
  return res.json();
}

/**
 * Consolidate memories (archive stale, merge duplicates).
 */
export async function consolidate(params: {
  agentId: string;
  level?: string;
}): Promise<{ archived: number; updated: number; merged: number }> {
  const res = await memawiFetch('/api/v1/memories/consolidate', {
    method: 'POST',
    body: JSON.stringify({
      agent_id: params.agentId,
      level: params.level || 'agent',
    }),
  });
  return res.json();
}

/**
 * Get memory store stats.
 */
export async function getStats(): Promise<{
  total_memories: number;
  llm_available: boolean;
  llm_model: string;
  embedding_backend: string;
  embedding_model: string;
  data_dir: string;
}> {
  const res = await memawiFetch('/api/v1/stats');
  return res.json();
}

/**
 * Check if the Memawi server is available.
 */
export async function isAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${MEMAWI_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

// === Agent-specific Helpers ===

/**
 * Store a file's context in memory for an agent.
 * Called every time we read or update a file during agent execution.
 */
export async function rememberFileContext(params: {
  agentId: string;
  filePath: string;
  content: string;
  operation: 'read' | 'write' | 'update';
}): Promise<MemoryRecord> {
  return remember({
    content: `[${params.operation.toUpperCase()}] ${params.filePath}:\n${params.content.substring(0, 2000)}${params.content.length > 2000 ? '...' : ''}`,
    agentId: params.agentId,
    level: 'session',
    importance: params.operation === 'write' ? 0.8 : 0.4,
    tags: ['file-context', params.operation, params.filePath.split('/').pop() || ''],
    source: 'file-tracker',
  });
}

/**
 * Store an agent's TODO list as a memory.
 * The TODO.agent file tracks what the agent should be doing at all times.
 */
export async function storeAgentTodo(params: {
  agentId: string;
  tasks: { id: string; title: string; status: string; priority: string }[];
  notes?: string;
}): Promise<MemoryRecord> {
  const todoContent = `TODO.agent for ${params.agentId}:\n\n` +
    params.tasks.map(t => `- [${t.status.toUpperCase()}] ${t.title} (${t.priority})`).join('\n') +
    (params.notes ? `\n\nNotes: ${params.notes}` : '');

  return remember({
    content: todoContent,
    agentId: params.agentId,
    level: 'agent',
    importance: 0.9,
    tags: ['todo', 'task-tracker', 'agent-state'],
    source: 'todo-tracker',
  });
}

/**
 * Retrieve an agent's current context for system prompt injection.
 * Includes relevant memories + TODO state.
 */
export async function getAgentContext(params: {
  agentId: string;
  taskDescription: string;
  tokenLimit?: number;
}): Promise<string> {
  const contextResult = await getContext({
    q: params.taskDescription,
    agentId: params.agentId,
    tokenLimit: params.tokenLimit || 1024,
  });

  if (contextResult.empty) {
    return '';
  }

  return contextResult.context;
}

/**
 * Store a task completion result in memory for future reference.
 */
export async function rememberTaskResult(params: {
  agentId: string;
  taskTitle: string;
  result: string;
  quality?: number;
}): Promise<MemoryRecord> {
  return remember({
    content: `Completed task: ${params.taskTitle}\n\nResult: ${params.result.substring(0, 3000)}${params.result.length > 3000 ? '...' : ''}`,
    agentId: params.agentId,
    level: 'agent',
    importance: params.quality ?? 0.7,
    tags: ['task-result', 'completion'],
    source: 'task-tracker',
  });
}

// === Agent Metadata Files (MEMORY.md, TODO.md, TaskList.md, CONTEXT.md) ===

export interface AgentMetadata {
  memory: string;      // MEMORY.md — global long-term memory
  context: string;     // CONTEXT.md — current session (short-term)
  todo: string;         // TODO.md — agent's task list
  taskList: string;     // TaskList.md — detailed task tracking
}

/**
 * Get an agent's MEMORY.md (long-term global memory).
 * This is the agent's accumulated knowledge across all sessions.
 */
export async function getAgentMemory(agentId: string): Promise<string> {
  try {
    const res = await memawiFetch(`/api/v1/agents/${agentId}/memory`);
    const data = await res.json();
    return data.content || '';
  } catch {
    return '';
  }
}

/**
 * Get an agent's CONTEXT.md (current session / short-term memory).
 * This represents the agent's active working context for the current session.
 */
export async function getAgentContextFile(agentId: string): Promise<string> {
  try {
    const res = await memawiFetch(`/api/v1/agents/${agentId}/context`);
    const data = await res.json();
    return data.content || '';
  } catch {
    return '';
  }
}

/**
 * Get an agent's TODO.md (task tracking file).
 */
export async function getAgentTodo(agentId: string): Promise<string> {
  try {
    const res = await memawiFetch(`/api/v1/agents/${agentId}/todo`);
    const data = await res.json();
    return data.content || '';
  } catch {
    return '';
  }
}

/**
 * Get an agent's TaskList.md (detailed task list).
 */
export async function getAgentTaskList(agentId: string): Promise<string> {
  try {
    const res = await memawiFetch(`/api/v1/agents/${agentId}/tasklist`);
    const data = await res.json();
    return data.content || '';
  } catch {
    return '';
  }
}

/**
 * Get all four metadata files for an agent at once.
 */
export async function getAgentMetadata(agentId: string): Promise<AgentMetadata> {
  const [memory, context, todo, taskList] = await Promise.all([
    getAgentMemory(agentId),
    getAgentContextFile(agentId),
    getAgentTodo(agentId),
    getAgentTaskList(agentId),
  ]);

  return { memory, context, todo, taskList };
}

/**
 * Update an agent's CONTEXT.md (short-term session memory).
 */
export async function updateAgentContext(agentId: string, content: string): Promise<void> {
  await memawiFetch(`/api/v1/agents/${agentId}/context`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

/**
 * Update an agent's MEMORY.md (long-term global memory).
 */
export async function updateAgentMemory(agentId: string, content: string): Promise<void> {
  await memawiFetch(`/api/v1/agents/${agentId}/memory`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

/**
 * Update an agent's TODO.md (current task breakdown).
 */
export async function updateAgentTodoFile(agentId: string, content: string): Promise<void> {
  await memawiFetch(`/api/v1/agents/${agentId}/todo`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

/**
 * Update an agent's TaskList.md (current + future tasks).
 */
export async function updateAgentTaskList(agentId: string, content: string): Promise<void> {
  await memawiFetch(`/api/v1/agents/${agentId}/tasklist`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

/**
 * Estimate token count from text (rough: ~4 chars per token).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if context exceeds the token limit (default 300K tokens).
 */
export function isContextOverflow(context: string, tokenLimit = 300_000): boolean {
  return estimateTokens(context) > tokenLimit;
}