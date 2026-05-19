import { Pool, PoolConfig } from 'pg';

let pool: Pool | null = null;

/**
 * Parse a JDBC URL into pg connection config.
 * Handles special characters in passwords (like $, @, *) that break URL parsing.
 *
 * Format: jdbc:postgresql://user:password@host:port/database
 */
function parseJdbcUrl(jdbcUrl: string): PoolConfig {
  // Strip the jdbc:postgresql:// prefix
  const rest = jdbcUrl.replace(/^jdbc:postgresql:\/\//, '');

  // Split on the last @ to separate credentials from host (password might contain @)
  const lastAt = rest.lastIndexOf('@');
  if (lastAt === -1) {
    throw new Error(`Invalid JDBC URL: missing user:password@host section`);
  }

  const credentials = rest.substring(0, lastAt);
  const hostPortDb = rest.substring(lastAt + 1);

  // Parse credentials: user:password
  const colonIdx = credentials.indexOf(':');
  const user = colonIdx === -1 ? credentials : credentials.substring(0, colonIdx);
  const password = colonIdx === -1 ? '' : credentials.substring(colonIdx + 1);

  // Parse host:port/database
  const slashIdx = hostPortDb.indexOf('/');
  const hostPort = slashIdx === -1 ? hostPortDb : hostPortDb.substring(0, slashIdx);
  const database = slashIdx === -1 ? 'team_ai' : hostPortDb.substring(slashIdx + 1);

  const [host, portStr] = hostPort.split(':');
  const port = portStr ? parseInt(portStr, 10) : 5432;

  return {
    host,
    port,
    user,
    password,
    database,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

/**
 * Get or create the Postgres connection pool.
 * Uses POSTGRES_DB_URL env var (supports JDBC format).
 */
export function getPool(): Pool {
  if (pool) return pool;

  const dbUrl = process.env.POSTGRES_DB_URL;
  if (!dbUrl) {
    throw new Error('POSTGRES_DB_URL environment variable is not set');
  }

  const config = dbUrl.startsWith('jdbc:')
    ? parseJdbcUrl(dbUrl)
    : { connectionString: dbUrl, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 };

  pool = new Pool(config);

  pool.on('error', (err) => {
    console.error('[DB] Unexpected pool error:', err.message);
  });

  return pool;
}

/**
 * Check if Postgres is available by attempting a connection.
 */
export async function isDbAvailable(): Promise<boolean> {
  try {
    const p = getPool();
    const result = await p.query('SELECT 1 as ok');
    return result.rows[0]?.ok === 1;
  } catch {
    return false;
  }
}

/**
 * Initialize the database schema — create tables if they don't exist.
 */
export async function initSchema(): Promise<void> {
  const p = getPool();

  await p.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'backlog',
      priority TEXT NOT NULL DEFAULT 'medium',
      assigned_agent TEXT,
      created_by TEXT NOT NULL DEFAULT 'user',
      parent_task_id TEXT,
      dependencies TEXT[] DEFAULT '{}',
      result TEXT,
      review_notes TEXT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      goal TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planning',
      plan JSONB,
      messages JSONB DEFAULT '[]'::jsonb,
      agents_used TEXT[] DEFAULT '{}',
      cost NUMERIC DEFAULT 0,
      duration INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      outputs JSONB DEFAULT '[]'::jsonb
    );

    CREATE TABLE IF NOT EXISTS agent_edits (
      agent_id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS custom_agents (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      provider TEXT PRIMARY KEY,
      key_encrypted TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS agent_memory (
      id SERIAL PRIMARY KEY,
      agent_id TEXT NOT NULL,
      task_title TEXT,
      result TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Add indexes for common queries
  await p.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks (priority);
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks (assigned_agent);
    CREATE INDEX IF NOT EXISTS idx_runs_status ON runs (status);
    CREATE INDEX IF NOT EXISTS idx_agent_memory_agent ON agent_memory (agent_id);
  `);
}

/**
 * Close the connection pool.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}