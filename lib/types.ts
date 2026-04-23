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
