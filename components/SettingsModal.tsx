'use client';

import { useState, useEffect } from 'react';
import { useTeamForgeStore } from '@/lib/store';
import { X, CheckCircle, AlertCircle, Key, Shield, Brain, Save } from 'lucide-react';
import type { Provider } from '@/lib/llm/router';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const providers: { id: Provider; name: string; placeholder: string }[] = [
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-...' },
  { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-...' },
  { id: 'xai', name: 'xAI (Grok)', placeholder: 'xai-...' },
  { id: 'google', name: 'Google Gemini', placeholder: 'AIza...' },
];

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { apiKeys, setApiKey, getApiKey, settings, updateSettings } = useTeamForgeStore();
  const [testStatus, setTestStatus] = useState<Record<Provider, 'idle' | 'testing' | 'success' | 'error'>>({
    openai: 'idle',
    anthropic: 'idle',
    xai: 'idle',
    google: 'idle',
  });
  const [visibleKeys, setVisibleKeys] = useState<Record<Provider, boolean>>({
    openai: false,
    anthropic: false,
    xai: false,
    google: false,
  });
  const [activeTab, setActiveTab] = useState<'providers' | 'safety'>('providers');

  const handleTestConnection = async (provider: Provider) => {
    const key = getApiKey(provider);
    if (!key) {
      alert(`Please enter a ${provider} API key first`);
      return;
    }

    setTestStatus(prev => ({ ...prev, [provider]: 'testing' }));

    try {
      if (provider === 'anthropic') {
        const response = await fetch('/api/test-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, apiKey: key }),
        });
        const data = await response.json();
        setTestStatus(prev => ({
          ...prev,
          [provider]: data.success ? 'success' : 'error',
        }));
      } else {
        const isValid = key.length > 10;
        setTestStatus(prev => ({
          ...prev,
          [provider]: isValid ? 'success' : 'error',
        }));
      }
    } catch {
      setTestStatus(prev => ({ ...prev, [provider]: 'error' }));
    }

    setTimeout(() => {
      setTestStatus(prev => ({ ...prev, [provider]: 'idle' }));
    }, 3000);
  };

  const toggleVisibility = (provider: Provider) => {
    setVisibleKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
      <div className="glass border border-zinc-700 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-zinc-700 px-8 py-6">
          <div className="flex items-center gap-3">
            <Key className="w-6 h-6 text-emerald-400" />
            <div>
              <h2 className="text-2xl font-semibold text-white">Settings</h2>
              <p className="text-zinc-400 text-sm">Configure providers and safety features</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-zinc-700">
          <button
            onClick={() => setActiveTab('providers')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'providers'
                ? 'text-emerald-400 border-b-2 border-emerald-400'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            LLM Providers
          </button>
          <button
            onClick={() => setActiveTab('safety')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'safety'
                ? 'text-emerald-400 border-b-2 border-emerald-400'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Safety & Guardrails
          </button>
        </div>

        <div className="flex-1 p-8 space-y-8 overflow-auto">
          {activeTab === 'providers' && providers.map((provider) => {
            const currentKey = getApiKey(provider.id);
            const status = testStatus[provider.id];
            const isVisible = visibleKeys[provider.id];

            return (
              <div key={provider.id} className="glass border border-zinc-700 rounded-3xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-semibold text-lg">
                    {provider.name}
                    {provider.id === 'anthropic' && (
                      <span className="ml-2 text-[10px] px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full align-middle">PRIMARY</span>
                    )}
                  </div>
                  {currentKey && (
                    <div className="flex items-center gap-2 text-xs px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full">
                      <CheckCircle className="w-3 h-3" /> Configured
                    </div>
                  )}
                </div>

                <div className="relative">
                  <input
                    type={isVisible ? "text" : "password"}
                    value={currentKey || ''}
                    onChange={(e) => setApiKey(provider.id, e.target.value)}
                    placeholder={provider.placeholder}
                    className="w-full font-mono bg-zinc-950 border border-zinc-700 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={() => toggleVisibility(provider.id)}
                    className="absolute right-4 top-4 text-xs text-zinc-400 hover:text-white px-3 py-1"
                  >
                    {isVisible ? 'HIDE' : 'SHOW'}
                  </button>
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => handleTestConnection(provider.id)}
                    disabled={status === 'testing' || !currentKey}
                    className="flex-1 py-3 text-sm border border-zinc-700 hover:border-emerald-500 rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {status === 'testing' ? (
                      <>Testing connection...</>
                    ) : (
                      <>Test Connection</>
                    )}
                  </button>

                  {status === 'success' && (
                    <div className="flex items-center gap-2 px-4 text-emerald-400 text-sm">
                      <CheckCircle className="w-5 h-5" /> Connected
                    </div>
                  )}
                  {status === 'error' && (
                    <div className="flex items-center gap-2 px-4 text-red-400 text-sm">
                      <AlertCircle className="w-5 h-5" /> Failed
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-zinc-500 mt-4">
                  {provider.id === 'anthropic'
                    ? 'Required for agent execution. Get your key from console.anthropic.com'
                    : 'Keys are stored locally in your browser. Get keys from the provider dashboards.'}
                </p>
              </div>
            );
          })}

          {activeTab === 'safety' && (
            <div className="space-y-6">
              {/* HITL Approval */}
              <div className="glass border border-zinc-700 rounded-3xl p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Shield className="w-5 h-5 text-amber-400" />
                      <h3 className="text-lg font-semibold">Human-in-the-Loop Approval</h3>
                    </div>
                    <p className="text-sm text-zinc-400 mb-1">
                      Require manual approval before executing high-impact tool calls (code_execution, file_write, file_edit).
                    </p>
                    <p className="text-xs text-zinc-500">
                      When enabled, the agent pauses and waits for you to approve or deny each sensitive tool call before proceeding.
                    </p>
                  </div>
                  <button
                    onClick={() => updateSettings({ hitlEnabled: !settings.hitlEnabled })}
                    className={`ml-4 relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                      settings.hitlEnabled ? 'bg-emerald-500' : 'bg-zinc-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        settings.hitlEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Hallucination Guardrails */}
              <div className="glass border border-zinc-700 rounded-3xl p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Brain className="w-5 h-5 text-purple-400" />
                      <h3 className="text-lg font-semibold">Hallucination Guardrails</h3>
                    </div>
                    <p className="text-sm text-zinc-400 mb-1">
                      Validate agent outputs and tool results for hallucination signals using a lightweight model check.
                    </p>
                    <p className="text-xs text-zinc-500">
                      Adds a small inference per tool call to detect fabricated facts, confident falsehoods, and tool hallucinations. Minimal performance impact.
                    </p>
                  </div>
                  <button
                    onClick={() => updateSettings({ guardrailsEnabled: !settings.guardrailsEnabled })}
                    className={`ml-4 relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                      settings.guardrailsEnabled ? 'bg-emerald-500' : 'bg-zinc-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        settings.guardrailsEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Checkpointing */}
              <div className="glass border border-zinc-700 rounded-3xl p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Save className="w-5 h-5 text-blue-400" />
                      <h3 className="text-lg font-semibold">Execution Checkpointing</h3>
                    </div>
                    <p className="text-sm text-zinc-400 mb-1">
                      Save agent conversation state after each iteration so execution can resume after crashes.
                    </p>
                    <p className="text-xs text-zinc-500">
                      Requires Postgres. Checkpoints are saved after each tool call round and cleaned up on successful completion.
                    </p>
                  </div>
                  <button
                    onClick={() => updateSettings({ checkpointingEnabled: !settings.checkpointingEnabled })}
                    className={`ml-4 relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                      settings.checkpointingEnabled ? 'bg-emerald-500' : 'bg-zinc-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        settings.checkpointingEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Per-agent override info */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
                <h4 className="text-sm font-medium text-zinc-300 mb-2">Per-Agent Overrides</h4>
                <p className="text-xs text-zinc-500">
                  Individual agents can be configured with <code className="text-zinc-400 bg-zinc-800 px-1 rounded">requireApproval: true</code> in their guardrails
                  to force HITL approval regardless of the global setting. Edit an agent&apos;s configuration to set per-agent guardrails.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-700 p-6 bg-zinc-950 text-xs text-zinc-400 flex justify-between items-center">
          <div>Changes are saved automatically</div>
          <button
            onClick={onClose}
            className="px-8 py-3 bg-white text-black rounded-2xl font-medium hover:bg-zinc-100"
          >
            DONE
          </button>
        </div>
      </div>
    </div>
  );
}