'use client';

import { useState } from 'react';
import { useTeamForgeStore } from '@/lib/store';
import { GOOGLE_SERVICES, MICROSOFT_SERVICES, INTEGRATION_DOCS } from '@/lib/integrations';
import type { IntegrationServiceDef, IntegrationServiceId } from '@/lib/types';
import { X, CheckCircle, ChevronRight, ExternalLink, Plug, BookOpen, Zap, AlertCircle } from 'lucide-react';

// ─── OAuth Simulator Modal ────────────────────────────────────────────────────

function OAuthModal({
  service,
  onClose,
  onConnect,
}: {
  service: IntegrationServiceDef;
  onClose: () => void;
  onConnect: (email: string) => void;
}) {
  const [step, setStep] = useState<'consent' | 'connecting' | 'done'>('consent');
  const [email] = useState(service.provider === 'google' ? 'you@gmail.com' : 'you@company.com');

  const handleAuthorize = () => {
    setStep('connecting');
    setTimeout(() => {
      setStep('done');
      setTimeout(() => {
        onConnect(email);
        onClose();
      }, 900);
    }, 1800);
  };

  const providerName = service.provider === 'google' ? 'Google' : 'Microsoft';
  const providerColor = service.provider === 'google' ? '#4285F4' : '#0078D4';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[200] flex items-center justify-center p-6">
      <div className="bg-zinc-950 border border-zinc-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Provider header */}
        <div className="p-8 border-b border-zinc-800 text-center">
          <div className="text-5xl mb-3">{service.provider === 'google' ? '🔵' : '🟦'}</div>
          <div className="text-xl font-semibold text-white">
            {step === 'consent' && `Sign in with ${providerName}`}
            {step === 'connecting' && 'Authorizing…'}
            {step === 'done' && 'Connected!'}
          </div>
          <div className="text-zinc-400 text-sm mt-1">
            {step === 'consent' && `TeamForge wants access to your ${service.name} account`}
            {step === 'connecting' && 'Verifying permissions…'}
            {step === 'done' && `Successfully connected ${service.name}`}
          </div>
        </div>

        {step === 'consent' && (
          <div className="p-8">
            {/* Account */}
            <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-700 rounded-2xl p-4 mb-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: providerColor }}>
                {email[0].toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium text-white">{email}</div>
                <div className="text-xs text-zinc-500">{providerName} Account</div>
              </div>
            </div>

            {/* Requested permissions */}
            <div className="mb-6">
              <div className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Permissions requested</div>
              <div className="space-y-2">
                {service.scopes.map((scope) => (
                  <div key={scope} className="flex items-center gap-3 text-sm text-zinc-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>{scope}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 mb-6">
              TeamForge will only use these permissions for actions your agents explicitly trigger. You can revoke access at any time.
            </p>

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3.5 border border-zinc-700 rounded-2xl text-sm text-zinc-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleAuthorize} className="flex-1 py-3.5 rounded-2xl text-sm font-semibold text-white transition-all" style={{ background: providerColor }}>
                Authorize
              </button>
            </div>
          </div>
        )}

        {step === 'connecting' && (
          <div className="p-12 flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-full border-4 border-zinc-700 border-t-blue-500 animate-spin" />
            <div className="text-zinc-400 text-sm">Completing authorization…</div>
          </div>
        )}

        {step === 'done' && (
          <div className="p-12 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="text-white font-semibold">{service.name} connected</div>
            <div className="text-zinc-400 text-sm">{email}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Docs Drawer ──────────────────────────────────────────────────────────────

function DocsDrawer({
  service,
  onClose,
}: {
  service: IntegrationServiceDef;
  onClose: () => void;
}) {
  const steps = INTEGRATION_DOCS[service.id] ?? [];

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-zinc-950 border-l border-zinc-800 z-[150] flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="text-2xl">{service.icon}</div>
          <div>
            <div className="font-semibold text-white">{service.name} Setup Guide</div>
            <div className="text-zinc-500 text-xs mt-0.5">{service.tools.length} tools available</div>
          </div>
        </div>
        <button onClick={onClose} className="text-zinc-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* Available tools */}
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Available Tools</div>
          <div className="space-y-2">
            {service.tools.map((tool) => (
              <div key={tool.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span>{tool.icon}</span>
                  <span className="text-sm font-medium text-white">{tool.name}</span>
                </div>
                <div className="text-xs text-zinc-400">{tool.description}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {tool.parameters.filter((p) => p.required).map((p) => (
                    <span key={p.name} className="text-[10px] px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-md font-mono">{p.name}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Setup guide */}
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-500 mb-4">Connection Steps</div>
          <div className="space-y-5">
            {steps.map((step) => (
              <div key={step.step} className="relative pl-10">
                <div className="absolute left-0 top-0 w-7 h-7 rounded-full bg-zinc-800 border border-zinc-600 flex items-center justify-center text-xs font-bold text-zinc-300">
                  {step.step}
                </div>
                <div className="font-medium text-white text-sm mb-1">{step.title}</div>
                <div className="text-zinc-400 text-sm leading-relaxed">{step.body}</div>
                {step.code && (
                  <div className="mt-2 bg-black rounded-xl p-3 font-mono text-xs text-emerald-300 border border-zinc-800 overflow-auto">
                    {step.code}
                  </div>
                )}
                {step.tip && (
                  <div className="mt-2 flex items-start gap-2 text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    {step.tip}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* External links */}
        <div className="border-t border-zinc-800 pt-6">
          <div className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Official Docs</div>
          {service.provider === 'google' ? (
            <div className="space-y-2 text-sm">
              <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-400 hover:text-blue-300">
                <ExternalLink className="w-3.5 h-3.5" /> Google Cloud Console
              </a>
              <a href="https://developers.google.com/identity/protocols/oauth2" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-400 hover:text-blue-300">
                <ExternalLink className="w-3.5 h-3.5" /> Google OAuth 2.0 Docs
              </a>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <a href="https://portal.azure.com" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-400 hover:text-blue-300">
                <ExternalLink className="w-3.5 h-3.5" /> Azure Portal
              </a>
              <a href="https://graph.microsoft.com" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-400 hover:text-blue-300">
                <ExternalLink className="w-3.5 h-3.5" /> Microsoft Graph Explorer
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({
  service,
  onConnect,
  onDisconnect,
  onShowDocs,
}: {
  service: IntegrationServiceDef;
  onConnect: () => void;
  onDisconnect: () => void;
  onShowDocs: () => void;
}) {
  const { connections, toggleIntegrationTool } = useTeamForgeStore();
  const conn = connections[service.id];
  const isConnected = conn?.connected ?? false;

  return (
    <div className={`bg-zinc-900 border rounded-3xl p-6 transition-all ${isConnected ? 'border-emerald-500/30' : 'border-zinc-800 hover:border-zinc-600'}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl" style={{ background: service.color + '22' }}>
            {service.icon}
          </div>
          <div>
            <div className="font-semibold text-white">{service.name}</div>
            <div className="text-xs text-zinc-500">{service.category}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected && (
            <div className="flex items-center gap-1.5 text-xs px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </div>
          )}
        </div>
      </div>

      <p className="text-zinc-400 text-sm mb-4 leading-relaxed">{service.description}</p>

      {/* Connected account */}
      {isConnected && conn?.accountEmail && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-zinc-800 rounded-2xl">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs text-emerald-400 font-bold">
            {conn.accountEmail[0].toUpperCase()}
          </div>
          <span className="text-xs text-zinc-300 font-mono">{conn.accountEmail}</span>
        </div>
      )}

      {/* Tools */}
      {isConnected && (
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Enable tools for agents</div>
          <div className="space-y-1.5">
            {service.tools.map((tool) => {
              const enabled = conn?.enabledToolIds?.includes(tool.id) ?? false;
              return (
                <button
                  key={tool.id}
                  onClick={() => toggleIntegrationTool(service.id as IntegrationServiceId, tool.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border text-sm transition-all ${enabled ? 'bg-blue-500/10 border-blue-500/30 text-white' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                >
                  <span className="text-base">{tool.icon}</span>
                  <span className="flex-1 text-left">{tool.name}</span>
                  {enabled && <Zap className="w-3.5 h-3.5 text-blue-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!isConnected && (
        <div className="flex flex-wrap gap-2 mb-4">
          {service.tools.map((tool) => (
            <span key={tool.id} className="text-[10px] px-2.5 py-1 bg-zinc-800 text-zinc-500 rounded-xl">{tool.icon} {tool.name}</span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-zinc-800">
        <button
          onClick={onShowDocs}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <BookOpen className="w-3.5 h-3.5" /> How to connect
        </button>
        <div className="ml-auto flex gap-2">
          {isConnected ? (
            <button
              onClick={onDisconnect}
              className="text-xs px-4 py-2 border border-zinc-700 hover:border-red-500/50 hover:text-red-400 rounded-2xl transition-colors text-zinc-400"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={onConnect}
              className="text-xs px-5 py-2 bg-white hover:bg-zinc-100 text-black font-semibold rounded-2xl transition-all flex items-center gap-2"
            >
              <Plug className="w-3.5 h-3.5" /> Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function IntegrationsPanel() {
  const { connectIntegration, disconnectIntegration, connections } = useTeamForgeStore();
  const [oauthService, setOauthService] = useState<IntegrationServiceDef | null>(null);
  const [docsService, setDocsService] = useState<IntegrationServiceDef | null>(null);
  const [activeProvider, setActiveProvider] = useState<'google' | 'microsoft'>('google');

  const connectedCount = Object.values(connections).filter((c) => c.connected).length;
  const enabledToolCount = Object.values(connections).reduce((n, c) => n + (c.enabledToolIds?.length ?? 0), 0);

  const services = activeProvider === 'google' ? GOOGLE_SERVICES : MICROSOFT_SERVICES;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Integrations</h2>
            <p className="text-zinc-400 text-sm mt-1">Connect apps to give your agents real-world capabilities</p>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{connectedCount}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Connected</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{enabledToolCount}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Tools Enabled</div>
            </div>
          </div>
        </div>

        {/* Provider tabs */}
        <div className="flex gap-2 mt-5">
          {(['google', 'microsoft'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setActiveProvider(p)}
              className={`px-6 py-2.5 rounded-2xl text-sm font-medium transition-all ${activeProvider === p ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
            >
              {p === 'google' ? '🔵 Google Workspace' : '🟦 Microsoft 365'}
            </button>
          ))}
        </div>
      </div>

      {/* Service grid */}
      <div className="p-8 grid grid-cols-1 xl:grid-cols-2 gap-5">
        {services.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            onConnect={() => setOauthService(service)}
            onDisconnect={() => disconnectIntegration(service.id as IntegrationServiceId)}
            onShowDocs={() => setDocsService(service)}
          />
        ))}
      </div>

      {/* Help footer */}
      <div className="px-8 pb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 text-sm">
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-white mb-1">Setting up OAuth for the first time?</div>
              <p className="text-zinc-400 leading-relaxed">
                Click <span className="text-zinc-200 font-medium">"How to connect"</span> on any service card for a step-by-step guide. You'll need a Google Cloud project or Azure AD app registration. Once connected, enable individual tools so your agents can use them.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* OAuth modal */}
      {oauthService && (
        <OAuthModal
          service={oauthService}
          onClose={() => setOauthService(null)}
          onConnect={(email) => {
            connectIntegration(oauthService.id as IntegrationServiceId, email);
            setOauthService(null);
          }}
        />
      )}

      {/* Docs drawer */}
      {docsService && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[140]" onClick={() => setDocsService(null)} />
          <DocsDrawer service={docsService} onClose={() => setDocsService(null)} />
        </>
      )}
    </div>
  );
}
