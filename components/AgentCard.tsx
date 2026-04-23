'use client';

import { Agent } from '@/lib/types';
import { Users, Brain, Zap } from 'lucide-react';

interface AgentCardProps {
  agent: Agent;
  onClick?: () => void;
}

export function AgentCard({ agent, onClick }: AgentCardProps) {
  return (
    <div 
      onClick={onClick}
      className="glass border border-zinc-700 rounded-2xl p-5 hover:border-blue-500/50 cursor-pointer transition-all group"
    >
      <div className="flex items-start justify-between mb-4">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xl font-bold"
          style={{ backgroundColor: agent.color + '99' }}
        >
          {agent.name[0]}
        </div>
        <div className={`px-3 py-1 text-xs rounded-full font-medium flex items-center gap-1.5 ${
          agent.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-700 text-zinc-400'
        }`}>
          <div className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
          {agent.status}
        </div>
      </div>
      
      <h3 className="font-semibold text-lg text-white mb-1">{agent.name}</h3>
      <p className="text-blue-400 text-sm mb-3">{agent.role}</p>
      
      <p className="text-zinc-400 text-sm line-clamp-3 mb-4">
        {agent.description}
      </p>
      
      <div className="flex flex-wrap gap-2">
        {agent.skills.slice(0, 3).map((skill, i) => (
          <span 
            key={i}
            className="text-[10px] px-2.5 py-0.5 bg-zinc-800 text-zinc-400 rounded-md"
          >
            {skill}
          </span>
        ))}
      </div>
      
      <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
        <div className="flex items-center gap-1">
          <Brain className="w-3.5 h-3.5" />
          <span>{agent.model.split('-')[0]}</span>
        </div>
        <div className="flex items-center gap-1">
          <Zap className="w-3.5 h-3.5" />
          <span>{agent.memorySize}k ctx</span>
        </div>
      </div>
    </div>
  );
}
