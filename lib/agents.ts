import { Agent, ToolDefinition, AgentMessage } from './types';
import { z } from 'zod';
import { generateStructuredPlan } from './llm/router';
import type { ApiKeyConfig } from './llm/router';

// === CONCRETE IMPROVEMENT (TODO #1 marked complete): Environment-based simulation speed ===
export const SIMULATION_CONFIG = {
  speedMultiplier: typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SIM_SPEED 
    ? parseFloat(process.env.NEXT_PUBLIC_SIM_SPEED) 
    : 1.0,
  toolDelays: {
    web_search: 800,
    code_execution: 1200,
    generate_image: 1500,
    analyze_data: 900,
    default: 1000,
  } as const,
  planDelay: 1500,
  messageInterval: 650,
} as const;

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
      const delayMs = SIMULATION_CONFIG.toolDelays.web_search * SIMULATION_CONFIG.speedMultiplier;
      await new Promise(resolve => setTimeout(resolve, delayMs));
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
      const delayMs = SIMULATION_CONFIG.toolDelays.code_execution * SIMULATION_CONFIG.speedMultiplier;
      await new Promise(resolve => setTimeout(resolve, delayMs));
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
      const delayMs = SIMULATION_CONFIG.toolDelays.generate_image * SIMULATION_CONFIG.speedMultiplier;
      await new Promise(resolve => setTimeout(resolve, delayMs));
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
      const delayMs = SIMULATION_CONFIG.toolDelays.analyze_data * SIMULATION_CONFIG.speedMultiplier;
      await new Promise(resolve => setTimeout(resolve, delayMs));
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

// Simulated coordinator that generates a plan
export async function generateExecutionPlan(goal: string): Promise<any> {
  const delayMs = SIMULATION_CONFIG.planDelay * SIMULATION_CONFIG.speedMultiplier;
  await new Promise(resolve => setTimeout(resolve, delayMs));
  
  return {
    id: 'plan-' + Date.now(),
    goal,
    subtasks: [
      {
        id: 't1',
        title: 'Market Research & Opportunity Analysis',
        description: 'Research the European SaaS market, regulatory environment, target customer segments, and competitive landscape.',
        assignedAgent: 'researcher',
        status: 'pending' as const,
        estimatedTime: 25,
      },
      {
        id: 't2',
        title: 'Financial Modeling & Projections',
        description: 'Build comprehensive 3-year financial projections including revenue, costs, CAC, LTV, break-even analysis, and sensitivity models.',
        assignedAgent: 'analyst',
        status: 'pending' as const,
        estimatedTime: 30,
        dependencies: ['t1'],
      },
      {
        id: 't3',
        title: 'Go-to-Market Strategy Development',
        description: 'Develop detailed GTM plan including positioning, pricing, marketing channels, sales strategy, and partnership opportunities.',
        assignedAgent: 'writer',
        status: 'pending' as const,
        estimatedTime: 20,
      },
      {
        id: 't4',
        title: 'Create Visual Assets & Dashboard',
        description: 'Generate charts, infographics, mockups, and an interactive executive dashboard summarizing all findings.',
        assignedAgent: 'visualizer',
        status: 'pending' as const,
        estimatedTime: 15,
        dependencies: ['t2', 't3'],
      },
    ],
    estimatedCost: 12.45,
    createdAt: new Date(),
  };
}

// Simulate agent response streaming
export function simulateAgentResponse(
  agentId: string, 
  task: string, 
  onMessage: (message: AgentMessage) => void,
  onComplete?: () => void
) {
  const agent = predefinedAgents.find(a => a.id === agentId);
  if (!agent) return;

  const messages = [
    { content: `🔍 Starting analysis for: ${task}`, role: 'system' as const },
    { content: `I've begun researching and gathering data using web_search and analyze_data tools.`, role: 'assistant' as const },
    { content: 'Tool call: web_search(query="European SaaS market expansion 2026")', role: 'tool' as const },
    { content: 'Found 27 relevant sources. Key insights: Growing adoption of no-code tools, GDPR compliance critical, strong demand in Germany/UK/France.', role: 'assistant' as const },
    { content: 'Using code_execution tool to build financial model...', role: 'tool' as const },
    { content: `Completed task. Here are my key findings and recommendations.`, role: 'assistant' as const },
  ];

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
  }, SIMULATION_CONFIG.messageInterval * SIMULATION_CONFIG.speedMultiplier);
}
