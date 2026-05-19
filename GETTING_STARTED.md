# Getting Started with TeamForge

TeamForge is a multi-agent orchestration platform that uses Anthropic's Messages API to coordinate specialized AI agents on complex tasks. This guide walks you through setup, configuration, and running the app.

## Prerequisites

- **Node.js** 20 or later (the Dockerfile uses `node:20-alpine`)
- **npm** 9+ (comes with Node 20)
- **PostgreSQL** 14+ (required for persistent storage — tasks, runs, agent memory, API keys, settings, checkpoints)
- **Anthropic API key** (required — used for all agent execution via the Messages API)
- **Memawi memory server** (optional — provides agent memory and context consolidation)

## 1. Clone and Install

```bash
git clone <your-repo-url> team
cd team
npm install
```

If you hit peer dependency conflicts:

```bash
npm install --legacy-peer-deps
```

## 2. Configure Environment Variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

### Required Variables

| Variable | Description | Example |
|---|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (required for agent execution) | `sk-ant-api03-...` |
| `POSTGRES_DB_URL` | Postgres connection string (supports JDBC or standard format) | `jdbc:postgresql://user:pass@localhost:5432/team_ai` |
| `ENCRYPTION_KEY` | Key for encrypting API keys stored in the database | Change from the default for production |

### Model Configuration

These control which Claude models the agents use. Defaults work out of the box:

| Variable | Default | Purpose |
|---|---|---|
| `DEFAULT_MODEL` | `claude-sonnet-4-20250514` | Primary model for agent execution |
| `FAST_MODEL` | `claude-3-5-haiku-20241022` | Lightweight model for reviews, scouts, and guardrail checks |
| `EXPERT_MODEL` | `claude-opus-4-20250514` | Heavy model for complex planning and coordination |

### Anthropic Proxy Overrides

If you're using a proxy or alternative provider that speaks the Anthropic Messages API format (e.g., OpenRouter), set these — they take priority over the defaults above:

| Variable | Overrides |
|---|---|
| `ANTHROPIC_BASE_URL` | API base URL (e.g., `https://openrouter.ai/api/v1`) |
| `ANTHROPIC_AUTH_TOKEN` | Auth token (alternative to `ANTHROPIC_API_KEY`) |
| `ANTHROPIC_MODEL` | Overrides `DEFAULT_MODEL` |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | Overrides `FAST_MODEL` |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | Overrides `EXPERT_MODEL` |

### Optional Variables

| Variable | Default | Purpose |
|---|---|---|
| `MEMAWI_URL` | `http://localhost:8765` | Memawi memory server URL |
| `MEMAWI_EXTRACT_CONSOLID` | `false` | Use Memawi API for context consolidation (vs. local `FAST_MODEL`) |
| `OPENAI_API_KEY` | — | For model listing in the agent editor |
| `XAI_API_KEY` | — | For xAI/Grok model listing |
| `GOOGLE_API_KEY` | — | For Google Gemini model listing |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Public URL of the app |

### JDBC URL Format

The `POSTGRES_DB_URL` supports both standard and JDBC formats:

```
# Standard format
postgresql://user:password@localhost:5432/team_ai

# JDBC format (handles special characters in passwords)
jdbc:postgresql://user:password@localhost:5432/team_ai
```

The JDBC parser correctly handles passwords containing `$`, `@`, `*`, and other special characters that break standard URL parsing.

## 3. Set Up PostgreSQL

Create a database for TeamForge:

```bash
# Connect to Postgres
psql -U postgres

# Create the database
CREATE DATABASE team_ai;

# Exit
\q
```

The app auto-creates all required tables on first connection via the `/api/db-init` endpoint. Tables include:

- **tasks** — task board with status, priority, assignments
- **runs** — mission execution history
- **agent_edits** — persisted changes to predefined agents
- **custom_agents** — user-created agents
- **api_keys** — encrypted API key storage (AES-256-CBC)
- **agent_memory** — agent task result history
- **checkpoints** — agent execution state for crash recovery
- **app_settings** — global settings (HITL, guardrails, checkpointing)

Alternatively, initialize the schema manually by hitting the endpoint:

```bash
curl http://localhost:3000/api/db-init
```

## 4. Run the Development Server

```bash
npm run dev
```

The app starts at [http://localhost:3000](http://localhost:3000).

### Available Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Start production server (run `npm run build` first) |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run type-check` | TypeScript type checking (`tsc --noEmit`) |

## 5. Configure Settings

Open the app and click the **gear icon** (Settings) in the top-right corner. The settings modal has two tabs:

### LLM Providers

Enter API keys for each provider. The **Anthropic** key is required — it's the primary engine for all agent execution. Other keys (OpenAI, xAI, Google) are optional and used for model listing in the agent editor.

Keys are stored both in the browser's localStorage and encrypted in the Postgres database (AES-256-CBC with scrypt key derivation from `ENCRYPTION_KEY`).

### Safety & Guardrails

Three toggleable features:

| Feature | Default | Description |
|---|---|---|
| **Human-in-the-Loop (HITL) Approval** | Off | Pauses agent execution before running high-impact tools (code_execution, file_write, file_edit) and waits for manual approval via the UI |
| **Hallucination Guardrails** | Off | Runs a lightweight validation check (using `FAST_MODEL`) on tool results and final outputs to detect fabricated facts, confident falsehoods, and tool hallucinations |
| **Execution Checkpointing** | Off | Saves agent conversation state after each iteration to Postgres, allowing resumption after crashes |

Settings are persisted to the `app_settings` DB table and synced to localStorage for fast client reads.

### Per-Agent Overrides

Individual agents can be configured with `requireApproval: true` in their guardrails to force HITL approval regardless of the global setting. Edit an agent's configuration to set per-agent guardrails.

## 6. Architecture Overview

```
User Goal
    │
    ▼
Coordinator Agent ─── Plans & delegates subtasks
    │
    ├── Researcher Agent ─── Gathers information
    ├── Analyst Agent ─── Processes & analyzes data
    └── Writer Agent ─── Produces deliverables
```

Each agent runs an autonomous agentic loop:

1. Receive a goal
2. Call the Anthropic Messages API with available tools
3. If the response contains `tool_use`, execute tools and feed results back
4. Loop until the agent produces a final text response (`stop_reason: end_turn`)
5. Return the result

### Key Directories

| Path | Purpose |
|---|---|
| `lib/anthropic/` | Agent runner, coordinator, tools, client |
| `lib/` | Core modules (db, tasks, approval, guardrails, checkpoint, settings, models, etc.) |
| `components/` | React UI components |
| `app/api/` | Next.js API routes |
| `app/` | Next.js pages and layouts |

### Key Files

| File | Purpose |
|---|---|
| `lib/anthropic/agent-runner.ts` | Core agentic loop with HITL, guardrails, and checkpointing |
| `lib/anthropic/coordinator.ts` | Mission planning and agent delegation |
| `lib/anthropic/tools.ts` | Tool definitions and executors |
| `lib/approval.ts` | HITL approval request manager |
| `lib/guardrails.ts` | Hallucination detection using FAST_MODEL |
| `lib/checkpoint.ts` | Agent execution state persistence |
| `lib/settings.ts` | App-wide settings persistence (DB + localStorage) |
| `lib/db.ts` | Postgres connection pool and schema initialization |
| `lib/context-optimizer.ts` | Agent context assembly and compression |

## 7. Running with Docker

A `Dockerfile` is included for production deployment:

```bash
# Build the image
docker build -t teamforge .

# Run the container
docker run -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e POSTGRES_DB_URL=jdbc:postgresql://user:pass@db:5432/team_ai \
  -e ENCRYPTION_KEY=your-production-key \
  teamforge
```

> **Note:** The Dockerfile expects `output: 'standalone'` in `next.config.mjs`. If you encounter build issues, add this to your Next.js config:

```js
// next.config.mjs
const nextConfig = {
  output: 'standalone',
  // ... existing config
};
```

## 8. Troubleshooting

### "ANTHROPIC_API_KEY is required"

Set the key in `.env.local` or enter it in the Settings modal. The app checks for the key both in the environment and in the client-provided API keys.

### "POSTGRES_DB_URL environment variable is not set"

Create `.env.local` with the `POSTGRES_DB_URL` variable. Make sure the database exists and the user has permissions.

### Database connection fails with special characters in password

Use the JDBC URL format, which handles `$`, `@`, `*`, and other special characters correctly:

```
jdbc:postgresql://user:p@ssw0rd$$@db.example.com:5432/team_ai
```

### Tables not created

Hit the init endpoint after starting the server:

```bash
curl http://localhost:3000/api/db-init
```

### Memawi connection errors

Memawi is optional. If the server isn't running, agents continue without memory context. To enable Memawi:

1. Start the Memawi server at the URL configured in `MEMAWI_URL` (default: `http://localhost:8765`)
2. Set `MEMAWI_EXTRACT_CONSOLID=true` to use Memawi's API for context consolidation instead of the local FAST_MODEL

### Build errors about `pg` native module

The `pg` package uses native Node.js modules that can't run in the browser. This is handled by `serverExternalPackages: ['pg']` in `next.config.mjs`. If you see client-side import errors, make sure `pg` is only imported in server-side code (API routes, `lib/` modules used server-side).

## 9. Development Workflow

1. **Start the dev server:** `npm run dev`
2. **Make changes** — hot reload is enabled
3. **Type check:** `npm run type-check`
4. **Lint:** `npm run lint`
5. **Build:** `npm run build`

The project uses TypeScript strict mode, Tailwind CSS, and Zustand for state management. There is no ORM — all database queries use raw SQL via the `pg` package.