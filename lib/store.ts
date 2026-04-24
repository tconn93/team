import { create } from 'zustand';
import { Run, Agent, AgentMessage, AgentFlow, Assistant, IntegrationConnection, IntegrationServiceId } from './types';
import { predefinedAgents } from './agents';
import type { ApiKeyConfig, Provider } from './llm/router';

interface TeamForgeState {
  agents: Agent[];
  runs: Run[];
  currentRun: Run | null;
  isExecuting: boolean;
  apiKeys: ApiKeyConfig;
  flows: AgentFlow[];
  assistants: Assistant[];
  connections: Record<string, IntegrationConnection>;

  addRun: (goal: string) => void;
  updateRun: (runId: string, updates: Partial<Run>) => void;
  addMessageToRun: (runId: string, message: AgentMessage) => void;
  setCurrentRun: (run: Run | null) => void;
  updateAgentStatus: (agentId: string, status: Agent['status']) => void;
  completeRun: (runId: string, outputs?: any[]) => void;
  simulatePlanning: (runId: string, goal: string) => void;
  simulateAgentExecution: (runId: string, plan: any) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (agent: Agent) => void;
  deleteAgent: (agentId: string) => void;
  setApiKey: (provider: Provider, key: string) => void;
  getApiKey: (provider: Provider) => string | undefined;
  // Flows
  addFlow: (flow: AgentFlow) => void;
  updateFlow: (flow: AgentFlow) => void;
  deleteFlow: (flowId: string) => void;
  // Assistants
  addAssistant: (assistant: Assistant) => void;
  updateAssistant: (assistant: Assistant) => void;
  deleteAssistant: (assistantId: string) => void;
  // Integrations
  connectIntegration: (serviceId: IntegrationServiceId, accountEmail: string) => void;
  disconnectIntegration: (serviceId: IntegrationServiceId) => void;
  toggleIntegrationTool: (serviceId: IntegrationServiceId, toolId: string) => void;
  getConnectedToolIds: () => string[];
}

export const useTeamForgeStore = create<TeamForgeState>((set, get) => {
  // Load custom agents from localStorage
  let initialAgents = [...predefinedAgents];
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('customAgents');
    if (saved) {
      try {
        const custom = JSON.parse(saved);
        initialAgents = [...initialAgents, ...custom];
      } catch (e) {
        console.error('Failed to load custom agents', e);
      }
    }
  }

  // Load API keys from localStorage
  let initialApiKeys: ApiKeyConfig = {};
  if (typeof window !== 'undefined') {
    const savedKeys = localStorage.getItem('teamforge_api_keys');
    if (savedKeys) {
      try {
        initialApiKeys = JSON.parse(savedKeys);
      } catch (e) {
        console.error('Failed to load API keys', e);
      }
    }
  }

  let initialFlows: AgentFlow[] = [];
  let initialAssistants: Assistant[] = [];
  let initialConnections: Record<string, IntegrationConnection> = {};
  if (typeof window !== 'undefined') {
    try { initialFlows = JSON.parse(localStorage.getItem('teamforge_flows') || '[]'); } catch {}
    try { initialAssistants = JSON.parse(localStorage.getItem('teamforge_assistants') || '[]'); } catch {}
    try { initialConnections = JSON.parse(localStorage.getItem('teamforge_connections') || '{}'); } catch {}
  }

  return {
    agents: initialAgents,
    runs: [],
    currentRun: null,
    isExecuting: false,
    apiKeys: initialApiKeys,
    flows: initialFlows,
    assistants: initialAssistants,
    connections: initialConnections,

  addRun: (goal: string) => {
    const newRun: Run = {
      id: 'run-' + Date.now(),
      goal,
      status: 'planning',
      messages: [],
      agentsUsed: [],
      cost: 0,
      duration: 0,
      createdAt: new Date(),
      outputs: [],
    };
    
    set((state) => ({
      runs: [newRun, ...state.runs],
      currentRun: newRun,
      isExecuting: true,
    }));
    
    // Simulate planning phase
    setTimeout(() => {
      const { simulatePlanning } = get();
      simulatePlanning(newRun.id, goal);
    }, 300);
  },

  updateRun: (runId: string, updates: Partial<Run>) => {
    set((state) => ({
      runs: state.runs.map((run) =>
        run.id === runId ? { ...run, ...updates } : run
      ),
      currentRun: state.currentRun?.id === runId 
        ? { ...state.currentRun, ...updates } 
        : state.currentRun,
    }));
  },

  addMessageToRun: (runId: string, message: AgentMessage) => {
    set((state) => {
      const updatedRuns = state.runs.map((run) => {
        if (run.id === runId) {
          const updatedMessages = [...run.messages, message];
          const updatedAgentsUsed = run.agentsUsed.includes(message.agentId)
            ? run.agentsUsed
            : [...run.agentsUsed, message.agentId];
          
          return {
            ...run,
            messages: updatedMessages,
            agentsUsed: updatedAgentsUsed,
          };
        }
        return run;
      });

      const updatedCurrent = state.currentRun?.id === runId 
        ? {
            ...state.currentRun,
            messages: [...state.currentRun.messages, message],
            agentsUsed: state.currentRun.agentsUsed.includes(message.agentId)
              ? state.currentRun.agentsUsed
              : [...state.currentRun.agentsUsed, message.agentId],
          }
        : state.currentRun;

      return {
        runs: updatedRuns,
        currentRun: updatedCurrent,
      };
    });
  },

  setCurrentRun: (run) => set({ currentRun: run }),

  updateAgentStatus: (agentId: string, status: Agent['status']) => {
    set((state) => ({
      agents: state.agents.map((agent) =>
        agent.id === agentId ? { ...agent, status } : agent
      ),
    }));
  },

  completeRun: (runId: string, outputs: any[] = []) => {
    const run = get().runs.find(r => r.id === runId);
    if (!run) return;

    const duration = Math.floor((Date.now() - run.createdAt.getTime()) / 1000 / 60); // in minutes approx

    set((state) => ({
      runs: state.runs.map((r) =>
        r.id === runId
          ? { 
              ...r, 
              status: 'completed' as const, 
              duration: duration || 8,
              outputs: outputs.length > 0 ? outputs : r.outputs,
              cost: Math.round(Math.random() * 18 + 8.5 * 10) / 10,
            }
          : r
      ),
      currentRun: state.currentRun?.id === runId 
        ? { 
            ...state.currentRun, 
            status: 'completed' as const, 
            duration: duration || 8,
            outputs,
            cost: Math.round(Math.random() * 18 + 8.5 * 10) / 10,
          }
        : state.currentRun,
      isExecuting: false,
    }));
  },

  // Helper for planning simulation
  simulatePlanning: (runId: string, goal: string) => {
    const { updateRun, addMessageToRun, apiKeys } = get();
    
    const coordinatorMsg: AgentMessage = {
      id: 'msg-plan-' + Date.now(),
      agentId: 'coordinator',
      role: 'assistant',
      content: `🤖 Analyzing mission with Grok-3: "${goal}"\n\nCreating structured execution plan...`,
      timestamp: new Date(),
    };
    
    addMessageToRun(runId, coordinatorMsg);

    setTimeout(async () => {
      try {
        const { runMissionServerAction } = await import('../app/actions');

        const result = await runMissionServerAction(goal, apiKeys);

        if (!result.success) {
          throw new Error(result.error || 'Mission failed');
        }

        const plan = result.plan!;

        updateRun(runId, { plan, status: 'executing' as const });

        const planMsg: AgentMessage = {
          id: 'msg-plan-ready-' + Date.now(),
          agentId: 'coordinator',
          role: 'assistant',
          content: `✅ Execution plan ready. Deploying ${plan.subtasks.length} specialized agents in parallel...`,
          timestamp: new Date(),
        };
        addMessageToRun(runId, planMsg);

        get().simulateAgentExecution(runId, plan);
      } catch (error) {
        console.error('Mission failed:', error);
        const errorMsg: AgentMessage = {
          id: 'msg-error-' + Date.now(),
          agentId: 'coordinator',
          role: 'system',
          content: `❌ Mission failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
        };
        addMessageToRun(runId, errorMsg);
        get().completeRun(runId);
      }
    }, 1000);
  },

  simulateAgentExecution: (runId: string, plan: any) => {
    const { addMessageToRun, completeRun, updateRun } = get();
    let completed = 0;
    
    plan.subtasks.forEach((task: any, index: number) => {
      setTimeout(() => {
        const agentId = task.assignedAgent;
        
        // Update status
        const statusMsg: AgentMessage = {
          id: `status-${Date.now()}`,
          agentId: 'coordinator',
          role: 'system',
          content: `🚀 Agent ${agentId} starting task: ${task.title}`,
          timestamp: new Date(),
        };
        addMessageToRun(runId, statusMsg);
        
        // Simulate the agent's work
        import('./agents').then(({ simulateAgentResponse }) => {
          simulateAgentResponse(
            agentId,
            task.title,
            (message) => addMessageToRun(runId, message),
            () => {
              completed++;
              
              // Mark task as completed in plan
              const updatedPlan = { 
                ...plan, 
                subtasks: plan.subtasks.map((t: any) => 
                  t.id === task.id ? { ...t, status: 'completed' } : t
                )
              };
              updateRun(runId, { plan: updatedPlan });
              
              if (completed === plan.subtasks.length) {
                // All agents done, synthesize final output
                setTimeout(() => {
                  const finalSynthesis: AgentMessage = {
                    id: 'final-' + Date.now(),
                    agentId: 'coordinator',
                    role: 'assistant',
                    content: `# Mission Complete\n\n**Goal:** ${plan.goal}\n\n## Executive Summary\nAll ${plan.subtasks.length} subtasks completed. The team has synthesized comprehensive deliverables.\n\n## Key Deliverables\n- Detailed research report with market insights\n- 3-year financial model with projections\n- Full strategic plan with phased rollout\n- Interactive dashboard with key metrics\n- Visual assets and supporting materials\n\n**Total Estimated 3-Year Revenue: $13.35M | Projected ROI: 4.2x**\n\nAll structured reports, financial models, and visuals are attached below.`,
                    timestamp: new Date(),
                  };
                  
                  addMessageToRun(runId, finalSynthesis);
                  
                  const mockOutputs = [
                    { type: 'chart', title: 'Revenue Projection', data: 'Interactive Recharts visualization would appear here' },
                    { type: 'image', title: 'Market TAM Visualization', url: 'https://picsum.photos/id/1015/800/500' },
                    { type: 'table', title: 'Competitive Analysis', data: 'Table with competitor data...' },
                  ];
                  
                  completeRun(runId, mockOutputs);
                }, 1200);
              }
            }
          );
        });
      }, index * 800); // Stagger the starts
    });
  },

  addAgent: (agent: Agent) => {
    set((state) => ({
      agents: [...state.agents, agent],
    }));
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      const customAgents = JSON.parse(localStorage.getItem('customAgents') || '[]');
      localStorage.setItem('customAgents', JSON.stringify([...customAgents, agent]));
    }
  },

  updateAgent: (updatedAgent: Agent) => {
    set((state) => ({
      agents: state.agents.map((a) => (a.id === updatedAgent.id ? updatedAgent : a)),
      currentRun: state.currentRun 
        ? {
            ...state.currentRun,
            messages: state.currentRun.messages.map((m) =>
              m.agentId === updatedAgent.id 
                ? { ...m, agentId: updatedAgent.id } 
                : m
            ),
          }
        : null,
    }));
    
    if (typeof window !== 'undefined') {
      const customAgents = JSON.parse(localStorage.getItem('customAgents') || '[]');
      const updated = customAgents.map((a: Agent) => 
        a.id === updatedAgent.id ? updatedAgent : a
      );
      localStorage.setItem('customAgents', JSON.stringify(updated));
    }
  },

  deleteAgent: (agentId: string) => {
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== agentId),
    }));
    
    if (typeof window !== 'undefined') {
      const customAgents = JSON.parse(localStorage.getItem('customAgents') || '[]');
      localStorage.setItem(
        'customAgents', 
        JSON.stringify(customAgents.filter((a: Agent) => a.id !== agentId))
      );
    }
  },

  setApiKey: (provider: Provider, key: string) => {
    set((state) => {
      const newKeys = { ...state.apiKeys, [provider]: key };
      if (typeof window !== 'undefined') {
        localStorage.setItem('teamforge_api_keys', JSON.stringify(newKeys));
      }
      return { apiKeys: newKeys };
    });
  },

  getApiKey: (provider: Provider) => {
    const state = get();
    if (state.apiKeys[provider]) return state.apiKeys[provider];
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('teamforge_api_keys');
      if (saved) {
        try { return JSON.parse(saved)[provider]; } catch {}
      }
    }
    return undefined;
  },

  // ─── Flows ─────────────────────────────────────────────────────────────────
  addFlow: (flow) => {
    set((state) => {
      const flows = [...state.flows, flow];
      if (typeof window !== 'undefined') localStorage.setItem('teamforge_flows', JSON.stringify(flows));
      return { flows };
    });
  },
  updateFlow: (flow) => {
    set((state) => {
      const flows = state.flows.map((f) => (f.id === flow.id ? flow : f));
      if (typeof window !== 'undefined') localStorage.setItem('teamforge_flows', JSON.stringify(flows));
      return { flows };
    });
  },
  deleteFlow: (flowId) => {
    set((state) => {
      const flows = state.flows.filter((f) => f.id !== flowId);
      if (typeof window !== 'undefined') localStorage.setItem('teamforge_flows', JSON.stringify(flows));
      return { flows };
    });
  },

  // ─── Assistants ────────────────────────────────────────────────────────────
  addAssistant: (assistant) => {
    set((state) => {
      const assistants = [...state.assistants, assistant];
      if (typeof window !== 'undefined') localStorage.setItem('teamforge_assistants', JSON.stringify(assistants));
      return { assistants };
    });
  },
  updateAssistant: (assistant) => {
    set((state) => {
      const assistants = state.assistants.map((a) => (a.id === assistant.id ? assistant : a));
      if (typeof window !== 'undefined') localStorage.setItem('teamforge_assistants', JSON.stringify(assistants));
      return { assistants };
    });
  },
  deleteAssistant: (assistantId) => {
    set((state) => {
      const assistants = state.assistants.filter((a) => a.id !== assistantId);
      if (typeof window !== 'undefined') localStorage.setItem('teamforge_assistants', JSON.stringify(assistants));
      return { assistants };
    });
  },

  // ─── Integrations ──────────────────────────────────────────────────────────
  connectIntegration: (serviceId, accountEmail) => {
    set((state) => {
      const connections = {
        ...state.connections,
        [serviceId]: { serviceId, connected: true, connectedAt: new Date().toISOString(), accountEmail, enabledToolIds: [] },
      };
      if (typeof window !== 'undefined') localStorage.setItem('teamforge_connections', JSON.stringify(connections));
      return { connections };
    });
  },
  disconnectIntegration: (serviceId) => {
    set((state) => {
      const connections = { ...state.connections };
      delete connections[serviceId];
      if (typeof window !== 'undefined') localStorage.setItem('teamforge_connections', JSON.stringify(connections));
      return { connections };
    });
  },
  toggleIntegrationTool: (serviceId, toolId) => {
    set((state) => {
      const conn = state.connections[serviceId];
      if (!conn) return state;
      const enabled = conn.enabledToolIds.includes(toolId)
        ? conn.enabledToolIds.filter((id) => id !== toolId)
        : [...conn.enabledToolIds, toolId];
      const connections = { ...state.connections, [serviceId]: { ...conn, enabledToolIds: enabled } };
      if (typeof window !== 'undefined') localStorage.setItem('teamforge_connections', JSON.stringify(connections));
      return { connections };
    });
  },
  getConnectedToolIds: () => {
    return Object.values(get().connections).flatMap((c) => (c.connected ? c.enabledToolIds : []));
  },
  };
});
