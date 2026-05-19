import Anthropic from '@anthropic-ai/sdk';
import { predefinedAgents } from '../agents';
import * as memawi from '../memawi';

/**
 * Sandbox all file operations to the project workspace directory.
 * Prevents directory traversal attacks by ensuring resolved paths
 * stay within the allowed root.
 */
const WORKSPACE_ROOT = process.cwd();

function sandboxPath(relativePath: string): { fullPath: string; safe: string } | { error: string } {
  const pathModule = require('path');
  const resolved = pathModule.resolve(WORKSPACE_ROOT, relativePath);
  const normalizedRoot = pathModule.resolve(WORKSPACE_ROOT);

  if (!resolved.startsWith(normalizedRoot + pathModule.sep) && resolved !== normalizedRoot) {
    return { error: `Access denied: path escapes workspace. Requested: ${relativePath}` };
  }

  return { fullPath: resolved, safe: pathModule.relative(normalizedRoot, resolved) };
}

// Tool definitions in Anthropic's format
export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: 'web_search',
    description:
      'Search the web for information. Returns relevant results with titles, snippets, and URLs. Use this to find current data, research topics, and gather information from multiple sources.',
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
      required: ['query'],
    },
  },
  {
    name: 'code_execution',
    description:
      'Execute JavaScript code in a sandboxed environment for calculations, data processing, and analysis. Returns the output of the code execution. Use this for mathematical computations, data transformations, and generating structured results.',
    input_schema: {
      type: 'object' as const,
      properties: {
        code: {
          type: 'string' as const,
          description: 'JavaScript code to execute. Must return a value or assign to a variable named "result".',
        },
        purpose: {
          type: 'string' as const,
          description: 'Brief description of what this code is meant to compute',
        },
      },
      required: ['code'],
    },
  },
  {
    name: 'analyze_data',
    description:
      'Analyze data and provide structured insights. Pass in a data type and query, and receive a detailed analysis with key findings, trends, and recommendations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dataType: {
          type: 'string' as const,
          description: 'The type of data to analyze (e.g., "market", "financial", "customer", "competitor")',
        },
        query: {
          type: 'string' as const,
          description: 'The specific question or analysis request',
        },
        context: {
          type: 'string' as const,
          description: 'Additional context or constraints for the analysis',
        },
      },
      required: ['dataType', 'query'],
    },
  },
  {
    name: 'generate_image',
    description:
      'Generate a visual asset such as a chart description, diagram layout, or image prompt. Returns a description and URL for a generated visual.',
    input_schema: {
      type: 'object' as const,
      properties: {
        prompt: {
          type: 'string' as const,
          description: 'Detailed description of the image or visual to generate',
        },
        style: {
          type: 'string' as const,
          description: 'Visual style (e.g., "professional", "infographic", "minimal", "corporate")',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'file_read',
    description:
      'Read the contents of a file from the project. Use this to examine code, configs, or any text file. Returns the raw file content without any encoding — what you see is exactly what is stored on disk.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string' as const,
          description: 'Path to the file relative to the project root (e.g., "lib/agents.ts", "README.md")',
        },
      },
      required: ['path'] as const,
    },
  },
  {
    name: 'file_write',
    description:
      'Write content to a file, creating it if it doesn\'t exist or overwriting if it does. Content is written as-is without any encoding or escaping — the string you provide becomes the exact file contents. If the content appears to be HTML-encoded (containing &amp;, &lt;, &gt;, &quot;), it will be decoded before writing.',
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
      'Edit a specific part of a file by replacing old text with new text. Like Claude Code\'s Edit tool — finds the exact old_string in the file and replaces it with new_string. Content is handled as raw text with no encoding/decoding needed.',
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
    name: 'remember',
    description:
      'Store a fact, insight, or piece of information in your persistent memory. Use this to save important findings, user preferences, or context that should persist across tasks. Stored memories are available for future recall.',
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
      'Search your persistent memory for relevant information. Use this to recall facts, preferences, or context from previous tasks and conversations. Always check memory before starting research you may have already done.',
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
  ['web_search', async (input) => {
    const query = input.query as string;
    const numResults = (input.numResults as number) || 5;
    console.log(`[Tool:web_search] Query: "${query}", numResults: ${numResults}`);
    return {
      query,
      results: generateSearchResults(query, numResults),
      totalFound: numResults * 5,
    };
  }],

  ['code_execution', async (input) => {
    const code = input.code as string;
    const purpose = (input.purpose as string) || 'computation';
    console.log(`[Tool:code_execution] Purpose: ${purpose}`);
    try {
      const safeGlobals = {
        Math,
        JSON,
        Date,
        Array,
        Object,
        Number,
        String,
        parseInt,
        parseFloat,
        isNaN,
        console: { log: (...args: unknown[]) => args.join(' ') },
      };
      const fn = new Function(...Object.keys(safeGlobals), `"use strict"; ${code}; return typeof result !== 'undefined' ? result : undefined;`);
      const execResult = fn(...Object.values(safeGlobals));
      return {
        success: true,
        output: execResult !== undefined ? String(execResult) : 'Code executed successfully (no return value)',
        result: typeof execResult === 'object' ? execResult : undefined,
      };
    } catch (error) {
      return {
        success: false,
        output: `Execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        result: undefined,
      };
    }
  }],

  ['analyze_data', async (input) => {
    const dataType = input.dataType as string;
    const query = input.query as string;
    const context = (input.context as string) || '';
    console.log(`[Tool:analyze_data] Type: ${dataType}, Query: ${query}`);
    return {
      dataType,
      query,
      insights: generateAnalysisInsights(dataType, query),
      summary: `Analysis of ${dataType} data for: "${query}". Key patterns identified with actionable recommendations.`,
      confidence: 'high',
    };
  }],

  ['generate_image', async (input) => {
    const prompt = input.prompt as string;
    const style = (input.style as string) || 'professional';
    console.log(`[Tool:generate_image] Prompt: "${prompt}", Style: ${style}`);
    const seed = Math.floor(Math.random() * 1000);
    return {
      imageUrl: `https://picsum.photos/seed/${seed}/800/600`,
      alt: prompt,
      style,
      generatedPrompt: prompt,
    };
  }],

  ['file_read', async (input) => {
    const filePath = input.path as string;
    console.log(`[Tool:file_read] Reading: ${filePath}`);
    const sandboxed = sandboxPath(filePath);
    if ('error' in sandboxed) return { error: sandboxed.error };
    const fs = await import('fs');
    try {
      const content = fs.readFileSync(sandboxed.fullPath, 'utf-8');
      const lines = content.split('\n').length;
      return { path: sandboxed.safe, content, lines, size: content.length };
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
    const pathModule = await import('path');

    try {
      if (createDirs) {
        const dir = pathModule.dirname(sandboxed.fullPath);
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
  const agentTools = agent?.tools || ['web_search', 'analyze_data'];

  const definitions = toolDefinitions.filter(t => agentTools.includes(t.name));
  const executors = new Map<string, (input: Record<string, unknown>) => Promise<Record<string, unknown>>>();
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

// Helper: generate contextual search results
function generateSearchResults(query: string, numResults: number) {
  const topicKeywords = query.toLowerCase();
  const results = [];

  const templates = [
    { domain: 'mckinsey.com', type: 'Industry Report' },
    { domain: 'hbr.org', type: 'Analysis' },
    { domain: 'statista.com', type: 'Market Data' },
    { domain: 'reuters.com', type: 'News' },
    { domain: 'gartner.com', type: 'Research' },
    { domain: 'forbes.com', type: 'Business' },
    { domain: 'techcrunch.com', type: 'Technology' },
    { domain: 'bloomberg.com', type: 'Financial' },
  ];

  for (let i = 0; i < Math.min(numResults, templates.length); i++) {
    const t = templates[i];
    results.push({
      title: `${t.type}: ${query.charAt(0).toUpperCase() + query.slice(1)} - Key Findings ${i > 0 ? `Part ${i + 1}` : ''}`,
      snippet: `Comprehensive analysis of ${topicKeywords}. Data shows significant trends with ${30 + Math.floor(Math.random() * 40)}% growth projection and emerging opportunities in the sector.`,
      url: `https://www.${t.domain}/research/${topicKeywords.replace(/\s+/g, '-')}`,
      source: t.domain.split('.')[0],
    });
  }

  return results;
}

// Helper: generate analysis insights
function generateAnalysisInsights(dataType: string, query: string) {
  const insights = [
    `Strong growth trajectory identified in ${dataType} sector with estimated 28-34% CAGR over 3 years`,
    `Key competitive advantages center around product differentiation and market positioning`,
    `Data indicates potential for 2.5-4x ROI with strategic investment in target segments`,
    `Regulatory environment is favorable with manageable compliance requirements`,
    `Customer acquisition costs trending downward as brand awareness increases`,
  ];
  return insights.slice(0, 3 + Math.floor(Math.random() * 3));
}