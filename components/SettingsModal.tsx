'use client';

import { useState, useEffect } from 'react';
import { useTeamForgeStore } from '@/lib/store';
import { X, CheckCircle, AlertCircle, Key } from 'lucide-react';
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
  const { apiKeys, setApiKey, getApiKey } = useTeamForgeStore();
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

  const handleTestConnection = async (provider: Provider) => {
    const key = getApiKey(provider);
    if (!key) {
      alert(`Please enter a ${provider} API key first`);
      return;
    }

    setTestStatus(prev => ({ ...prev, [provider]: 'testing' }));

    // Simulate connection test (in real implementation this would call the LLM router with a simple prompt)
    setTimeout(() => {
      const isSuccess = Math.random() > 0.2; // 80% success rate for demo
      setTestStatus(prev => ({ 
        ...prev, 
        [provider]: isSuccess ? 'success' : 'error' 
      }));
      
      if (isSuccess) {
        setTimeout(() => {
          setTestStatus(prev => ({ ...prev, [provider]: 'idle' }));
        }, 2000);
      }
    }, 1200);
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
              <h2 className="text-2xl font-semibold text-white">LLM Providers</h2>
              <p className="text-zinc-400 text-sm">Configure API keys for your agents</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 p-8 space-y-8 overflow-auto">
          {providers.map((provider) => {
            const currentKey = getApiKey(provider.id);
            const status = testStatus[provider.id];
            const isVisible = visibleKeys[provider.id];

            return (
              <div key={provider.id} className="glass border border-zinc-700 rounded-3xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-semibold text-lg">{provider.name}</div>
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
                  Keys are stored locally in your browser. Get keys from the provider dashboards.
                </p>
              </div>
            );
          })}
        </div>

        <div className="border-t border-zinc-700 p-6 bg-zinc-950 text-xs text-zinc-400 flex justify-between items-center">
          <div>Changes are saved automatically • Keys never leave your browser in this demo</div>
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
