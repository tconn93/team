# Agent Tools Reference

This document describes every tool available to TeamForge AI agents, including parameters, behavior, security considerations, and which agents have access to each tool.

## Overview

Agents access tools through the Anthropic Messages API tool-use flow. Each agent is configured with a subset of tools appropriate to its role. The Coordinator orchestrates tasks and delegates to specialized agents based on their capabilities.

Tools are defined in `lib/anthropic/tools.ts` and assigned to agents in `lib/agents.ts`.

---

## Tool Catalog

### bash

Execute shell commands in the project workspace.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `command` | string | Yes | The shell command to execute |
| `timeout` | number | No | Timeout in milliseconds (default 30000, max 120000) |

**Returns:** `{ stdout, stderr, exitCode }`

**Security:**
- Commands run with the project root as the working directory
- Dangerous commands are blocked (`rm -rf /`, `sudo`, `chmod 777`, `mkfs`, `dd if=`, `shutdown`, `reboot`, etc.)
- Requires HITL approval when Human-in-the-Loop is enabled
- Uses `child_process.exec` under the hood

**Available to:** coordinator, analyst, visualizer

---

### file_read

Read the contents of a file from the project workspace. Returns line-numbered output.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | Path relative to project root (e.g., `"lib/agents.ts"`) |
| `offset` | number | No | Line number to start reading from (1-indexed, default 1) |
| `limit` | number | No | Maximum number of lines to read (default 2000) |

**Returns:** `{ path, content, totalLines, shownLines, startLine, endLine, size }`

**Security:** All paths are sandboxed to the project workspace root. Directory traversal attacks (e.g., `../../etc/passwd`) are rejected.

**Available to:** coordinator, researcher, analyst, writer, visualizer, brainstormer

---

### file_write

Write content to a file, creating it if it doesn't exist or overwriting if it does.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | Path relative to project root |
| `content` | string | Yes | The exact content to write |
| `create_dirs` | boolean | No | Create parent directories if they don't exist (default true) |

**Returns:** `{ success, path, size }`

**Security:** Sandbox-verified paths. HTML entities (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`) are decoded before writing. Requires HITL approval when enabled.

**Available to:** coordinator, analyst, writer, visualizer

---

### file_edit

Edit a file by replacing an exact string match. The `old_string` must be unique in the file.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | Path relative to project root |
| `old_string` | string | Yes | The exact text to find and replace (must be unique) |
| `new_string` | string | Yes | The replacement text (empty string to delete) |

**Returns:** `{ success, path, replaced }`

**Security:** Sandbox-verified paths. Rejects edits where `old_string` appears more than once. HTML entity decoding applied. Requires HITL approval when enabled.

**Available to:** coordinator, writer

---

### glob

Find files matching a glob pattern. Returns paths relative to the project root.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pattern` | string | Yes | Glob pattern (e.g., `"**/*.ts"`, `"lib/**/*.json"`) |
| `path` | string | No | Directory to search in (default: project root) |

**Returns:** `{ pattern, path, files, total, truncated }`

**Security:** Sandbox-verified paths. Skips `node_modules`, `.git`, `.next`, `__pycache__`, `.venv`, `dist`, `build`, and hidden directories. Maximum 100 results.

**Available to:** coordinator, researcher, analyst, brainstormer

---

### grep

Search for a regex pattern across files in the project. Returns matching lines with file paths, line numbers, and optional context.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pattern` | string | Yes | Regular expression pattern to search for |
| `path` | string | No | Directory to search in (default: project root) |
| `include` | string | No | File name pattern to include (e.g., `"*.ts"`) |
| `context` | number | No | Number of context lines around each match (default 2) |

**Returns:** `{ pattern, path, matches, total, truncated }` where each match has `{ file, line, content, context? }`

**Security:** Sandbox-verified paths. Skips binary files and common non-project directories. Maximum 50 results.

**Available to:** coordinator, researcher, analyst, brainstormer

---

### list_directory

List files and directories at a given path.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | No | Directory path (default: project root) |

**Returns:** `{ path, entries: [{ name, type, path }], total }`

**Security:** Sandbox-verified paths. Hidden files (starting with `.`) are excluded from results. Directories are sorted before files.

**Available to:** brainstormer

---

### web_search

Search the web for information. Returns real results with titles, snippets, and URLs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | The search query |
| `numResults` | number | No | Number of results to return (default 5) |

**Returns:** `{ query, results: [{ title, snippet, url }], totalFound, provider? }`

**Configuration:** Requires a search provider API key set in environment variables:
- `BRAVE_SEARCH_API_KEY` — for [Brave Search API](https://brave.com/search/api/) (recommended)
- `WEB_SEARCH_API_KEY` + `WEB_SEARCH_PROVIDER=serpapi` — for [SerpAPI](https://serpapi.com/)

If no API key is configured, the tool returns a helpful error message with setup instructions.

**Available to:** coordinator, researcher, writer, brainstormer

---

### web_fetch

Fetch content from a URL and extract the main text content.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | The URL to fetch |
| `prompt` | string | No | Description of what information to extract |

**Returns:** `{ url, content, truncated, totalChars, contentType }`

**Behavior:**
- Fetches the URL with a 15-second timeout
- For HTML responses, strips scripts, styles, nav, header, footer, and all HTML tags
- Decodes HTML entities to plain text
- Truncates content to 10,000 characters
- Sets a `TeamForge/1.0` User-Agent header

**Available to:** coordinator, researcher, writer, brainstormer

---

### ask_user

Ask the user a question and wait for their response. Pauses agent execution until the user answers via the UI.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `question` | string | Yes | The question to ask the user |
| `options` | string[] | No | List of predefined answer choices |

**Returns:** `{ question, answer, answered }`

**Behavior:**
- Creates a pending question with a 10-minute timeout
- Emits a `user_question` SSE event to the client
- The UI displays the question and optional choices
- The user responds via `POST /api/run/respond`
- If the question times out, the tool returns an error

**Available to:** coordinator, researcher, analyst, writer, visualizer, brainstormer

---

### analyze_data

Analyze data using an LLM. Sends the data and question to the configured `FAST_MODEL` for structured analysis.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data` | string | Yes | The data to analyze (JSON, CSV, text, or any format) |
| `question` | string | Yes | The specific question or analysis request |

**Returns:** `{ question, analysis, dataProvided, dataTruncated, model, inputTokens, outputTokens }`

**Behavior:**
- Data is truncated to 8,000 characters if longer
- Uses `FAST_MODEL` (default: `claude-3-5-haiku-20241022`) for cost efficiency
- Returns structured analysis with markdown formatting
- Falls back to an error message if no Anthropic API key is configured

**Available to:** coordinator, researcher, analyst, brainstormer

---

### remember

Store a fact, insight, or piece of information in persistent agent memory via the Memawi server.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | The information to store |
| `importance` | number | No | Importance from 0.0 (trivial) to 1.0 (critical), default 0.5 |
| `tags` | string[] | No | Tags for categorizing this memory |

**Returns:** `{ stored, memory_id }` on success, `{ stored: false, note }` if Memawi is unavailable

**Note:** The `agentId` is automatically injected by the tool system (not a parameter the agent provides).

**Available to:** coordinator, researcher, analyst, writer, visualizer, brainstormer

---

### recall

Search persistent agent memory for relevant information.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | What to search for in memory |
| `n` | number | No | Number of results to return (default 5) |

**Returns:** `{ query, found, memories: [{ content, importance, tags, relevance, created }] }`

**Note:** The `agentId` is automatically injected by the tool system.

**Available to:** coordinator, researcher, analyst, writer, visualizer, brainstormer

---

## Agent-Tool Matrix

| Tool | Coordinator | Researcher | Analyst | Writer | Visualizer | Brainstormer |
|------|:-----------:|:----------:|:-------:|:------:|:----------:|:------------:|
| bash | ✅ | | ✅ | | ✅ | |
| file_read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| file_write | ✅ | | ✅ | ✅ | ✅ | |
| file_edit | ✅ | | | ✅ | | |
| glob | ✅ | ✅ | ✅ | | | ✅ |
| grep | ✅ | ✅ | ✅ | | | ✅ |
| list_directory | | | | | | ✅ |
| web_search | ✅ | ✅ | | ✅ | | ✅ |
| web_fetch | ✅ | ✅ | | ✅ | | ✅ |
| ask_user | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| analyze_data | ✅ | ✅ | ✅ | | ✅ | ✅ |
| remember | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| recall | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Security Model

### Path Sandboxing

All file operations (`file_read`, `file_write`, `file_edit`, `glob`, `grep`, `list_directory`) are sandboxed to the project workspace directory (`process.cwd()`). Any attempt to access paths outside the workspace (e.g., `../../etc/passwd`) is rejected with an error.

### HITL Approval Gates

When Human-in-the-Loop (HITL) is enabled in Settings, the following tools require manual approval before execution:

- **bash** — always requires approval
- **file_write** — always requires approval
- **file_edit** — always requires approval

Tools that are always read-only (`file_read`, `glob`, `grep`, `list_directory`, `web_search`, `web_fetch`, `ask_user`, `analyze_data`, `remember`, `recall`) never require approval.

Agents can also be configured with `guardrails.requireApproval: true` to force approval for **all** their tool calls.

### Hallucination Guardrails

When enabled in Settings, the guardrail system validates tool results and final agent outputs using a lightweight `FAST_MODEL` call. It checks for:
- Fabricated facts (fake URLs, nonexistent tools, invented statistics)
- Confident falsehoods
- Tool hallucination (claims about tools that don't exist)
- Circular reasoning

Read-only tools (`file_read`, `glob`, `grep`, `list_directory`, `remember`, `recall`, `web_search`, `web_fetch`, `ask_user`, `analyze_data`) are excluded from tool result guardrail checks.

### Command Blocking

The `bash` tool blocks commands matching dangerous patterns:
- `rm -rf /` or `rm -rf ~`
- `sudo`
- `chmod 777`
- `dd if=`
- `mkfs`, `format`
- `shutdown`, `reboot`
- `systemctl stop/disable/mask sshd|ssh|firewall`

---

## Special Tools (Agent-Specific)

These tools are not in the general tool registry. They are defined and used within specific agent modules.

### create_execution_plan

Used by the **Coordinator** during the planning phase. The LLM calls this tool to output a structured execution plan.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `subtasks` | array | Yes | List of subtask objects with `id`, `title`, `description`, `assignedAgent`, `dependencies` |
| `strategy` | string | No | Brief description of the overall strategy |

**Defined in:** `lib/anthropic/coordinator.ts`

### submit_review

Used by the **Reviewer** agent to output structured review results.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `approved` | boolean | Yes | Whether the task passes review |
| `quality` | number | Yes | Quality score 0-10 |
| `notes` | string | Yes | Detailed review notes |
| `followUpTasks` | array | No | Follow-up task objects with `title`, `description`, `priority` |

**Defined in:** `lib/anthropic/reviewer.ts`

### report_findings

Used by the **Scout** agent to output structured findings from codebase analysis.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `findings` | array | Yes | Finding objects with `title`, `description`, `priority` (critical/high/medium/low), `source` |

**Defined in:** `lib/anthropic/scout.ts`

---

## Environment Variables for Web Tools

| Variable | Description |
|----------|-------------|
| `BRAVE_SEARCH_API_KEY` | API key for Brave Search (recommended) |
| `WEB_SEARCH_API_KEY` | API key for the configured search provider |
| `WEB_SEARCH_PROVIDER` | Search provider: `brave` (default) or `serpapi` |
| `ANTHROPIC_API_KEY` | Required for `analyze_data` (uses `FAST_MODEL`) |
| `MEMAWI_URL` | Memawi server URL for `remember`/`recall` (default: `http://localhost:8765`) |