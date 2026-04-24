'use client';

import { useState, useRef, useEffect } from 'react';
import { useTeamForgeStore } from '@/lib/store';
import { GOOGLE_SERVICES, MICROSOFT_SERVICES } from '@/lib/integrations';
import type { Assistant, AssistantMessage } from '@/lib/types';
import { Plus, X, Save, MessageSquare, Bot, Send, Trash2, ChevronLeft, Zap } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#ef4444', '#06b6d4'];
const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'] },
  { id: 'anthropic', name: 'Anthropic', models: ['claude-sonnet-4-6', 'claude-opus-4-7', 'claude-haiku-4-5-20251001'] },
  { id: 'xai', name: 'xAI (Grok)', models: ['grok-3-beta', 'grok-2-1212'] },
  { id: 'google', name: 'Google', models: ['gemini-2.0-flash-exp', 'gemini-1.5-pro'] },
] as const;

function makeId() { return 'asst_' + Date.now().toString(36); }

// ─── Assistant Card ───────────────────────────────────────────────────────────

function AssistantCard({
  assistant,
  selected,
  onClick,
  onDelete,
}: {
  assistant: Assistant;
  selected: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-3xl cursor-pointer border transition-all group relative ${selected ? 'border-blue-500 bg-blue-950/20' : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900'}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0" style={{ background: assistant.color }}>
          {assistant.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm truncate">{assistant.name}</div>
          <div className="text-xs text-zinc-500 truncate">{assistant.description || 'No description'}</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-md">{assistant.model}</span>
            {assistant.tools.length > 0 && (
              <span className="text-[10px] text-blue-400 flex items-center gap-1"><Zap className="w-2.5 h-2.5" />{assistant.tools.length} tools</span>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Assistant Builder ────────────────────────────────────────────────────────

function AssistantBuilder({
  assistant,
  onSave,
  onCancel,
}: {
  assistant?: Assistant;
  onSave: (a: Assistant) => void;
  onCancel: () => void;
}) {
  const { connections } = useTeamForgeStore();
  const isNew = !assistant;

  const [form, setForm] = useState<Assistant>(() => assistant ?? {
    id: makeId(),
    name: '',
    description: '',
    systemPrompt: 'You are a helpful AI assistant. Answer questions clearly and concisely.',
    model: 'gpt-4o',
    provider: 'openai',
    tools: [],
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const selectedProvider = PROVIDERS.find((p) => p.id === form.provider) ?? PROVIDERS[0];

  const allTools = [...GOOGLE_SERVICES, ...MICROSOFT_SERVICES].flatMap((s) => {
    const conn = connections[s.id];
    if (!conn?.connected) return [];
    return s.tools.map((t) => ({ id: t.id, label: `${s.icon} ${t.name}`, service: s.name }));
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.systemPrompt.trim()) return;
    onSave({ ...form, updatedAt: new Date() });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-8 py-5 border-b border-zinc-800">
        <button onClick={onCancel} className="text-zinc-400 hover:text-white flex items-center gap-2 text-sm">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="text-white font-semibold ml-2">{isNew ? 'New Assistant' : `Edit: ${assistant!.name}`}</div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Identity */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-5">
              <div>
                <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2">NAME</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-5 py-4 text-lg focus:outline-none focus:border-blue-500"
                  placeholder="Customer Support Bot"
                  required
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2">DESCRIPTION</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-3xl px-5 py-4 h-20 resize-none focus:outline-none focus:border-blue-500 text-sm"
                  placeholder="What does this assistant do?"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2">COLOR</label>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                      className={`w-8 h-8 rounded-xl border-2 transition-all ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2">PROVIDER</label>
                <select
                  value={form.provider}
                  onChange={(e) => {
                    const p = PROVIDERS.find((x) => x.id === e.target.value)!;
                    setForm({ ...form, provider: e.target.value as any, model: p.models[0] });
                  }}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500"
                >
                  {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2">MODEL</label>
                <select
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 font-mono text-sm"
                >
                  {selectedProvider.models.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* Tool selection from connected integrations */}
              <div>
                <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2">INTEGRATION TOOLS</label>
                {allTools.length === 0 ? (
                  <div className="text-xs text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                    No tools available. Connect integrations first in the <span className="text-blue-400">Integrations</span> tab, then enable tools on each service.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {allTools.map((t) => {
                      const enabled = form.tools.includes(t.id);
                      return (
                        <button key={t.id} type="button"
                          onClick={() => setForm({ ...form, tools: enabled ? form.tools.filter((x) => x !== t.id) : [...form.tools, t.id] })}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${enabled ? 'bg-blue-500/10 border-blue-500/30 text-white' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                        >
                          <span className="text-xs">{t.label}</span>
                          <span className="ml-auto text-[10px] text-zinc-500">{t.service}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* System prompt */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-3">SYSTEM PROMPT</label>
            <textarea
              value={form.systemPrompt}
              onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
              className="w-full h-56 font-mono text-sm bg-zinc-950 border border-zinc-700 rounded-3xl p-6 focus:outline-none focus:border-blue-500 resize-y"
              placeholder="You are a helpful assistant..."
              required
            />
            <p className="text-[10px] text-zinc-500 mt-2">Tip: Be specific about the assistant's role, tone, and any constraints you want it to follow.</p>
          </div>

          <div className="flex justify-end gap-4">
            <button type="button" onClick={onCancel} className="px-8 py-3.5 text-zinc-400 hover:text-white transition-colors text-sm">
              Cancel
            </button>
            <button type="submit" className="flex items-center gap-2 bg-white text-black px-10 py-3.5 rounded-2xl font-semibold hover:bg-zinc-100 transition-all">
              <Save className="w-4 h-4" />
              {isNew ? 'Create Assistant' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ─── Assistant Chat ───────────────────────────────────────────────────────────

const SIMULATED_RESPONSES = [
  'I understand. Let me think through this carefully and provide you with a clear, accurate answer.',
  'Great question! Based on what you\'ve described, here\'s my analysis and recommendation.',
  'I can help with that. Let me break it down step by step for you.',
  'Thanks for the context. Here\'s what I\'d suggest based on best practices.',
  'Absolutely. I\'ve considered the key factors and here\'s my recommendation.',
];

function AssistantChat({ assistant }: { assistant: Assistant }) {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    { id: 'sys', role: 'assistant', content: `Hi! I'm ${assistant.name}. ${assistant.description || 'How can I help you today?'}`, timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  const send = () => {
    if (!input.trim() || isTyping) return;
    const userMsg: AssistantMessage = { id: `u_${Date.now()}`, role: 'user', content: input, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const resp = SIMULATED_RESPONSES[Math.floor(Math.random() * SIMULATED_RESPONSES.length)];
      const assistantMsg: AssistantMessage = { id: `a_${Date.now()}`, role: 'assistant', content: resp, timestamp: new Date() };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 1200 + Math.random() * 800);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 bg-zinc-950">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ background: assistant.color }}>
          {assistant.name[0]}
        </div>
        <div>
          <div className="text-sm font-medium text-white">{assistant.name}</div>
          <div className="text-[10px] text-zinc-500">{assistant.model} · Test session</div>
        </div>
        <div className="ml-auto">
          <div className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">SIMULATION</div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-5">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mt-0.5" style={{ background: assistant.color }}>
                {assistant.name[0]}
              </div>
            )}
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-zinc-800 text-zinc-200 rounded-bl-sm'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ background: assistant.color }}>
              {assistant.name[0]}
            </div>
            <div className="bg-zinc-800 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-950">
        <div className="flex gap-3 bg-zinc-900 border border-zinc-700 focus-within:border-blue-500 rounded-2xl p-2 transition-colors">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`Message ${assistant.name}…`}
            className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none placeholder:text-zinc-500"
          />
          <button
            onClick={send}
            disabled={!input.trim() || isTyping}
            className="w-9 h-9 bg-white text-black rounded-xl flex items-center justify-center hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function AssistantsPanel() {
  const { assistants, addAssistant, updateAssistant, deleteAssistant } = useTeamForgeStore();
  const [selected, setSelected] = useState<Assistant | null>(null);
  const [view, setView] = useState<'list' | 'edit' | 'chat'>('list');
  const [editTarget, setEditTarget] = useState<Assistant | undefined>(undefined);

  const handleSave = (a: Assistant) => {
    if (editTarget) { updateAssistant(a); } else { addAssistant(a); }
    setSelected(a);
    setView('list');
    setEditTarget(undefined);
  };

  if (view === 'edit') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <AssistantBuilder assistant={editTarget} onSave={handleSave} onCancel={() => { setView('list'); setEditTarget(undefined); }} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left: assistant list */}
      <div className="w-80 border-r border-zinc-800 flex flex-col bg-zinc-900">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <div className="font-semibold text-white">Assistants</div>
            <div className="text-xs text-zinc-500 mt-0.5">{assistants.length} created</div>
          </div>
          <button
            onClick={() => { setEditTarget(undefined); setView('edit'); }}
            className="flex items-center gap-2 text-xs bg-white text-black px-4 py-2 rounded-2xl font-semibold hover:bg-zinc-100 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {assistants.length === 0 ? (
            <div className="py-16 text-center text-zinc-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <div className="text-sm">No assistants yet.</div>
              <div className="text-xs mt-1">Create your first custom assistant above.</div>
            </div>
          ) : (
            assistants.map((a) => (
              <AssistantCard
                key={a.id}
                assistant={a}
                selected={selected?.id === a.id}
                onClick={() => { setSelected(a); }}
                onDelete={() => {
                  deleteAssistant(a.id);
                  if (selected?.id === a.id) setSelected(null);
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* Right: detail / chat */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-zinc-500">
              <Bot className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <div className="text-lg font-medium">Select an assistant</div>
              <div className="text-sm mt-1 text-zinc-600">or create a new one to get started</div>
            </div>
          </div>
        ) : (
          <>
            {/* Tabs: Edit / Chat */}
            <div className="flex items-center gap-0 border-b border-zinc-800 bg-zinc-950 px-6">
              {(['chat', 'edit'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    if (v === 'edit') { setEditTarget(selected); setView('edit'); } else { setView('chat'); }
                  }}
                  className={`px-5 py-4 text-sm font-medium border-b-2 transition-colors ${view === v ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                >
                  {v === 'chat' ? '💬 Test Chat' : '⚙️ Configure'}
                </button>
              ))}
            </div>
            <AssistantChat assistant={selected} />
          </>
        )}
      </div>
    </div>
  );
}
