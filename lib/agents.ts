import { Agent, ToolDefinition, AgentMessage } from './types';
import { z } from 'zod';

// Predefined specialized agents
export const predefinedAgents: Agent[] = [
  {
    id: 'coordinator',
    name: 'Coordinator',
    role: 'Orchestrator & Planner',
    description: 'Analyzes goals, creates detailed execution plans, coordinates specialized agents, and synthesizes final deliverables.',
    systemPrompt: `You are the Coordinator Agent. Your job is to break down complex user goals into structured plans with subtasks, assign them to the right specialized agents, monitor progress, and synthesize high-quality deliverables. Always use structured JSON outputs for plans.`,
    model: 'grok-3-beta',
    color: '#3b82f6',
    skills: ['planning', 'orchestration', 'synthesis', 'structured-output'],
    tools: ['web_search', 'code_execution', 'analyze_data'],
    provider: 'xai',
    status: 'active',
    memorySize: 25,
    isCustom: false,
    guardrails: {
      maxTokens: 8000,
      maxCost: 5,
      requireApproval: true,
    },
  },
  {
    id: 'researcher',
    name: 'Alex Rivera',
    role: 'Lead Researcher',
    description: 'Expert at web research, competitive analysis, market trends, and gathering comprehensive information from multiple sources.',
    systemPrompt: `You are Alex Rivera, a world-class researcher. Use web search, browsing, and analysis tools to gather accurate, up-to-date information. Always cite sources and look for primary data.`,
    model: 'gpt-4o',
    color: '#10b981',
    skills: ['web-search', 'browse-page', 'competitive-analysis', 'data-synthesis'],
    tools: ['web_search', 'analyze_data'],
    status: 'active',
    memorySize: 40,
  },
  {
    id: 'analyst',
    name: 'Dr. Lena Chen',
    role: 'Financial & Data Analyst',
    description: 'Builds financial models, projections, data analysis, visualizations, and provides quantitative insights.',
    systemPrompt: `You are Dr. Lena Chen, a senior financial analyst and data scientist. Create detailed models, projections, charts, and data-driven recommendations. Use code execution for calculations.`,
    model: 'claude-3-opus',
    color: '#8b5cf6',
    skills: ['financial-modeling', 'data-analysis', 'chart-generation', 'statistical-analysis'],
    tools: ['code_execution', 'analyze_data'],
    status: 'active',
    memorySize: 30,
  },
  {
    id: 'writer',
    name: 'Marcus Hale',
    role: 'Content & Strategy Writer',
    description: 'Creates compelling narratives, go-to-market strategies, presentations, executive summaries, and polished deliverables.',
    systemPrompt: `You are Marcus Hale, an expert strategist and writer. Transform research and analysis into clear, persuasive, professional documents, slide decks, and strategies.`,
    model: 'gpt-4o',
    color: '#f59e0b',
    skills: ['copywriting', 'strategy-development', 'presentation-design', 'executive-communication'],
    tools: ['web_search', 'analyze_data'],
    status: 'active',
    memorySize: 20,
  },
  {
    id: 'visualizer',
    name: 'Sofia Patel',
    role: 'Data Visualizer & Designer',
    description: 'Creates beautiful charts, infographics, interactive dashboards, and visual assets using generation tools.',
    systemPrompt: `You are Sofia Patel, a data visualization and design expert. Generate high-quality charts, diagrams, images, and interactive components that make complex information intuitive.`,
    model: 'gemini-1.5-pro',
    color: '#ec4899',
    skills: ['charting', 'image-generation', 'ui-design', 'dashboard-creation'],
    tools: ['generate_image', 'analyze_data', 'code_execution'],
    status: 'active',
    memorySize: 15,
  },
];

// Mock tools for demonstration
export const availableTools: ToolDefinition[] = [
  {
    name: 'web_search',
    description: 'Perform web searches and return summarized results with sources',
    parameters: z.object({
      query: z.string(),
      numResults: z.number().optional().default(5),
    }),
    execute: async (args: any) => {
      // Simulated response
      await new Promise(resolve => setTimeout(resolve, 800));
      return {
        results: [
          { title: `Result for: ${args.query}`, snippet: 'Comprehensive market data and trends from reliable sources...', url: 'https://example.com/research1', source: 'McKinsey, Gartner' },
          { title: 'European SaaS Market Analysis 2026', snippet: 'The European market is projected to grow 28% YoY...', url: 'https://example.com/eu-market', source: 'Statista' },
        ],
        totalResults: 24,
      };
    },
  },
  {
    name: 'code_execution',
    description: 'Execute Python or JS code in a secure sandbox for calculations, data analysis, visualizations',
    parameters: z.object({
      code: z.string(),
      language: z.enum(['python', 'javascript']).default('python'),
    }),
    execute: async (args: any) => {
      await new Promise(resolve => setTimeout(resolve, 1200));
      if (args.code.includes('financial') || args.code.includes('projection')) {
        return {
          output: 'Financial projections calculated successfully.',
          results: {
            year1: 2450000,
            year2: 4120000,
            year3: 6780000,
            totalRevenue: 13350000,
            cac: 89,
            ltv: 1240,
            roi: '4.2x',
          },
          chartData: [
            { month: 'Jan', revenue: 120000, cost: 45000 },
            { month: 'Feb', revenue: 185000, cost: 52000 },
            // ... more data
          ],
        };
      }
      return { output: 'Code executed successfully. Results available.', success: true };
    },
  },
  {
    name: 'generate_image',
    description: 'Generate images using Flux or DALL-E based on detailed prompts',
    parameters: z.object({
      prompt: z.string(),
      style: z.string().optional(),
    }),
    execute: async (args: any) => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      return {
        imageUrl: `https://picsum.photos/id/${Math.floor(Math.random() * 100) + 10}/800/600`,
        alt: args.prompt,
        generatedPrompt: args.prompt,
      };
    },
  },
  {
    name: 'analyze_data',
    description: 'Analyze CSV, JSON, or database data and return insights',
    parameters: z.object({
      dataType: z.string(),
      query: z.string(),
    }),
    execute: async (args: any) => {
      await new Promise(resolve => setTimeout(resolve, 900));
      return {
        insights: [
          'Strong growth in EU markets (est. 34% CAGR)',
          'Key competitors: Notion, Coda, Monday.com',
          'Recommended pricing tier for Europe: €49-€199/mo',
        ],
        summary: 'Market opportunity identified with $2.8B TAM in Europe by 2028.',
      };
    },
  },
];

const agentMessageSets: Record<string, (task: string) => { content: string; role: AgentMessage['role'] }[]> = {
  researcher: (task) => [
    { content: `🔍 Starting: ${task}`, role: 'system' },
    { content: `I'll research this thoroughly using web search and competitive analysis tools.`, role: 'assistant' },
    { content: `Tool call: web_search(query="${task.substring(0, 50)}")`, role: 'tool' },
    { content: `Found 23 high-quality sources. Key themes emerging around market sizing, regulatory landscape, and key players.`, role: 'assistant' },
    { content: `Tool call: analyze_data(dataType="market_data", query="trends and opportunities")`, role: 'tool' },
    { content: `Research complete. Identified major opportunities and risks. Synthesizing findings for the team.`, role: 'assistant' },
  ],
  analyst: (task) => [
    { content: `📊 Starting: ${task}`, role: 'system' },
    { content: `I'll build a rigorous financial model using code execution and data analysis.`, role: 'assistant' },
    { content: `Tool call: code_execution(language="python", code="# Build 3-year financial projections\\nrevenue = [2.45e6, 4.12e6, 6.78e6]")`, role: 'tool' },
    { content: `Model built. Year 1: $2.45M → Year 3: $6.78M. CAC: $89, LTV: $1,240, ROI: 4.2x.`, role: 'assistant' },
    { content: `Tool call: analyze_data(dataType="financial", query="sensitivity analysis and break-even")`, role: 'tool' },
    { content: `Analysis complete. Break-even at month 14. High confidence in projections based on comparable market data.`, role: 'assistant' },
  ],
  writer: (task) => [
    { content: `✍️ Starting: ${task}`, role: 'system' },
    { content: `I'll draft a compelling strategic narrative backed by the team's research and financial data.`, role: 'assistant' },
    { content: `Tool call: analyze_data(dataType="strategy", query="positioning and differentiation")`, role: 'tool' },
    { content: `Positioning analysis complete. Three differentiated angles identified vs. key competitors.`, role: 'assistant' },
    { content: `Tool call: web_search(query="best practices go-to-market strategy 2026")`, role: 'tool' },
    { content: `Strategy document drafted. Includes phased rollout plan, pricing framework, and channel recommendations.`, role: 'assistant' },
  ],
  visualizer: (task) => [
    { content: `🎨 Starting: ${task}`, role: 'system' },
    { content: `I'll create visual assets and an executive dashboard that makes the data immediately clear.`, role: 'assistant' },
    { content: `Tool call: generate_image(prompt="executive dashboard with market opportunity visualization", style="professional")`, role: 'tool' },
    { content: `Dashboard mockup generated. Clean, executive-ready layout with key KPIs highlighted.`, role: 'assistant' },
    { content: `Tool call: code_execution(language="javascript", code="// Render interactive Recharts components")`, role: 'tool' },
    { content: `All visual assets complete. Charts, infographics, and dashboard are ready for delivery.`, role: 'assistant' },
  ],
};

// Simulate agent response streaming
export function simulateAgentResponse(
  agentId: string,
  task: string,
  onMessage: (message: AgentMessage) => void,
  onComplete?: () => void
) {
  const agent = predefinedAgents.find(a => a.id === agentId);
  if (!agent) return;

  const messageSet = agentMessageSets[agentId] ?? agentMessageSets['researcher'];
  const messages = messageSet(task);

  let index = 0;
  const interval = setInterval(() => {
    if (index < messages.length) {
      const msg: AgentMessage = {
        id: `msg-${Date.now()}-${index}`,
        agentId,
        role: messages[index].role,
        content: messages[index].content,
        timestamp: new Date(),
      };
      onMessage(msg);
      index++;
    } else {
      clearInterval(interval);
      if (onComplete) onComplete();
    }
  }, 650);
}
