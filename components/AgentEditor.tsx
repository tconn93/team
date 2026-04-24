'use client';

import { useState, useEffect } from 'react';
import { Agent } from '@/lib/types';
import { useTeamForgeStore } from '@/lib/store';
import { listModels } from '@/lib/llm/router';
import { GOOGLE_SERVICES, MICROSOFT_SERVICES } from '@/lib/integrations';
import { X, Save, Loader2 } from 'lucide-react';
import type { Provider } from '@/lib/llm/router';

interface AgentEditorProps {
  agent?: Agent;
  isOpen: boolean;
  onClose: () => void;
}

const defaultColors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#ef4444'];

function getDefaultFormData(): Partial<Agent> {
  return {
    id: 'agent-' + Date.now(),
    name: '',
    role: '',
    description: '',
    systemPrompt: 'You are a helpful specialized agent. Think step by step and use your tools effectively.',
    model: 'grok-3-beta',
    provider: 'xai',
    color: defaultColors[Math.floor(Math.random() * defaultColors.length)],
    skills: [],
    tools: ['web_search'],
    status: 'idle',
    memorySize: 32,
    isCustom: true,
    guardrails: {
      maxTokens: 16000,
      maxCost: 10,
      requireApproval: false,
    },
  };
}

function agentToFormState(agent: Agent): Partial<Agent> {
  return {
    ...agent,
    skills: [...(agent.skills || [])],
    tools: [...(agent.tools || [])],
    guardrails: agent.guardrails ? { ...agent.guardrails } : undefined,
  };
}

// Popular models per provider (can be fetched dynamically via API in future)
const modelOptions: Record<Provider, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o3-mini'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-5-haiku-20241022'],
  xai: ['grok-3-beta', 'grok-2-1212', 'grok-2-vision-1212'],
  google: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'],
};

export function AgentEditor({ agent, isOpen, onClose }: AgentEditorProps) {
  const { addAgent, updateAgent, getApiKey, connections } = useTeamForgeStore();

  // Base tools + any enabled integration tools from connected services
  const integrationToolIds = [...GOOGLE_SERVICES, ...MICROSOFT_SERVICES].flatMap((s) => {
    const conn = connections[s.id];
    if (!conn?.connected) return [];
    return (conn.enabledToolIds ?? []).map((tid) => {
      const tool = s.tools.find((t) => t.id === tid);
      return tool ? { id: tid, label: `${s.icon} ${tool.name}` } : null;
    }).filter(Boolean) as { id: string; label: string }[];
  });

  const availableTools = [
    { id: 'web_search', label: '🔍 web_search' },
    { id: 'code_execution', label: '💻 code_execution' },
    { id: 'generate_image', label: '🖼️ generate_image' },
    { id: 'analyze_data', label: '📊 analyze_data' },
    ...integrationToolIds,
  ];
  
  const [formData, setFormData] = useState<Partial<Agent>>(() => getDefaultFormData());

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // `useState` only runs on mount; the editor stays mounted while the modal closes.
  // Reset form whenever we open for a different agent (or for "new").
  useEffect(() => {
    if (!isOpen) return;
    setFormData(agent ? agentToFormState(agent) : getDefaultFormData());
  }, [isOpen, agent?.id]);

  const allProviders: Provider[] = ['openai', 'anthropic', 'xai', 'google'];
  const configuredProviders = allProviders.filter((p) => getApiKey(p));

  // Load models when provider changes (dynamic fetch for xAI)
  useEffect(() => {
    const provider = formData.provider as Provider;
    if (!provider) {
      setAvailableModels([]);
      return;
    }

    const loadModels = async () => {
      setIsLoadingModels(true);
      try {
        const key = getApiKey(provider);
        const models = await listModels(provider, key);
        setAvailableModels(models);
        
        // Auto-select first model if current selection is invalid
        if (formData.model && !models.includes(formData.model)) {
          setFormData(prev => ({ ...prev, model: models[0] || 'grok-3-beta' }));
        }
      } catch (error) {
        console.error('Failed to load models:', error);
        setAvailableModels(modelOptions[provider] || ['grok-3-beta']);
      } finally {
        setIsLoadingModels(false);
      }
    };

    loadModels();
  }, [formData.provider, getApiKey]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.role || !formData.systemPrompt) {
      alert('Name, role, and system prompt are required');
      return;
    }

    const newAgent = {
      ...formData,
      id: agent?.id || 'custom-' + Date.now().toString(36),
      skills: formData.skills || [],
      tools: formData.tools || [],
    } as Agent;

    if (agent) {
      updateAgent(newAgent);
    } else {
      addAgent(newAgent);
    }
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
      <div className="glass border border-zinc-700 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 px-8 py-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              {agent ? 'Edit Agent' : 'Create New Agent'}
            </h2>
            <p className="text-zinc-400 text-sm">Define role, capabilities, and guardrails</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-8 space-y-8">
          <div className="grid grid-cols-2 gap-8">
            {/* Basic Info */}
            <div className="space-y-6">
              <div>
                <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2">NAME</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-5 py-4 text-lg focus:outline-none focus:border-blue-500"
                  placeholder="Dr. Elena Voss"
                  required
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2">ROLE</label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500"
                  placeholder="Senior Strategy Consultant"
                  required
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2">DESCRIPTION</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-3xl px-5 py-4 h-24 resize-y focus:outline-none focus:border-blue-500"
                  placeholder="Expert at competitive strategy, market entry, and executive communication..."
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2">COLOR</label>
                <div className="flex gap-3">
                  {defaultColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-9 h-9 rounded-2xl border-2 transition-all ${formData.color === color ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* LLM & Config */}
            <div className="space-y-6">
              <div>
                <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2">PROVIDER</label>
                <select
                  value={formData.provider}
                  onChange={(e) => {
                    const newProvider = e.target.value as Provider;
                    setFormData({
                      ...formData,
                      provider: newProvider,
                      model: modelOptions[newProvider]?.[0] || 'grok-3-beta',
                    });
                  }}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500"
                >
                  {allProviders.map((p) => {
                    const label =
                      p === 'xai' ? 'xAI (Grok)' :
                      p === 'openai' ? 'OpenAI' :
                      p === 'anthropic' ? 'Anthropic' : 'Google Gemini';
                    const configured = configuredProviders.includes(p);
                    return (
                      <option key={p} value={p}>
                        {label}{configured ? ' ✓' : ''}
                      </option>
                    );
                  })}
                </select>
                {configuredProviders.length === 0 && (
                  <p className="text-zinc-500 text-xs mt-2">Add API keys in Settings to enable real LLM calls.</p>
                )}
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-2">
                  MODEL
                  {isLoadingModels && <Loader2 className="w-3 h-3 animate-spin" />}
                </label>
                <select
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 font-mono text-sm"
                  disabled={!formData.provider || isLoadingModels}
                >
                  {availableModels.length > 0 ? (
                    availableModels.map((model) => (
                      <option key={model} value={model} className="font-mono">
                        {model}
                      </option>
                    ))
                  ) : (
                    <option value="">Select a provider first</option>
                  )}
                </select>
                {formData.provider === 'xai' && (
                  <p className="text-[10px] text-zinc-500 mt-1.5">
                    Fetching live model list from xAI API...
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-3">AVAILABLE TOOLS</label>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {availableTools.map(tool => (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => {
                        const current = formData.tools || [];
                        const newTools = current.includes(tool.id)
                          ? current.filter(t => t !== tool.id)
                          : [...current, tool.id];
                        setFormData({ ...formData, tools: newTools });
                      }}
                      className={`px-4 py-2 text-sm rounded-2xl border transition-all ${
                        (formData.tools || []).includes(tool.id)
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      {tool.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2">MEMORY SIZE (TOKENS)</label>
                <input
                  type="range"
                  min="8"
                  max="128"
                  value={formData.memorySize}
                  onChange={(e) => setFormData({ ...formData, memorySize: parseInt(e.target.value) })}
                  className="w-full accent-blue-500"
                />
                <div className="text-right text-xs text-zinc-400 mt-1">{formData.memorySize}k context</div>
              </div>

              {/* Guardrails */}
              <div className="pt-4 border-t border-zinc-700">
                <div className="text-xs uppercase tracking-widest text-zinc-500 mb-4">GUARDRAILS</div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Require Human Approval for Tools</span>
                    <input
                      type="checkbox"
                      checked={formData.guardrails?.requireApproval || false}
                      onChange={(e) => setFormData({
                        ...formData,
                        guardrails: { ...formData.guardrails, requireApproval: e.target.checked }
                      })}
                      className="w-5 h-5 accent-blue-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Max Cost per Run ($)</span>
                      <span className="font-mono">${formData.guardrails?.maxCost || 10}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={formData.guardrails?.maxCost || 10}
                      onChange={(e) => setFormData({
                        ...formData,
                        guardrails: { ...formData.guardrails, maxCost: parseInt(e.target.value) }
                      })}
                      className="w-full accent-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-3">SYSTEM PROMPT</label>
            <textarea
              value={formData.systemPrompt}
              onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
              className="w-full h-64 font-mono text-sm bg-zinc-950 border border-zinc-700 rounded-3xl p-6 focus:outline-none focus:border-blue-500 resize-y"
              placeholder="You are an expert..."
              required
            />
            <p className="text-[10px] text-zinc-500 mt-3">Be specific. This defines the agent's personality, expertise, and behavior.</p>
          </div>
        </form>

        <div className="border-t border-zinc-700 p-6 flex justify-end gap-4 bg-zinc-950">
          <button
            type="button"
            onClick={onClose}
            className="px-8 py-3.5 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            CANCEL
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="flex items-center gap-3 bg-white hover:bg-zinc-100 text-black px-10 py-3.5 rounded-2xl font-semibold transition-all"
          >
            <Save className="w-4 h-4" />
            {agent ? 'UPDATE AGENT' : 'CREATE AGENT'}
          </button>
        </div>
      </div>
    </div>
  );
}
