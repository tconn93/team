'use client';

import { Run, AgentMessage } from '@/lib/types';
import { useTeamForgeStore } from '@/lib/store';
import { Bot, Wrench, Clock, DollarSign } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const REVENUE_DATA = [
  { month: 'Jan', revenue: 120, cost: 45 },
  { month: 'Feb', revenue: 185, cost: 52 },
  { month: 'Mar', revenue: 240, cost: 60 },
  { month: 'Apr', revenue: 310, cost: 68 },
  { month: 'May', revenue: 420, cost: 75 },
  { month: 'Jun', revenue: 530, cost: 83 },
  { month: 'Jul', revenue: 670, cost: 92 },
  { month: 'Aug', revenue: 780, cost: 100 },
  { month: 'Sep', revenue: 920, cost: 110 },
  { month: 'Oct', revenue: 1050, cost: 120 },
  { month: 'Nov', revenue: 1180, cost: 132 },
  { month: 'Dec', revenue: 1340, cost: 145 },
];

function RevenueChart() {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={REVENUE_DATA} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 10 }} />
          <YAxis tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={(v) => `$${v}k`} />
          <Tooltip
            contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
            formatter={(value: number) => [`$${value}k`, undefined]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />
          <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" fill="url(#colorRevenue)" strokeWidth={2} />
          <Area type="monotone" dataKey="cost" name="Cost" stroke="#6366f1" fill="url(#colorCost)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

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
        
        {message.output && (
          <div className="mt-3 text-xs bg-zinc-900 border border-zinc-700 p-3 rounded-xl font-mono overflow-auto max-h-48">
            {JSON.stringify(message.output, null, 2)}
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
            {outputs.map((output, index) => (
              <div key={index} className="glass border border-zinc-700 rounded-2xl p-5">
                <div className="text-sm text-white font-medium mb-3 flex items-center gap-2">
                  {output.type === 'chart' && '📈'} 
                  {output.type === 'image' && '🖼️'} 
                  {output.type === 'table' && '📋'} 
                  {output.title}
                </div>
                
                {output.type === 'image' && output.url && (
                  <img
                    src={output.url}
                    alt={output.title}
                    className="w-full rounded-xl border border-zinc-700"
                  />
                )}

                {output.type === 'chart' && <RevenueChart />}

                {output.type === 'table' && (
                  <div className="overflow-auto rounded-xl border border-zinc-700">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-zinc-800 text-zinc-400">
                          <th className="text-left px-4 py-2 font-medium">Competitor</th>
                          <th className="text-left px-4 py-2 font-medium">Market Share</th>
                          <th className="text-left px-4 py-2 font-medium">Strengths</th>
                          <th className="text-left px-4 py-2 font-medium">Weakness</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {[
                          { name: 'Notion', share: '38%', strength: 'Templates, ecosystem', weakness: 'Complexity' },
                          { name: 'Coda', share: '22%', strength: 'Docs + automation', weakness: 'Learning curve' },
                          { name: 'Monday.com', share: '18%', strength: 'Project management', weakness: 'High pricing' },
                          { name: 'Airtable', share: '14%', strength: 'Relational data', weakness: 'UI dated' },
                        ].map((row) => (
                          <tr key={row.name} className="text-zinc-300 hover:bg-zinc-800/50 transition-colors">
                            <td className="px-4 py-2 font-medium">{row.name}</td>
                            <td className="px-4 py-2 text-emerald-400">{row.share}</td>
                            <td className="px-4 py-2">{row.strength}</td>
                            <td className="px-4 py-2 text-zinc-500">{row.weakness}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {output.type === 'report' && (
                  <div className="text-xs text-zinc-300 space-y-2 bg-zinc-950 rounded-xl p-4 border border-zinc-700">
                    <div className="font-semibold text-white mb-3">Executive Summary</div>
                    <p>Phase 1 (Months 1–6): Pilot launch in UK and Germany with localized onboarding, GDPR-compliant data handling, and regional pricing tiers at €49–€199/mo.</p>
                    <p>Phase 2 (Months 7–12): Expand to France, Netherlands, and Nordics. Activate partner channel through reseller agreements with 3–5 regional SIs.</p>
                    <p>Phase 3 (Year 2+): Full EU coverage, localized marketing automation, and dedicated EU support team. Target €6.8M ARR by end of Year 3.</p>
                    <div className="flex gap-6 pt-2 text-[10px] text-zinc-500">
                      <span>TAM: <span className="text-emerald-400">$2.8B</span></span>
                      <span>SAM: <span className="text-emerald-400">$420M</span></span>
                      <span>Target Share: <span className="text-emerald-400">1.6%</span></span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
