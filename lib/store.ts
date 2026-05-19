import { create } from 'zustand';
import { Run, Agent, AgentMessage, StreamEvent } from './types';
import { predefinedAgents } from './agents';
import type { ApiKeyConfig, Provider } from './llm/router';

interface TeamForgeState {
  agents: Agent[];
  runs: Run[];
  currentRun: Run | null;
  isExecuting: boolean;
  apiKeys: ApiKeyConfig;

  addRun: (goal: string) => void;
  updateRun: (runId: string, updates: Partial<Run>) => void;
  addMessageToRun: (runId: string, message: AgentMessage) => void;
  setCurrentRun: (run: Run | null) => void;
  updateAgentStatus: (agentId: string, status: Agent['status']) => void;
  completeRun: (runId: string, outputs?: unknown[]) => void;
  startMission: (goal: string) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (agent: Agent) => void;
  deleteAgent: (agentId: string) => void;
  setApiKey: (provider: Provider, key: string) => void;
  getApiKey: (provider: Provider) => string | undefined;
}

export const useTeamForgeStore = create<TeamForgeState>((set, get) => {
  // Load agents: start with predefined, then apply persisted edits, then add custom agents
  let initialAgents = [...predefinedAgents];
  if (typeof window !== 'undefined') {
    // Apply persisted edits to predefined agents
    const editsRaw = localStorage.getItem('agentEdits');
    if (editsRaw) {
      try {
        const edits = JSON.parse(editsRaw) as Record<string, Partial<Agent>>;
        initialAgents = initialAgents.map(a => edits[a.id] ? { ...a, ...edits[a.id] } : a);
      } catch (e) {
        console.error('Failed to load agent edits', e);
      }
    }
    // Load custom agents
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

  return {
    agents: initialAgents,
    runs: [],
    currentRun: null,
    isExecuting: false,
    apiKeys: initialApiKeys,

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

      // Start the real mission via SSE
      setTimeout(() => {
        get().startMission(goal);
      }, 100);
    },

    startMission: (goal: string) => {
      const { currentRun, apiKeys, addMessageToRun, updateRun, completeRun, updateAgentStatus } = get();
      if (!currentRun) return;

      const runId = currentRun.id;

      // Check for Anthropic API key
      const anthropicKey = apiKeys.anthropic;
      if (!anthropicKey) {
        addMessageToRun(runId, {
          id: 'msg-error-' + Date.now(),
          agentId: 'coordinator',
          role: 'system',
          content: 'Anthropic API key is required. Please configure it in Settings (click the gear icon).',
          timestamp: new Date(),
        });
        completeRun(runId);
        return;
      }

      // Set all agents to active
      get().agents.forEach((agent) => {
        updateAgentStatus(agent.id, 'active');
      });

      // Connect to the SSE endpoint
      const fetchStream = async () => {
        try {
          const response = await fetch('/api/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goal, apiKeys }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || `Server error: ${response.status}`);
          }

          if (!response.body) {
            throw new Error('No response body');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Parse SSE events from buffer
            const lines = buffer.split('\n');
            buffer = '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const event: StreamEvent = JSON.parse(line.slice(6));
                  processEvent(event);
                } catch {
                  // Incomplete JSON, keep in buffer
                  buffer = line + '\n';
                }
              }
            }
          }
        } catch (error) {
          addMessageToRun(runId, {
            id: 'msg-error-' + Date.now(),
            agentId: 'coordinator',
            role: 'system',
            content: `Mission failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
          });
          completeRun(runId);
        }
      };

      const processEvent = (event: StreamEvent) => {
        const agent = get().agents.find((a) => a.id === event.agentId);

        switch (event.type) {
          case 'agent_thinking': {
            addMessageToRun(runId, {
              id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              agentId: event.agentId,
              role: 'system',
              content: event.content || 'Thinking...',
              timestamp: new Date(),
            });
            break;
          }

          case 'tool_call': {
            addMessageToRun(runId, {
              id: `msg-tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              agentId: event.agentId,
              role: 'tool',
              content: `Using ${event.tool}: ${JSON.stringify(event.input, null, 2)}`,
              timestamp: new Date(),
              toolCalls: [
                {
                  id: `tc-${Date.now()}`,
                  name: event.tool || 'unknown',
                  arguments: event.input,
                },
              ],
            });
            break;
          }

          case 'tool_result': {
            addMessageToRun(runId, {
              id: `msg-result-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              agentId: event.agentId,
              role: 'assistant',
              content: `Result from ${event.tool}: ${typeof event.result === 'string' ? event.result : JSON.stringify(event.result, null, 2).substring(0, 500)}`,
              timestamp: new Date(),
              output: event.result,
            });
            break;
          }

          case 'agent_complete': {
            const isCoordinator = event.agentId === 'coordinator';
            addMessageToRun(runId, {
              id: `msg-complete-${Date.now()}-${event.agentId}`,
              agentId: event.agentId,
              role: isCoordinator ? 'assistant' : 'assistant',
              content: event.content || 'Task completed.',
              timestamp: new Date(),
            });
            // Set agent back to idle
            updateAgentStatus(event.agentId, 'idle');
            break;
          }

          case 'agent_error': {
            addMessageToRun(runId, {
              id: `msg-error-${Date.now()}-${event.agentId}`,
              agentId: event.agentId,
              role: 'system',
              content: `Error: ${event.content}`,
              timestamp: new Date(),
            });
            updateAgentStatus(event.agentId, 'idle');
            break;
          }

          case 'plan_created': {
            if (event.plan) {
              updateRun(runId, {
                plan: event.plan as any,
                status: 'executing' as const,
              });
            }
            break;
          }

          case 'mission_complete': {
            let deliverables: unknown[] = [];
            let totalTokens = { input: 0, output: 0 };
            try {
              const data = JSON.parse(event.content || '{}');
              deliverables = data.deliverables || [];
              totalTokens = data.totalTokens || { input: 0, output: 0 };
            } catch {
              // fallback
            }

            // Calculate approximate cost (Claude Sonnet: ~$3/M input, ~$15/M output)
            const cost =
              (totalTokens.input * 3) / 1_000_000 +
              (totalTokens.output * 15) / 1_000_000;

            updateRun(runId, {
              status: 'completed' as const,
              cost: Math.round(cost * 100) / 100,
              outputs: deliverables,
            });
            set({ isExecuting: false });
            // Reset agents to idle
            get().agents.forEach((a) => {
              updateAgentStatus(a.id, 'active');
            });
            break;
          }
        }
      };

      fetchStream();
    },

    updateRun: (runId: string, updates: Partial<Run>) => {
      set((state) => ({
        runs: state.runs.map((run) =>
          run.id === runId ? { ...run, ...updates } : run
        ),
        currentRun:
          state.currentRun?.id === runId
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

        const updatedCurrent =
          state.currentRun?.id === runId
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

    completeRun: (runId: string, outputs: unknown[] = []) => {
      const run = get().runs.find((r) => r.id === runId);
      if (!run) return;

      const duration = Math.floor(
        (Date.now() - run.createdAt.getTime()) / 1000 / 60
      );

      const completedRun = {
        ...run,
        status: 'completed' as const,
        duration: duration || 1,
        outputs: outputs.length > 0 ? outputs : run.outputs,
      };

      set((state) => ({
        runs: state.runs.map((r) =>
          r.id === runId ? completedRun : r
        ),
        currentRun:
          state.currentRun?.id === runId ? completedRun : state.currentRun,
        isExecuting: false,
      }));

      // Persist completed run to database (fire-and-forget)
      fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...completedRun,
          createdAt: completedRun.createdAt.toISOString(),
          messages: completedRun.messages.map((m) => ({
            ...m,
            timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
          })),
        }),
      }).catch(() => {
        // DB persistence failed silently — data still in local state
      });
    },

    addAgent: (agent: Agent) => {
      set((state) => ({
        agents: [...state.agents, agent],
      }));
      if (typeof window !== 'undefined') {
        const customAgents = JSON.parse(
          localStorage.getItem('customAgents') || '[]'
        );
        localStorage.setItem(
          'customAgents',
          JSON.stringify([...customAgents, agent])
        );
      }
    },

    updateAgent: (updatedAgent: Agent) => {
      set((state) => ({
        agents: state.agents.map((a) =>
          a.id === updatedAgent.id ? updatedAgent : a
        ),
      }));
      if (typeof window !== 'undefined') {
        const isPredefined = predefinedAgents.some(a => a.id === updatedAgent.id);
        if (isPredefined) {
          // Persist edits to predefined agents separately
          const edits = JSON.parse(localStorage.getItem('agentEdits') || '{}');
          edits[updatedAgent.id] = {
            systemPrompt: updatedAgent.systemPrompt,
            model: updatedAgent.model,
            provider: updatedAgent.provider,
            tools: updatedAgent.tools,
            guardrails: updatedAgent.guardrails,
            description: updatedAgent.description,
            role: updatedAgent.role,
            skills: updatedAgent.skills,
          };
          localStorage.setItem('agentEdits', JSON.stringify(edits));
        }
        const customAgents = JSON.parse(
          localStorage.getItem('customAgents') || '[]'
        );
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
        const customAgents = JSON.parse(
          localStorage.getItem('customAgents') || '[]'
        );
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
          try {
            const keys = JSON.parse(saved);
            return keys[provider];
          } catch (e) {
            /* ignore */
          }
        }
      }
      return undefined;
    },
  };
});