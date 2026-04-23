import { z } from 'zod';

/** Minimal tool shape compatible with coordinator usage (no @mastra/core Tool class in this package version). */
function defineTool<TIn extends z.ZodTypeAny, TOut extends z.ZodTypeAny>(def: {
  id: string;
  description: string;
  inputSchema: TIn;
  outputSchema: TOut;
  execute: (args: { context: z.input<TIn> }) => Promise<z.infer<TOut>>;
}) {
  return def;
}

export const webSearchTool = defineTool({
  id: 'web-search',
  description: 'Search the web for up-to-date information and return summarized results',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    numResults: z.number().optional().default(5),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      title: z.string(),
      snippet: z.string(),
      url: z.string(),
    })),
  }),
  execute: async ({ context }) => {
    console.log(`[Tool] web-search: ${context.query}`);
    return {
      results: [
        {
          title: `Results for: ${context.query}`,
          snippet: 'Comprehensive analysis from leading research firms... Market size, trends, regulatory considerations for European expansion.',
          url: 'https://example.com/research',
        },
      ],
    };
  },
});

export const codeExecutionTool = defineTool({
  id: 'code-execution',
  description: 'Execute code in a secure sandbox (Python/JS) for calculations, analysis, and visualizations',
  inputSchema: z.object({
    code: z.string(),
    language: z.enum(['python', 'javascript']).default('python'),
  }),
  outputSchema: z.object({
    output: z.string(),
    results: z.record(z.any()).optional(),
  }),
  execute: async ({ context }) => {
    console.log(`[Tool] code-execution (${context.language})`);
    return {
      output: 'Code executed successfully.',
      results: {
        year1Revenue: 2450000,
        year2Revenue: 4120000,
        year3Revenue: 6780000,
        totalRevenue: 13350000,
        roi: '4.2x',
      },
    };
  },
});

export const imageGenerationTool = defineTool({
  id: 'image-generation',
  description: 'Generate images using Flux, DALL·E, or similar models',
  inputSchema: z.object({
    prompt: z.string(),
    style: z.string().optional().default('professional'),
  }),
  outputSchema: z.object({
    imageUrl: z.string(),
    alt: z.string(),
  }),
  execute: async ({ context }) => {
    console.log(`[Tool] image-generation: ${context.prompt}`);
    return {
      imageUrl: `https://picsum.photos/id/${Math.floor(Math.random() * 100) + 20}/800/600`,
      alt: context.prompt,
    };
  },
});

export const mastraTools = {
  webSearch: webSearchTool,
  codeExecution: codeExecutionTool,
  imageGeneration: imageGenerationTool,
};
