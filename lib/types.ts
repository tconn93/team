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
  tools: string[];
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
  output?: unknown;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: unknown;
  result?: unknown;
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
  outputs?: unknown[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: unknown;
  execute: (args: unknown) => Promise<unknown>;
}

// New types for Anthropic agent events (SSE stream)
export interface StreamEvent {
  type: 'agent_thinking' | 'tool_call' | 'tool_result' | 'agent_complete' | 'agent_error' | 'mission_complete' | 'plan_created';
  agentId: string;
  agentName?: string;
  content?: string;
  tool?: string;
  input?: unknown;
  result?: unknown;
  tokens?: { input: number; output: number };
  timestamp?: string;
  plan?: ExecutionPlan;
}