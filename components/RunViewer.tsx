'use client';

import { Run, AgentMessage } from '@/lib/types';
import { useTeamForgeStore } from '@/lib/store';
import { Bot, User, Wrench, Clock, DollarSign } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { format } from 'date-fns';

interface RunViewerProps {
  run: Run;
}

const MessageBubble = ({ message, agents }: { message: AgentMessage; agents: any[] }) => {
  const agent = agents.find(a => a.id === message.agentId);
  
  const getIcon = () => {
    if (message.role === 'tool') return <Wrench className="w-4 h-4 text-amber-400" />;
    if (message.role === 'system') return <Bot className="w-4 h-4 text-purple-400" />;
    return agent ? (
      <div 
        className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{ backgroundColor: agent.color }}
      >
        {agent.name[0]}
      </div>
    ) : <Bot className="w-6 h-6 text-zinc-400" />;
  };

  return (
    <div className={`flex gap-4 ${message.role === 'system' ? 'opacity-75' : ''}`}>
      <div className="flex-shrink-0 mt-1">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm text-white">
            {agent ? agent.name : message.agentId === 'coordinator' ? 'Coordinator' : 'System'}
          </span>
          <span className="text-[10px] text-zinc-500">
            {format(message.timestamp, 'HH:mm:ss')}
          </span>
          {message.role === 'tool' && (
            <span className="px-2 py-px text-[10px] bg-amber-500/10 text-amber-400 rounded">TOOL</span>
          )}
        </div>
        
        <div className={`prose prose-invert text-sm max-w-none ${
          message.role === 'tool' 
            ? 'font-mono text-amber-300 bg-zinc-950 border border-amber-900/50 p-3 rounded-xl' 
            : 'text-zinc-300'
        }`}>
          {message.content.split('\n').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
        
        {message.output != null && (
          <div className="mt-3 text-xs bg-zinc-900 border border-zinc-700 p-3 rounded-xl font-mono overflow-auto max-h-48">
            {typeof message.output === 'string' ? message.output : JSON.stringify(message.output, null, 2)}
          </div>
        )}
      </div>
    </div>
  );
};

export function RunViewer({ run }: RunViewerProps) {
  const { agents, currentRun } = useTeamForgeStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [run.messages]);

  const outputs = run.outputs || [];
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-zinc-800 p-6 flex items-center justify-between bg-zinc-950">
        <div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-full flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              LIVE MISSION
            </div>
            <h2 className="text-xl font-semibold text-white line-clamp-1">{run.goal}</h2>
          </div>
          <div className="text-zinc-500 text-sm mt-1 flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {run.duration || '—'} min
            </div>
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4" />
              ${run.cost?.toFixed(2) || '—.--'}
            </div>
            <div className="text-emerald-400">
              {run.agentsUsed.length} agents deployed
            </div>
          </div>
        </div>
        
        <div className={`px-5 py-2 rounded-2xl text-sm font-medium flex items-center gap-2 ${
          run.status === 'completed' 
            ? 'bg-emerald-500/10 text-emerald-400' 
            : run.status === 'executing' 
            ? 'bg-amber-500/10 text-amber-400' 
            : 'bg-zinc-700 text-zinc-400'
        }`}>
          {run.status === 'completed' ? '✓ COMPLETED' : run.status.toUpperCase()}
        </div>
      </div>

      {/* Messages / Trace */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-8 space-y-10 bg-[radial-gradient(#27272a_0.8px,transparent_1px)] bg-[length:20px_20px]"
      >
        {run.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20 text-zinc-500">
            <Bot className="w-16 h-16 mb-6 opacity-40" />
            <p className="text-lg">Coordinator is planning your mission...</p>
            <p className="text-sm mt-2 max-w-xs">The team will be deployed momentarily with real-time streaming updates.</p>
          </div>
        ) : (
          run.messages.map((message, index) => (
            <MessageBubble 
              key={message.id || index} 
              message={message} 
              agents={agents} 
            />
          ))
        )}
      </div>

      {/* Rich Outputs Section */}
      {outputs.length > 0 && (
        <div className="border-t border-zinc-800 bg-zinc-900 p-6">
          <div className="uppercase text-xs tracking-[1px] text-zinc-500 mb-4">GENERATED DELIVERABLES</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {outputs.map((output, index) => {
              const out = output as { type?: string; title?: string; url?: string };
              return (
              <div key={index} className="glass border border-zinc-700 rounded-2xl p-5">
                <div className="text-sm text-white font-medium mb-3 flex items-center gap-2">
                  {out.type === 'chart' && '📈'}
                  {out.type === 'image' && '🖼️'}
                  {out.type === 'table' && '📋'}
                  {out.type === 'report' && '📄'}
                  {out.title || 'Deliverable'}
                </div>

                {out.type === 'image' && out.url && (
                  <img
                    src={out.url}
                    alt={out.title || 'Generated image'}
                    className="w-full rounded-xl border border-zinc-700"
                  />
                )}

                {out.type === 'chart' && (
                  <div className="h-64 bg-zinc-950 rounded-xl flex items-center justify-center border border-dashed border-zinc-700 text-xs text-zinc-500">
                    Interactive Recharts Line/Bar Chart would render here<br/>with real financial projections
                  </div>
                )}

                {out.type === 'table' && (
                  <div className="text-xs font-mono text-emerald-300/70 bg-black/60 p-4 rounded-xl border border-emerald-900/30">
                    Competitor | Market Share | Strengths<br/>
                    Notion ••••••• 38% • Strong templates<br/>
                    Coda ••••• 22% • Docs + automation<br/>
                    ...
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
