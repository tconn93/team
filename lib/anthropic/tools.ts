import Anthropic from '@anthropic-ai/sdk';
import { predefinedAgents } from '../agents';
import * as memawi from '../memawi';
import { createAnthropicClient } from './client';
import { FAST_MODEL } from '../models';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Sandbox all file operations to the project workspace directory.
 * Prevents directory traversal attacks by ensuring resolved paths
 * stay within the allowed root.
 */
const WORKSPACE_ROOT = process.cwd();

function sandboxPath(relativePath: string): { fullPath: string; safe: string } | { error: string } {
  const resolved = path.resolve(WORKSPACE_ROOT, relativePath);
  const normalizedRoot = path.resolve(WORKSPACE_ROOT);

  if (!resolved.startsWith(normalizedRoot + path.sep) && resolved !== normalizedRoot) {
    return { error: `Access denied: path escapes workspace. Requested: ${relativePath}` };
  }

  return { fullPath: resolved, safe: path.relative(normalizedRoot, resolved) };
}

/** Block dangerous shell commands. */
const BLOCKED_COMMANDS = [
  /\brm\s+-rf\s+\/\b/i,
  /\brm\s+-rf\s+~\b/i,
  /\bsudo\b/i,
  /\bchmod\s+777\b/i,
  /\bdd\s+if=/i,
  /\bmkfs\b/i,
  /\bformat\b/i,
  />\s*\/dev\/sd/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\binit\s+[06]/i,
  /\bsystemctl\s+(stop|disable|mask)\s+(sshd|ssh|firewall)/i,
];

function isCommandBlocked(command: string): string | null {
  for (const pattern of BLOCKED_COMMANDS) {
    if (pattern.test(command)) {
      return `Command blocked for safety: "${command.substring(0, 80)}" matches a dangerous pattern`;
    }
  }
  return null;
}

/** Recursively walk a directory and collect file paths matching a glob pattern. */
async function walkDir(dir: string, pattern: RegExp, rootDir: string, maxResults: number): Promise<string[]> {
  const fs = await import('fs');
  const results: string[] = [];
  const skipDirs = new Set(['node_modules', '.git', '.next', '__pycache__', '.venv', 'dist', 'build']);

  async function walk(currentDir: string): Promise<void> {
    if (results.length >= maxResults) return;
    let entries: { name: string; isDirectory(): boolean; isFile(): boolean }[];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults) break;
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, fullPath);

      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name) && !entry.name.startsWith('.')) {
          await walk(fullPath);
        }
      } else if (pattern.test(relativePath) || pattern.test(entry.name)) {
        results.push(relativePath);
      }
    }
  }

  await walk(dir);
  return results;
}

/** Convert a glob pattern string to a RegExp. */
function globToRegex(pattern: string): RegExp {
  let regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');
  return new RegExp(regex, 'i');
}

/** Search files for a regex pattern, returning matches with context. */
async function searchFiles(
  rootDir: string,
  pattern: RegExp,
  includePattern: RegExp | null,
  contextLines: number,
  maxResults: number,
): Promise<{ file: string; line: number; content: string; context?: string }[]> {
  const fs = await import('fs');
  const results: { file: string; line: number; content: string; context?: string }[] = [];

  async function searchDir(currentDir: string): Promise<void> {
    let entries: { name: string; isDirectory(): boolean; isFile(): boolean }[];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    const skipDirs = new Set(['node_modules', '.git', '.next', '__pycache__', '.venv', 'dist', 'build']);
    const binaryExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.zip', '.gz', '.tar', '.rar', '.7z', '.pdf', '.doc', '.docx', '.xlsx', '.pptx']);

    for (const entry of entries) {
      if (results.length >= maxResults) break;
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name) && !entry.name.startsWith('.')) {
          await searchDir(fullPath);
        }
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (binaryExts.has(ext)) continue;
        if (includePattern && !includePattern.test(entry.name) && !includePattern.test(fullPath)) continue;

        try {
          const content = await fs.promises.readFile(fullPath, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (results.length >= maxResults) break;
            if (pattern.test(lines[i])) {
              const contextStart = Math.max(0, i - contextLines);
              const contextEnd = Math.min(lines.length - 1, i + contextLines);
              const contextStr = contextLines > 0
                ? lines.slice(contextStart, contextEnd + 1).map((l, idx) => `${contextStart + idx + 1}: ${l}`).join('\n')
                : undefined;
              results.push({
                file: path.relative(rootDir, fullPath),
                line: i + 1,
                content: lines[i].trim(),
                context: contextStr,
              });
            }
          }
        } catch {
          // Skip files we can't read
        }
      }
    }
  }

  await searchDir(rootDir);
  return results;
}

// Tool definitions in Anthropic's format
export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: 'bash',
    description:
      'Execute a shell command in the project workspace. Returns stdout, stderr, and exit code. Use this for running scripts, installing packages, git operations, and other system commands. Commands run with the project root as the working directory.',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: {
          type: 'string' as const,
          description: 'The shell command to execute',
        },
        timeout: {
          type: 'number' as const,
          description: 'Timeout in milliseconds (default 30000, max 120000)',
        },
      },
      required: ['command'] as const,
    },
  },
  {
    name: 'file_read',
    description:
      'Read the contents of a file from the project. Returns the file content with line numbers. Supports offset and limit for reading specific sections of large files.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string' as const,
          description: 'Path to the file relative to the project root (e.g., "lib/agents.ts", "README.md")',
        },
        offset: {
          type: 'number' as const,
          description: 'Line number to start reading from (1-indexed). Defaults to 1 (start of file).',
        },
        limit: {
          type: 'number' as const,
          description: 'Maximum number of lines to read. Defaults to 2000.',
        },
      },
      required: ['path'] as const,
    },
  },
  {
    name: 'file_write',
    description:
      'Write content to a file, creating it if it doesn\'t exist or overwriting if it does. Content is written as-is without any encoding or escaping.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string' as const,
          description: 'Path to the file relative to the project root',
        },
        content: {
          type: 'string' as const,
          description: 'The exact content to write to the file. Written as-is, no encoding applied.',
        },
        create_dirs: {
          type: 'boolean' as const,
          description: 'Whether to create parent directories if they don\'t exist (default: true)',
        },
      },
      required: ['path', 'content'] as const,
    },
  },
  {
    name: 'file_edit',
    description:
      'Edit a specific part of a file by replacing old text with new text. The old_string must be unique in the file. Content is handled as raw text.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string' as const,
          description: 'Path to the file relative to the project root',
        },
        old_string: {
          type: 'string' as const,
          description: 'The exact text to find and replace. Must be unique in the file.',
        },
        new_string: {
          type: 'string' as const,
          description: 'The replacement text. Set to empty string to delete the old_string.',
        },
      },
      required: ['path', 'old_string', 'new_string'] as const,
    },
  },
  {
    name: 'glob',
    description:
      'Find files matching a glob pattern. Returns a list of matching file paths relative to the project root. Use this to discover files by name pattern (e.g., "**/*.ts", "src/**/*.css").',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string' as const,
          description: 'Glob pattern to match (e.g., "**/*.ts", "lib/**/*.json", "*.md")',
        },
        path: {
          type: 'string' as const,
          description: 'Directory to search in, relative to project root. Defaults to project root.',
        },
      },
      required: ['pattern'] as const,
    },
  },
  {
    name: 'grep',
    description:
      'Search for a pattern across files in the project. Returns matching lines with file paths, line numbers, and optional context. Supports regex patterns.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string' as const,
          description: 'Regular expression pattern to search for',
        },
        path: {
          type: 'string' as const,
          description: 'Directory to search in, relative to project root. Defaults to project root.',
        },
        include: {
          type: 'string' as const,
          description: 'File name pattern to include (e.g., "*.ts", "*.json"). Defaults to all files.',
        },
        context: {
          type: 'number' as const,
          description: 'Number of context lines to show around each match (default 2)',
        },
      },
      required: ['pattern'] as const,
    },
  },
  {
    name: 'list_directory',
    description:
      'List files and directories at a given path. Returns entries with name, type (file/directory), and size.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string' as const,
          description: 'Directory path relative to project root. Defaults to project root.',
        },
      },
      required: [] as const,
    },
  },
  {
    name: 'web_search',
    description:
      'Search the web for information. Returns real results with titles, snippets, and URLs. Requires a configured search provider (Brave Search, SearXNG, or SerpAPI). Falls back to a helpful error if no provider is configured.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string' as const,
          description: 'The search query',
        },
        numResults: {
          type: 'number' as const,
          description: 'Number of results to return (default 5)',
        },
      },
      required: ['query'] as const,
    },
  },
  {
    name: 'web_fetch',
    description:
      'Fetch content from a URL and extract the main text content. Useful for reading web pages, documentation, and API responses. Returns the page content as cleaned text.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string' as const,
          description: 'The URL to fetch content from',
        },
        prompt: {
          type: 'string' as const,
          description: 'Optional prompt describing what information to extract from the page',
        },
      },
      required: ['url'] as const,
    },
  },
  {
    name: 'ask_user',
    description:
      'Ask the user a question and wait for their response. Use this when you need clarification, confirmation, or a decision from the user before proceeding. Supports optional multiple-choice answers.',
    input_schema: {
      type: 'object' as const,
      properties: {
        question: {
          type: 'string' as const,
          description: 'The question to ask the user',
        },
        options: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Optional list of choices for the user to select from',
        },
      },
      required: ['question'] as const,
    },
  },
  {
    name: 'analyze_data',
    description:
      'Analyze data using an LLM. Provide the data and a question, and receive structured analysis with key findings, patterns, and recommendations. Supports any data format (JSON, CSV, text, etc.).',
    input_schema: {
      type: 'object' as const,
      properties: {
        data: {
          type: 'string' as const,
          description: 'The data to analyze. Can be JSON, CSV, plain text, or any structured format.',
        },
        question: {
          type: 'string' as const,
          description: 'The specific question or analysis request about the data',
        },
      },
      required: ['data', 'question'] as const,
    },
  },
  {
    name: 'remember',
    description:
      'Store a fact, insight, or piece of information in your persistent memory. Use this to save important findings, user preferences, or context that should persist across tasks.',
    input_schema: {
      type: 'object' as const,
      properties: {
        content: {
          type: 'string' as const,
          description: 'The information to store in memory',
        },
        importance: {
          type: 'number' as const,
          description: 'How important this memory is, from 0.0 (trivial) to 1.0 (critical). Default 0.5.',
        },
        tags: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Tags for categorizing this memory',
        },
      },
      required: ['content'] as const,
    },
  },
  {
    name: 'recall',
    description:
      'Search your persistent memory for relevant information. Use this to recall facts, preferences, or context from previous tasks and conversations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string' as const,
          description: 'What to search for in memory',
        },
        n: {
          type: 'number' as const,
          description: 'Number of results to return (default 5)',
        },
      },
      required: ['query'] as const,
    },
  },
];

// Tool execution functions
export const toolExecutors = new Map<string, (input: Record<string, unknown>) => Promise<Record<string, unknown>>>([
  ['bash', async (input) => {
    const command = input.command as string;
    const timeout = Math.min((input.timeout as number) || 30000, 120000);
    console.log(`[Tool:bash] Command: "${command.substring(0, 100)}"`);

    const blocked = isCommandBlocked(command);
    if (blocked) return { error: blocked, exitCode: 1 };

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: WORKSPACE_ROOT,
        timeout,
        maxBuffer: 1024 * 1024, // 1MB
      });
      return {
        stdout: stdout.substring(0, 50000),
        stderr: stderr.substring(0, 10000),
        exitCode: 0,
      };
    } catch (error: unknown) {
      const execError = error as { stdout?: string; stderr?: string; code?: number; killed?: boolean };
      return {
        stdout: (execError.stdout || '').substring(0, 50000),
        stderr: (execError.stderr || '').substring(0, 10000),
        exitCode: execError.killed ? -1 : (execError.code || 1),
        error: execError.killed ? `Command timed out after ${timeout}ms` : undefined,
      };
    }
  }],

  ['file_read', async (input) => {
    const filePath = input.path as string;
    const offset = (input.offset as number) || 1;
    const limit = (input.limit as number) || 2000;
    console.log(`[Tool:file_read] Reading: ${filePath} (offset: ${offset}, limit: ${limit})`);

    const sandboxed = sandboxPath(filePath);
    if ('error' in sandboxed) return { error: sandboxed.error };

    const fs = await import('fs');
    try {
      const content = fs.readFileSync(sandboxed.fullPath, 'utf-8');
      const allLines = content.split('\n');
      const startLine = Math.max(1, offset) - 1;
      const endLine = Math.min(allLines.length, startLine + limit);
      const selectedLines = allLines.slice(startLine, endLine);

      // Format with line numbers like cat -n
      const numberedContent = selectedLines
        .map((line, idx) => `${startLine + idx + 1}\t${line}`)
        .join('\n');

      return {
        path: sandboxed.safe,
        content: numberedContent,
        totalLines: allLines.length,
        shownLines: selectedLines.length,
        startLine: startLine + 1,
        endLine: endLine,
        size: content.length,
      };
    } catch (error) {
      return { error: `Could not read file: ${error instanceof Error ? error.message : 'Unknown error'}`, path: filePath };
    }
  }],

  ['file_write', async (input) => {
    const filePath = input.path as string;
    let content = input.content as string;
    const createDirs = (input.create_dirs as boolean) ?? true;
    console.log(`[Tool:file_write] Writing: ${filePath} (${content.length} chars)`);

    const sandboxed = sandboxPath(filePath);
    if ('error' in sandboxed) return { error: sandboxed.error };

    // Decode HTML entities if content appears encoded
    if (content.includes('&amp;') || content.includes('&lt;') || content.includes('&gt;') || content.includes('&quot;')) {
      content = content
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }

    const fs = await import('fs');
    try {
      if (createDirs) {
        const dir = path.dirname(sandboxed.fullPath);
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(sandboxed.fullPath, content, 'utf-8');
      return { success: true, path: sandboxed.safe, size: content.length };
    } catch (error) {
      return { error: `Could not write file: ${error instanceof Error ? error.message : 'Unknown error'}`, path: filePath };
    }
  }],

  ['file_edit', async (input) => {
    const filePath = input.path as string;
    let oldString = input.old_string as string;
    let newString = input.new_string as string;
    console.log(`[Tool:file_edit] Editing: ${filePath}`);

    const sandboxed = sandboxPath(filePath);
    if ('error' in sandboxed) return { error: sandboxed.error };

    // Decode HTML entities in both old and new strings if they appear encoded
    const decode = (s: string) => {
      if (s.includes('&amp;') || s.includes('&lt;') || s.includes('&gt;') || s.includes('&quot;')) {
        return s
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
      }
      return s;
    };
    oldString = decode(oldString);
    newString = decode(newString);

    const fs = await import('fs');
    try {
      const content = fs.readFileSync(sandboxed.fullPath, 'utf-8');
      if (!content.includes(oldString)) {
        return { error: `old_string not found in ${sandboxed.safe}. Make sure the string matches exactly.`, path: sandboxed.safe };
      }
      const occurrences = content.split(oldString).length - 1;
      if (occurrences > 1) {
        return { error: `old_string appears ${occurrences} times in ${sandboxed.safe}. Provide more context to make it unique.`, path: sandboxed.safe };
      }
      const newContent = content.replace(oldString, newString);
      fs.writeFileSync(sandboxed.fullPath, newContent, 'utf-8');
      return { success: true, path: sandboxed.safe, replaced: 1 };
    } catch (error) {
      return { error: `Could not edit file: ${error instanceof Error ? error.message : 'Unknown error'}`, path: filePath };
    }
  }],

  ['glob', async (input) => {
    const pattern = input.pattern as string;
    const searchPath = (input.path as string) || '.';
    console.log(`[Tool:glob] Pattern: "${pattern}" in ${searchPath}`);

    const sandboxed = sandboxPath(searchPath);
    if ('error' in sandboxed) return { error: sandboxed.error };

    const fs = await import('fs');
    const stat = await fs.promises.stat(sandboxed.fullPath).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      return { error: `Path is not a directory: ${searchPath}` };
    }

    const regex = globToRegex(pattern);
    const maxResults = 100;
    const files = await walkDir(sandboxed.fullPath, regex, sandboxed.fullPath, maxResults);

    return {
      pattern,
      path: searchPath,
      files,
      total: files.length,
      truncated: files.length >= maxResults,
    };
  }],

  ['grep', async (input) => {
    const pattern = input.pattern as string;
    const searchPath = (input.path as string) || '.';
    const include = input.include as string | undefined;
    const contextLines = (input.context as number) || 2;
    console.log(`[Tool:grep] Pattern: "${pattern}" in ${searchPath}${include ? ` (include: ${include})` : ''}`);

    const sandboxed = sandboxPath(searchPath);
    if ('error' in sandboxed) return { error: sandboxed.error };

    const fs = await import('fs');
    const stat = await fs.promises.stat(sandboxed.fullPath).catch(() => null);
    if (!stat) return { error: `Path not found: ${searchPath}` };
    if (!stat.isDirectory()) {
      // Search single file
      try {
        const content = fs.readFileSync(sandboxed.fullPath, 'utf-8');
        const lines = content.split('\n');
        const regex = new RegExp(pattern, 'i');
        const matches: { file: string; line: number; content: string; context?: string }[] = [];
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            const contextStart = Math.max(0, i - contextLines);
            const contextEnd = Math.min(lines.length - 1, i + contextLines);
            matches.push({
              file: sandboxed.safe,
              line: i + 1,
              content: lines[i].trim(),
              context: lines.slice(contextStart, contextEnd + 1).map((l, idx) => `${contextStart + idx + 1}: ${l}`).join('\n'),
            });
          }
        }
        return { pattern, path: searchPath, matches, total: matches.length };
      } catch (error) {
        return { error: `Could not read file: ${error instanceof Error ? error.message : 'Unknown error'}` };
      }
    }

    const includeRegex = include ? globToRegex(include) : null;
    const searchRegex = new RegExp(pattern, 'i');
    const maxResults = 50;
    const matches = await searchFiles(sandboxed.fullPath, searchRegex, includeRegex, contextLines, maxResults);

    return {
      pattern,
      path: searchPath,
      matches,
      total: matches.length,
      truncated: matches.length >= maxResults,
    };
  }],

  ['list_directory', async (input) => {
    const dirPath = (input.path as string) || '.';
    console.log(`[Tool:list_directory] Listing: ${dirPath}`);

    const sandboxed = sandboxPath(dirPath);
    if ('error' in sandboxed) return { error: sandboxed.error };

    const fs = await import('fs');
    try {
      const entries = fs.readdirSync(sandboxed.fullPath, { withFileTypes: true });
      const listing = entries
        .filter(entry => !entry.name.startsWith('.'))
        .map(entry => ({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          path: path.relative(WORKSPACE_ROOT, path.join(sandboxed.fullPath, entry.name)),
        }))
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      return { path: dirPath, entries: listing, total: listing.length };
    } catch (error) {
      return { error: `Could not list directory: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }],

  ['web_search', async (input) => {
    const query = input.query as string;
    const numResults = (input.numResults as number) || 5;
    console.log(`[Tool:web_search] Query: "${query}", numResults: ${numResults}`);

    const apiKey = process.env.BRAVE_SEARCH_API_KEY || process.env.WEB_SEARCH_API_KEY;
    const provider = (process.env.WEB_SEARCH_PROVIDER || 'brave').toLowerCase();

    // Try real search providers
    if (apiKey && provider === 'brave') {
      try {
        const response = await fetch(
          `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${numResults}`,
          { headers: { 'X-Subscription-Token': apiKey } },
        );
        if (response.ok) {
          const data = await response.json() as { web?: { results?: Array<{ title?: string; description?: string; url?: string }> } };
          const results = (data.web?.results || []).map((r) => ({
            title: r.title || 'Untitled',
            snippet: r.description || '',
            url: r.url || '',
          }));
          return { query, results, totalFound: results.length, provider: 'brave' };
        }
      } catch {
        // Fall through to error message
      }
    }

    if (apiKey && provider === 'serpapi') {
      try {
        const response = await fetch(
          `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=${numResults}&api_key=${apiKey}`,
        );
        if (response.ok) {
          const data = await response.json() as { organic_results?: Array<{ title?: string; snippet?: string; link?: string }> };
          const results = (data.organic_results || []).map((r) => ({
            title: r.title || 'Untitled',
            snippet: r.snippet || '',
            url: r.link || '',
          }));
          return { query, results, totalFound: results.length, provider: 'serpapi' };
        }
      } catch {
        // Fall through to error message
      }
    }

    // No provider configured
    return {
      query,
      results: [],
      totalFound: 0,
      error: 'Web search requires a search provider. Set BRAVE_SEARCH_API_KEY (for Brave Search) or WEB_SEARCH_API_KEY + WEB_SEARCH_PROVIDER=serpapi in your .env file.',
      hint: 'For Brave Search, get an API key at https://brave.com/search/api/. For SerpAPI, visit https://serpapi.com/.',
    };
  }],

  ['web_fetch', async (input) => {
    const url = input.url as string;
    const prompt = (input.prompt as string) || 'Extract the main content from this page';
    console.log(`[Tool:web_fetch] URL: ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'TeamForge/1.0 (Research Agent)',
          'Accept': 'text/html,application/json,text/plain',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return { error: `HTTP ${response.status}: ${response.statusText}`, url };
      }

      const contentType = response.headers.get('content-type') || '';
      const body = await response.text();

      // Strip HTML to plain text for HTML responses
      let content: string;
      if (contentType.includes('text/html')) {
        content = body
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();
      } else {
        content = body;
      }

      // Truncate if too long
      const maxChars = 10000;
      const truncated = content.length > maxChars;
      content = content.substring(0, maxChars);

      return {
        url,
        content,
        truncated,
        totalChars: content.length + (truncated ? content.length - maxChars : 0),
        contentType,
      };
    } catch (error) {
      return { error: `Failed to fetch URL: ${error instanceof Error ? error.message : 'Unknown error'}`, url };
    }
  }],

  ['ask_user', async (input) => {
    const question = input.question as string;
    const options = (input.options as string[]) || undefined;
    const agentId = (input._agentId as string) || 'unknown';

    // Import dynamically to avoid circular dependency
    const { requestUserQuestion } = await import('../question');
    const result = await requestUserQuestion({
      agentId,
      question,
      options,
    });

    return {
      question,
      answer: result.answer,
      answered: true,
    };
  }],

  ['analyze_data', async (input) => {
    const data = input.data as string;
    const question = input.question as string;
    console.log(`[Tool:analyze_data] Analyzing ${data.length} chars for: "${question.substring(0, 80)}"`);

    const apiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        data: data.substring(0, 2000),
        question,
        error: 'ANTHROPIC_API_KEY not configured. Cannot perform LLM-based analysis.',
      };
    }

    try {
      const client = createAnthropicClient(apiKey);
      const response = await client.messages.create({
        model: FAST_MODEL,
        max_tokens: 2000,
        system: 'You are a data analyst. Analyze the provided data and answer the user\'s question. Be specific, structured, and actionable. Use markdown formatting for clarity.',
        messages: [
          {
            role: 'user',
            content: `## Data\n\`\`\`\n${data.substring(0, 8000)}\n\`\`\`\n\n## Question\n${question}`,
          },
        ],
      });

      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
      return {
        question,
        analysis: textBlock?.text || 'No analysis generated',
        dataProvided: data.length,
        dataTruncated: data.length > 8000,
        model: FAST_MODEL,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    } catch (error) {
      return {
        data: data.substring(0, 2000),
        question,
        error: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }],

  ['remember', async (input) => {
    const content = input.content as string;
    const importance = (input.importance as number) || 0.5;
    const tags = (input.tags as string[]) || [];
    const agentId = (input._agentId as string) || 'current';
    console.log(`[Tool:remember] Agent:${agentId} Storing: "${content.substring(0, 50)}..."`);
    try {
      const memory = await memawi.remember({
        content,
        agentId,
        level: 'agent',
        importance,
        tags,
        source: 'agent-tool',
      });
      return { stored: true, memory_id: memory.memory_id };
    } catch {
      return { stored: false, note: 'Memory server unavailable, content noted locally' };
    }
  }],

  ['recall', async (input) => {
    const query = input.query as string;
    const n = (input.n as number) || 5;
    const agentId = (input._agentId as string) || 'current';
    console.log(`[Tool:recall] Agent:${agentId} Searching: "${query}"`);
    try {
      const results = await memawi.recall({ query, agentId, n });
      return {
        query,
        found: results.length,
        memories: results.map(r => ({
          content: r.memory.content,
          importance: r.memory.importance,
          tags: r.memory.tags,
          relevance: r.score.toFixed(2),
          created: r.memory.created_at,
        })),
      };
    } catch {
      return { query, found: 0, memories: [], note: 'Memory server unavailable' };
    }
  }],
]);

// Get the tools available to a specific agent based on its configured tools
export function getToolsForAgent(agentId: string): {
  definitions: Anthropic.Tool[];
  executors: Map<string, (input: Record<string, unknown>) => Promise<Record<string, unknown>>>;
} {
  const agent = predefinedAgents.find(a => a.id === agentId);
  const agentTools = agent?.tools || ['bash', 'file_read', 'web_search'];

  const definitions = toolDefinitions.filter(t => agentTools.includes(t.name));
  type ToolExecutor = (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  const executors = new Map<string, ToolExecutor>();

  for (const def of definitions) {
    const baseExecutor = toolExecutors.get(def.name);
    if (!baseExecutor) continue;

    // Wrap remember/recall executors to inject the real agentId instead of 'current'
    if (def.name === 'remember' || def.name === 'recall') {
      const capturedAgentId = agentId;
      executors.set(def.name, async (input) => {
        return baseExecutor({ ...input, _agentId: capturedAgentId });
      });
    } else {
      executors.set(def.name, baseExecutor);
    }
  }

  return { definitions, executors };
}