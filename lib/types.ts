export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  model: string;
  provider?: 'openai' | 'anthropic' | 'xai' | 'google' | 'custom';
  color: string;
  skills: string[];
  tools: string[]; // references to tool names
  status: 'idle' | 'active' | 'offline';
  memorySize: number;
  guardrails?: {
    maxTokens?: number;
    maxCost?: number;
    requireApproval?: boolean;
  };
  isCustom?: boolean;
}

export interface Subtask {
  id: string;
  title: string;
  description: string;
  assignedAgent: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies?: string[];
  estimatedTime: number;
}

export interface ExecutionPlan {
  id: string;
  goal: string;
  subtasks: Subtask[];
  estimatedCost: number;
  createdAt: Date;
}

export interface AgentMessage {
  id: string;
  agentId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  output?: any;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
  result?: any;
}

export interface Run {
  id: string;
  goal: string;
  status: 'planning' | 'executing' | 'completed' | 'failed';
  plan?: ExecutionPlan;
  messages: AgentMessage[];
  agentsUsed: string[];
  cost: number;
  duration: number;
  createdAt: Date;
  outputs?: any[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: any; // Zod schema in practice
  execute: (args: any) => Promise<any>;
}

// ─── Agent Flows ────────────────────────────────────────────────────────────

export type FlowNodeType = 'trigger' | 'agent' | 'tool' | 'condition' | 'output' | 'transform';

export interface FlowNodeData {
  label: string;
  config: Record<string, any>;
  agentId?: string;
  integrationId?: string;
  toolId?: string;
  condition?: string;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  position: { x: number; y: number };
  data: FlowNodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  animated?: boolean;
}

export interface AgentFlow {
  id: string;
  name: string;
  description: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  status: 'draft' | 'active';
  createdAt: Date;
  updatedAt: Date;
}

// ─── Custom Assistants ───────────────────────────────────────────────────────

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface Assistant {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  provider: 'openai' | 'anthropic' | 'xai' | 'google';
  tools: string[];
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Integrations ────────────────────────────────────────────────────────────

export type IntegrationProvider = 'google' | 'microsoft';

export type GoogleService = 'gmail' | 'google_drive' | 'google_calendar' | 'google_sheets' | 'google_docs';
export type MicrosoftService = 'outlook' | 'teams' | 'onedrive' | 'sharepoint' | 'excel';
export type IntegrationServiceId = GoogleService | MicrosoftService;

export interface IntegrationToolParam {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required?: boolean;
}

export interface IntegrationTool {
  id: string;
  name: string;
  description: string;
  icon: string;
  serviceId: IntegrationServiceId;
  parameters: IntegrationToolParam[];
  execute: (args: Record<string, any>) => Promise<any>;
}

export interface IntegrationServiceDef {
  id: IntegrationServiceId;
  name: string;
  provider: IntegrationProvider;
  icon: string;
  color: string;
  description: string;
  category: string;
  scopes: string[];
  tools: IntegrationTool[];
}

export interface IntegrationConnection {
  serviceId: IntegrationServiceId;
  connected: boolean;
  connectedAt?: string;
  accountEmail?: string;
  enabledToolIds: string[];
}
