'use client';

import { useState, useEffect } from 'react';
import { useTeamForgeStore } from '@/lib/store';
import { AgentCard } from '@/components/AgentCard';
import { RunViewer } from '@/components/RunViewer';
import { Bot, Play, Plus, History, Settings, BarChart3, Users } from 'lucide-react';
import { predefinedAgents } from '@/lib/agents';

export default function TeamForge() {
  const { 
    agents, 
    runs, 
    currentRun, 
    addRun, 
    setCurrentRun,
    isExecuting 
  } = useTeamForgeStore();
  
  const [goalInput, setGoalInput] = useState('');
  const [activeTab, setActiveTab] = useState<'missions' | 'fleet' | 'history'>('missions');
  const [showNewMission, setShowNewMission] = useState(false);

  const handleLaunchMission = () => {
    if (!goalInput.trim()) return;
    
    addRun(goalInput.trim());
    setGoalInput('');
    setShowNewMission(false);
    setActiveTab('missions');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleLaunchMission();
    }
  };

  const exampleGoals = [
    "Research expanding our SaaS product into Europe and create a full go-to-market plan with financial projections",
    "Analyze our last 6 months of customer churn and develop a comprehensive retention strategy with predictive models",
    "Create a pitch deck and financial model for raising a $15M Series A round targeting climate tech investors",
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      {/* Sidebar */}
      <div className="w-72 border-r border-zinc-800 bg-zinc-950 flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 via-violet-500 to-fuchsia-500 rounded-2xl flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-semibold text-2xl tracking-tighter text-white">TEAMFORGE</div>
              <div className="text-[10px] text-zinc-500 -mt-1">HYPERAGENT OS</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="px-3 pt-6">
          <div 
            onClick={() => setActiveTab('missions')}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer mb-1 transition-colors ${activeTab === 'missions' ? 'bg-white/5 text-white' : 'hover:bg-white/5 text-zinc-400'}`}
          >
            <Play className="w-5 h-5" />
            <span className="font-medium">New Mission</span>
          </div>
          <div 
            onClick={() => setActiveTab('fleet')}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer mb-1 transition-colors ${activeTab === 'fleet' ? 'bg-white/5 text-white' : 'hover:bg-white/5 text-zinc-400'}`}
          >
            <Users className="w-5 h-5" />
            <span className="font-medium">Agent Fleet</span>
            <div className="ml-auto text-[10px] px-2 py-px bg-zinc-800 rounded-full text-zinc-400">{agents.length}</div>
          </div>
          <div 
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-colors ${activeTab === 'history' ? 'bg-white/5 text-white' : 'hover:bg-white/5 text-zinc-400'}`}
          >
            <History className="w-5 h-5" />
            <span className="font-medium">Run History</span>
            <div className="ml-auto text-[10px] px-2 py-px bg-emerald-500/10 text-emerald-400 rounded-full">{runs.length}</div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-auto p-6 border-t border-zinc-800">
          <div className="glass rounded-3xl p-5 text-xs">
            <div className="flex justify-between text-zinc-400 mb-4">
              <div>TOTAL SPEND</div>
              <div className="text-emerald-400">$248.92</div>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-5">
              <div className="h-2 w-[65%] bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full"></div>
            </div>
            
            <div className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span>4 agents online</span>
              </div>
              <div>12.4k tokens used today</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="h-14 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl flex items-center px-8 justify-between z-10">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 text-sm">
              <div className="px-4 py-1.5 bg-white/5 rounded-3xl text-white flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-violet-400"></div>
                Production Fleet
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6 text-sm">
            <button 
              onClick={() => setShowNewMission(true)}
              className="flex items-center gap-2 bg-white text-black px-6 py-2 rounded-2xl font-semibold hover:bg-white/90 transition-all active:scale-[0.985]"
            >
              <Plus className="w-4 h-4" />
              LAUNCH NEW MISSION
            </button>
            
            <div className="flex items-center gap-2 text-zinc-400 hover:text-white cursor-pointer">
              <Settings className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Fleet / History Sidebar when selected */}
          {(activeTab === 'fleet' || activeTab === 'history') && (
            <div className="w-96 border-r border-zinc-800 bg-zinc-900 overflow-auto">
              {activeTab === 'fleet' && (
                <div className="p-6">
                  <div className="uppercase text-xs tracking-widest text-zinc-500 mb-6">SPECIALIZED AGENTS</div>
                  
                  <div className="space-y-4">
                    {agents.map((agent) => (
                      <AgentCard 
                        key={agent.id} 
                        agent={agent} 
                        onClick={() => {
                          // Could open agent config modal in full version
                          alert(`Opening config for ${agent.name} (demo)`);
                        }}
                      />
                    ))}
                  </div>
                  
                  <button 
                    onClick={() => alert('In a full implementation this would open the Agent Definition UI with form for system prompt, tools, model selection, guardrails, etc.')}
                    className="mt-8 w-full py-4 border border-dashed border-zinc-700 hover:border-white/60 rounded-3xl text-sm flex items-center justify-center gap-2 text-zinc-400 hover:text-white transition-colors"
                  >
                    <Plus className="w-4 h-4" /> CREATE NEW AGENT
                  </button>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="p-6">
                  <div className="uppercase text-xs tracking-widest text-zinc-500 mb-6">PREVIOUS MISSIONS</div>
                  <div className="space-y-3">
                    {runs.length > 0 ? (
                      runs.map((run) => (
                        <div 
                          key={run.id}
                          onClick={() => setCurrentRun(run)}
                          className={`p-5 rounded-3xl cursor-pointer border transition-all hover:border-zinc-600 ${currentRun?.id === run.id ? 'border-blue-500 bg-blue-950/30' : 'border-transparent bg-zinc-950'}`}
                        >
                          <div className="text-sm font-medium line-clamp-2 mb-2 pr-8">{run.goal}</div>
                          <div className="flex justify-between items-center text-xs">
                            <div className="text-zinc-500">
                              {run.createdAt.toLocaleDateString()}
                            </div>
                            <div className={`px-3 py-0.5 rounded-full ${run.status === 'completed' ? 'bg-emerald-900 text-emerald-400' : 'bg-amber-900 text-amber-400'}`}>
                              {run.status}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center text-zinc-500">
                        No missions yet.<br/>Launch your first one above.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Main Mission Interface */}
          <div className="flex-1 flex flex-col min-w-0">
            {!currentRun && !showNewMission ? (
              /* Welcome / New Mission Prompt */
              <div className="flex-1 flex items-center justify-center p-12">
                <div className="max-w-2xl w-full">
                  <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-3 mb-6 px-5 py-2 bg-white/5 rounded-3xl">
                      <div className="text-6xl">🦸</div>
                      <div>
                        <div className="text-4xl font-semibold tracking-tighter">Your AI Team is Ready</div>
                        <div className="text-zinc-400 mt-2">Describe any complex goal. Watch the magic happen.</div>
                      </div>
                    </div>
                  </div>

                  <div className="glass border border-white/10 rounded-3xl p-2">
                    <textarea
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Research expanding our SaaS product into Europe and create a full go-to-market plan with financial projections..."
                      className="w-full h-36 bg-transparent px-7 py-6 text-lg placeholder:text-zinc-500 focus:outline-none resize-none"
                    />
                    
                    <div className="border-t border-white/10 px-7 py-5 flex items-center justify-between">
                      <button
                        onClick={() => setShowNewMission(true)}
                        className="text-xs flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
                      >
                        <BarChart3 className="w-4 h-4" /> SEE EXAMPLE MISSIONS
                      </button>
                      
                      <button 
                        onClick={handleLaunchMission}
                        disabled={!goalInput.trim() || isExecuting}
                        className="bg-white hover:bg-zinc-100 active:bg-white disabled:bg-zinc-700 disabled:text-zinc-400 transition-all text-black font-semibold px-10 py-3.5 rounded-2xl flex items-center gap-3 disabled:cursor-not-allowed"
                      >
                        DEPLOY TEAM
                        <Play className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Example prompts */}
                  <div className="mt-8">
                    <div className="text-xs uppercase tracking-widest text-zinc-500 mb-4 px-1">TRY THESE MISSIONS</div>
                    <div className="grid grid-cols-1 gap-3">
                      {exampleGoals.map((example, index) => (
                        <div 
                          key={index}
                          onClick={() => {
                            setGoalInput(example);
                            setTimeout(() => handleLaunchMission(), 80);
                          }}
                          className="glass border border-zinc-700 hover:border-zinc-400 p-5 rounded-2xl cursor-pointer text-sm text-zinc-300 transition-all"
                        >
                          {example}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : currentRun ? (
              <RunViewer run={currentRun} />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-6">🚀</div>
                  <div className="text-3xl font-medium mb-3">Launching new mission...</div>
                  <div className="text-zinc-400">The Coordinator is building your execution plan.</div>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar - Live Status */}
          <div className="w-80 border-l border-zinc-800 bg-zinc-900 p-6 hidden lg:flex flex-col">
            <div className="uppercase text-xs tracking-[0.5px] text-zinc-500 mb-5">LIVE FLEET STATUS</div>
            
            <div className="space-y-6">
              {agents.map((agent) => (
                <div key={agent.id} className="flex gap-4">
                  <div 
                    className="w-9 h-9 rounded-2xl flex-shrink-0 flex items-center justify-center text-white text-sm font-bold"
                    style={{ background: agent.color }}
                  >
                    {agent.name.substring(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <div className="font-medium text-sm text-white truncate">{agent.name}</div>
                      <div className={`text-[10px] px-3 py-px rounded-full ${agent.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : ''}`}>
                        {agent.status}
                      </div>
                    </div>
                    <div className="text-xs text-zinc-500 line-clamp-1">{agent.role}</div>
                    <div className="mt-2.5 h-1 bg-zinc-800 rounded">
                      <div 
                        className="h-1 bg-white rounded transition-all" 
                        style={{ width: agent.status === 'active' ? '85%' : '35%' }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-8">
              <div className="text-xs text-zinc-400 leading-relaxed border-l-2 border-zinc-700 pl-4">
                This is a fully functional simulation of a production multi-agent orchestration system.<br/><br/>
                
                The Coordinator dynamically creates structured plans, deploys parallel agents with real tool calling simulation, streams thoughts, and produces rich deliverables (charts, images, reports).<br/><br/>
                
                Built as a demonstration of what a production TeamForge / Hyperagent product could look like using Next.js, TypeScript, Zustand, and Vercel AI SDK patterns.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Mission Modal Overlay */}
      {showNewMission && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center">
          <div className="max-w-2xl w-full mx-4 glass border border-white/10 rounded-3xl overflow-hidden">
            <div className="p-10">
              <div className="text-4xl font-semibold mb-2">What should your team accomplish?</div>
              <div className="text-zinc-400">Be as specific as possible. The Coordinator will break it down into parallel subtasks.</div>
              
              <textarea
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="mt-10 w-full h-40 bg-zinc-900 border border-zinc-700 focus:border-blue-500 rounded-3xl p-8 text-lg placeholder:text-zinc-500 resize-y"
                placeholder="Perform a complete competitive teardown of our top 5 competitors and propose a differentiated product strategy that captures 18% more market share..."
              />
            </div>
            
            <div className="bg-zinc-950 border-t border-zinc-800 p-5 flex justify-end gap-4">
              <button 
                onClick={() => { setShowNewMission(false); setGoalInput(''); }}
                className="px-8 py-3.5 text-sm"
              >
                CANCEL
              </button>
              <button 
                onClick={handleLaunchMission}
                disabled={!goalInput.trim()}
                className="bg-white text-black px-10 py-3.5 rounded-2xl font-semibold flex items-center gap-3 disabled:opacity-40"
              >
                DEPLOY THE TEAM
                <Play className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
