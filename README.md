# TeamForge — Hyperagent OS

A multi-agent orchestration platform where specialized AI agents collaborate on complex goals. Each agent runs in Claude Code-style "goal mode" — receiving a task, calling the Anthropic Messages API with tools, executing results, and iterating until done.

Built with Next.js 15, TypeScript, Tailwind CSS, Zustand, and the Anthropic Messages API.

## Architecture

```
User Goal
    │
    ▼
Coordinator Agent (plans & delegates)
    │
    ├─► Researcher (Alex Rivera)      — web search, competitive analysis
    ├─► Analyst (Dr. Lena Chen)       — financial modeling, data analysis
    ├─► Writer (Marcus Hale)          — content creation, strategy docs
    ├─► Visualizer (Sofia Patel)      — charts, diagrams, image generation
    └─► Brainstormer (Nova Kim)      — feature analysis, ideation

Each agent:
  1. Receives a goal
  2. Calls Anthropic Messages API with tool definitions
  3. Executes tool calls in parallel (Promise.all)
  4. Feeds results back and loops until stop_reason: end_turn
  5. Returns final output
```

**Orchestrator Loop** — always-on engine that picks tasks from a persistent board, dispatches agents, and triggers reviews. The **Feature Scout** identifies improvement opportunities and seeds the board autonomously.

## Key Features

- **Real Agent Execution** — Anthropic Messages API with tool_use/tool_result flow, not simulation
- **Parallel Tool Execution** — multiple tool_use blocks in a single response executed via Promise.all
- **SSE Streaming** — real-time events from server to client during mission execution
- **Task Board** — persistent JSON/Postgres-backed task management with priorities and dependencies
- **Feature Scout** — identifies codebase improvements and seeds the task board
- **Review Agent** — validates completed work and creates follow-up tasks
- **Orchestrator Loop** — autonomous cycle that processes tasks continuously
- **Memawi Integration** — persistent agent memory with MEMORY.md, CONTEXT.md, TODO.md, TaskList.md
- **Context Optimization** — auto-compresses CONTEXT.md when it exceeds 300K tokens (via Memawi or local LLM)
- **Encrypted API Key Storage** — AES-256-CBC encrypted in Postgres, never stored in plaintext
- **File I/O Sandbox** — all file tools restricted to workspace directory, preventing traversal attacks
- **Configurable Models** — DEFAULT_MODEL, FAST_MODEL, EXPERT_MODEL via environment variables

## Environment Variables

```bash
# === Required ===
ANTHROPIC_API_KEY=sk-ant-...          # Required for all agent execution

# === Model Configuration (optional — defaults shown) ===
DEFAULT_MODEL=claude-sonnet-4-20250514  # Standard agent execution
FAST_MODEL=claude-3-5-haiku-20241022    # Reviews, scouts, context optimization
EXPERT_MODEL=claude-opus-4-20250514     # Complex planning and coordination

# === Memory (required for agent memory) ===
MEMAWI_URL=http://localhost:8765
MEMAWI_EXTRACT_CONSOLID=false           # true = use Memawi API for context consolidation
                                        # false = use local FAST_MODEL

# === Database (required for persistent storage) ===
# Supports JDBC: jdbc:postgresql://user:password@host:port/database
# Or standard:  postgresql://user:password@host:port/database
POSTGRES_DB_URL=jdbc:postgresql://user:password@localhost:5432/team_ai

# === Security ===
ENCRYPTION_KEY=change-this-in-production  # For encrypting API keys in DB

# === Optional Provider Keys ===
OPENAI_API_KEY=sk-...
XAI_API_KEY=xai-...
GOOGLE_API_KEY=...
```

## Getting Started

```bash
npm install --legacy-peer-deps
cp .env.example .env.local
# Edit .env.local with your Anthropic API key and Postgres URL
npm run dev
```

Open http://localhost:3000. Enter a goal, watch the coordinator plan and dispatch agents in real time.

## Project Structure

```
app/
  api/
    config/          # Model config endpoint (DEFAULT/FAST/EXPERT)
    db-init/          # Initialize Postgres schema
    health/           # Health check + DB status
    keys/             # Encrypted API key CRUD
    memory/           # Memawi proxy (remember, recall, context, agent metadata)
    orchestrator/     # Task board operations (cycle, scout, status)
    run/              # SSE streaming endpoint for mission execution
    runs/             # Persist completed runs to DB
    tasks/            # CRUD for persistent task board
    test-connection/  # Validate API keys
  page.tsx            # Main command center UI

lib/
  agents.ts           # 6 predefined agents + tool definitions
  api-keys.ts         # AES-256-CBC encrypted key storage in Postgres
  context-optimizer.ts # Context compression (Memawi or local LLM)
  db.ts               # Postgres connection pool + schema init
  db-runs.ts          # Run persistence to Postgres
  memawi.ts           # HTTP client for Memawi memory server
  models.ts           # DEFAULT_MODEL, FAST_MODEL, EXPERT_MODEL from env
  store.ts            # Zustand state (agents, runs, SSE processing)
  task-files.ts       # TaskList.md + TODO.md generation for agents
  tasks.ts            # Persistent task board (Postgres with JSON fallback)
  types.ts            # Core TypeScript interfaces

  anthropic/
    agent-runner.ts   # Goal-mode agentic loop (core execution engine)
    client.ts         # Anthropic SDK client initialization
    coordinator.ts    # Plan creation + subtask delegation
    loop.ts           # OrchestratorLoop — always-on task processor
    reviewer.ts       # Quality review agent
    scout.ts          # Feature scout agent
    tools.ts          # 9 tool definitions + executors (sandboxed file I/O)

components/
  AgentCard.tsx       # Fleet card with status indicator
  AgentEditor.tsx     # Create/edit agents with live model list
  RunViewer.tsx        # Real-time execution trace + rich output renderer
  SettingsModal.tsx   # API key configuration + connection testing
```

## Agent Memory (Memawi)

Each agent maintains four metadata files via the Memawi server:

| File | Purpose | Scope |
|------|---------|-------|
| `MEMORY.md` | Global long-term memory | Persists across sessions |
| `CONTEXT.md` | Current session context | Short-term, auto-compressed when >300K tokens |
| `TODO.md` | Current task breakdown | Wiped and regenerated when task changes |
| `TaskList.md` | Current + queued tasks | Updated every cycle |

When `CONTEXT.md` exceeds 300K tokens:
- `MEMAWI_EXTRACT_CONSOLID=true` → Memawi's LLM-powered consolidation endpoint handles it
- `MEMAWI_EXTRACT_CONSOLID=false` → Local `FAST_MODEL` compresses it via Anthropic API

## Security

- **File I/O sandbox** — All file tools validate paths stay within `process.cwd()`. Paths like `../../../etc/passwd` are rejected.
- **Encrypted API keys** — Stored in Postgres using AES-256-CBC with scrypt-derived keys. Never plaintext.
- **Server-side key management** — `POST /api/keys` encrypts and stores; `GET /api/keys` returns only which providers are configured (never key values).

## Database

Postgres is used for persistent storage with automatic JSON file fallback:

| Table | Purpose |
|-------|---------|
| `tasks` | Persistent task board |
| `runs` | Completed mission history |
| `agent_edits` | Predefined agent configuration overrides |
| `custom_agents` | User-created agents |
| `api_keys` | Encrypted provider API keys |
| `agent_memory` | Task result history |

Initialize the schema: `POST /api/db-init`

## Deployment

```bash
docker build -t teamforge .
docker run -p 3000:3000 teamforge
```

For standalone mode, add `output: 'standalone'` to `next.config.mjs`.

## License

MIT