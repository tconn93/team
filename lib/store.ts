import { create } from 'zustand';
import { Run, Agent, AgentMessage } from './types';
import { predefinedAgents } from './agents';

interface TeamForgeState {
  agents: Agent[];
  runs: Run[];
  currentRun: Run | null;
  isExecuting: boolean;
  
  addRun: (goal: string) => void;
  updateRun: (runId: string, updates: Partial<Run>) => void;
  addMessageToRun: (runId: string, message: AgentMessage) => void;
  setCurrentRun: (run: Run | null) => void;
  updateAgentStatus: (agentId: string, status: Agent['status']) => void;
  completeRun: (runId: string, outputs?: any[]) => void;
  simulatePlanning: (runId: string, goal: string) => void;
  simulateAgentExecution: (runId: string, plan: any) => void;
}

export const useTeamForgeStore = create<TeamForgeState>((set, get) => ({
  agents: [...predefinedAgents],
  runs: [],
  currentRun: null,
  isExecuting: false,

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
    const { updateRun, addMessageToRun } = get();
    
    // Coordinator thinking
    const coordinatorMsg: AgentMessage = {
      id: 'msg-plan-' + Date.now(),
      agentId: 'coordinator',
      role: 'assistant',
      content: `Analyzing mission: "${goal}"\n\nCreating structured execution plan with parallel agent deployment...`,
      timestamp: new Date(),
    };
    
    addMessageToRun(runId, coordinatorMsg);
    
    setTimeout(async () => {
      // Import dynamically to avoid circular deps in this mock
      const { generateExecutionPlan } = await import('./agents');
      const plan = await generateExecutionPlan(goal);
      
      updateRun(runId, { 
        plan, 
        status: 'executing' 
      });
      
      const planMsg: AgentMessage = {
        id: 'msg-plan-complete-' + Date.now(),
        agentId: 'coordinator',
        role: 'assistant',
        content: `✅ Plan generated with ${plan.subtasks.length} subtasks.\nDeploying specialized agents in parallel where possible.`,
        timestamp: new Date(),
      };
      addMessageToRun(runId, planMsg);
      
      // Start executing subtasks with simulated delays
      get().simulateAgentExecution(runId, plan);
    }, 1800);
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
                    content: `# Mission Complete: Go-to-Market Plan for Europe\n\n## Executive Summary\nComprehensive 3-year plan developed with strong projected ROI.\n\n## Key Deliverables\n- Detailed market research report\n- 3-year financial model with projections\n- Full GTM strategy with phased rollout\n- Interactive dashboard with key metrics\n- Visual assets and pitch deck templates\n\n**Total Estimated 3-Year Revenue: $13.35M**\n**Projected ROI: 4.2x**\n\nThe full structured report, financial models, and visuals have been generated and attached below.`,
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
}));
