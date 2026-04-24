'use client';

import { useState, useCallback, useRef, DragEvent } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  BackgroundVariant,
  type Connection,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTeamForgeStore } from '@/lib/store';
import type { AgentFlow } from '@/lib/types';
import { GOOGLE_SERVICES, MICROSOFT_SERVICES } from '@/lib/integrations';
import { Plus, Save, Play, Trash2, GitBranch } from 'lucide-react';

// ─── Node type definitions ────────────────────────────────────────────────────

const NODE_TYPES_CONFIG = [
  { type: 'trigger', label: 'Trigger', icon: '⚡', color: '#10b981', description: 'Starting point for the flow' },
  { type: 'agent', label: 'Agent', icon: '🤖', color: '#6366f1', description: 'Run a specialized agent' },
  { type: 'tool', label: 'Integration Tool', icon: '🔧', color: '#f59e0b', description: 'Call a connected service' },
  { type: 'condition', label: 'Condition', icon: '🔀', color: '#8b5cf6', description: 'Branch based on logic' },
  { type: 'transform', label: 'Transform', icon: '⚙️', color: '#06b6d4', description: 'Format or reshape data' },
  { type: 'output', label: 'Output', icon: '🏁', color: '#ec4899', description: 'Final result of the flow' },
] as const;

type NodeConfigType = typeof NODE_TYPES_CONFIG[number]['type'];

// ─── Custom node component ────────────────────────────────────────────────────

function FlowNode({ data, selected, type }: NodeProps) {
  const config = NODE_TYPES_CONFIG.find((n) => n.type === type) ?? NODE_TYPES_CONFIG[0];
  const hasInput = type !== 'trigger';
  const hasOutput = type !== 'output';

  return (
    <div className={`min-w-[180px] rounded-2xl border-2 transition-all shadow-xl ${selected ? 'border-white' : 'border-transparent'}`}
      style={{ background: config.color + '18', borderColor: selected ? 'white' : config.color + '60' }}
    >
      {hasInput && (
        <Handle type="target" position={Position.Top}
          style={{ background: config.color, border: '2px solid #09090b', width: 12, height: 12, top: -6 }}
        />
      )}

      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">{config.icon}</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: config.color }}>{config.label}</span>
        </div>
        <div className="text-sm font-semibold text-white leading-tight">{(data.label as string) || config.label}</div>
        {(data.config as any)?.note && (
          <div className="text-xs text-zinc-400 mt-1 leading-snug">{(data.config as any).note}</div>
        )}
      </div>

      {hasOutput && (
        <Handle type="source" position={Position.Bottom}
          style={{ background: config.color, border: '2px solid #09090b', width: 12, height: 12, bottom: -6 }}
        />
      )}
      {type === 'condition' && (
        <>
          <Handle type="source" id="yes" position={Position.Left}
            style={{ background: '#10b981', border: '2px solid #09090b', width: 10, height: 10, left: -5, top: '60%' }}
          />
          <Handle type="source" id="no" position={Position.Right}
            style={{ background: '#ef4444', border: '2px solid #09090b', width: 10, height: 10, right: -5, top: '60%' }}
          />
        </>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  trigger: FlowNode,
  agent: FlowNode,
  tool: FlowNode,
  condition: FlowNode,
  transform: FlowNode,
  output: FlowNode,
};

// ─── Node palette (drag source) ───────────────────────────────────────────────

function NodePalette() {
  const onDragStart = (e: DragEvent, nodeType: string) => {
    e.dataTransfer.setData('application/reactflow', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col overflow-y-auto">
      <div className="p-5 border-b border-zinc-800">
        <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Node Palette</div>
        <div className="text-[10px] text-zinc-600">Drag nodes onto the canvas</div>
      </div>
      <div className="p-4 space-y-2">
        {NODE_TYPES_CONFIG.map((n) => (
          <div
            key={n.type}
            draggable
            onDragStart={(e) => onDragStart(e, n.type)}
            className="flex items-center gap-3 px-4 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 rounded-2xl cursor-grab active:cursor-grabbing transition-all select-none"
          >
            <span className="text-xl">{n.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white">{n.label}</div>
              <div className="text-[10px] text-zinc-500 truncate">{n.description}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick templates */}
      <div className="p-4 border-t border-zinc-800 mt-auto">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Quick Templates</div>
        <div className="space-y-2">
          {[
            { name: 'Research Flow', desc: 'Trigger → Research → Output' },
            { name: 'Email Responder', desc: 'Trigger → Read → Condition → Send' },
            { name: 'Data Pipeline', desc: 'Trigger → Fetch → Transform → Save' },
          ].map((t) => (
            <div key={t.name} className="px-3 py-2 bg-zinc-900 rounded-xl cursor-pointer hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 transition-all">
              <div className="text-xs font-medium text-zinc-300">{t.name}</div>
              <div className="text-[10px] text-zinc-600">{t.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Flow Canvas ──────────────────────────────────────────────────────────────

let nodeIdCounter = 100;

function FlowCanvas({ flow, onSave }: { flow: AgentFlow; onSave: (nodes: any[], edges: any[]) => void }) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(flow.nodes as any[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flow.edges as any[]);
  const [rfInstance, setRfInstance] = useState<any>(null);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge({ ...connection, animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } }, eds));
  }, [setEdges]);

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('application/reactflow') as NodeConfigType;
    if (!nodeType || !rfInstance) return;

    const bounds = reactFlowWrapper.current?.getBoundingClientRect();
    const position = rfInstance.screenToFlowPosition({
      x: e.clientX - (bounds?.left ?? 0),
      y: e.clientY - (bounds?.top ?? 0),
    });

    const config = NODE_TYPES_CONFIG.find((n) => n.type === nodeType)!;
    const newNode = {
      id: `node_${++nodeIdCounter}`,
      type: nodeType,
      position,
      data: { label: config.label, config: {} },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [rfInstance, setNodes]);

  return (
    <div className="flex-1 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-800 bg-zinc-950">
        <div className="text-sm font-medium text-white truncate">{flow.name}</div>
        <div className="ml-auto flex items-center gap-2">
          <div className="text-[10px] text-zinc-500 px-2 py-1 bg-zinc-800 rounded-lg">{nodes.length} nodes</div>
          <button
            onClick={() => onSave(nodes, edges)}
            className="flex items-center gap-2 text-xs bg-white text-black px-5 py-2 rounded-xl font-semibold hover:bg-zinc-100 transition-all"
          >
            <Save className="w-3.5 h-3.5" /> Save
          </button>
          <button className="flex items-center gap-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl font-semibold transition-all">
            <Play className="w-3.5 h-3.5" /> Run
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={reactFlowWrapper} className="flex-1" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setRfInstance}
          nodeTypes={nodeTypes}
          fitView
          colorMode="dark"
          style={{ background: '#09090b' }}
          defaultEdgeOptions={{ animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#27272a" />
          <Controls style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12 }} />
          <MiniMap
            style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12 }}
            nodeColor={(n) => {
              const cfg = NODE_TYPES_CONFIG.find((x) => x.type === n.type);
              return cfg?.color ?? '#6366f1';
            }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}

// ─── Flow list sidebar ────────────────────────────────────────────────────────

function makeDefaultFlow(name: string): AgentFlow {
  return {
    id: 'flow_' + Date.now(),
    name,
    description: '',
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 250, y: 50 }, data: { label: 'Start', config: { note: 'Flow entry point' } } },
      { id: 'n2', type: 'agent', position: { x: 250, y: 200 }, data: { label: 'Researcher', config: {} } },
      { id: 'n3', type: 'output', position: { x: 250, y: 360 }, data: { label: 'Output', config: {} } },
    ],
    edges: [
      { id: 'e1-2', source: 'n1', target: 'n2', animated: true },
      { id: 'e2-3', source: 'n2', target: 'n3', animated: true },
    ],
  };
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function FlowsPanel() {
  const { flows, addFlow, updateFlow, deleteFlow } = useTeamForgeStore();
  const [selected, setSelected] = useState<AgentFlow | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = () => {
    if (!newName.trim()) return;
    const flow = makeDefaultFlow(newName.trim());
    addFlow(flow);
    setSelected(flow);
    setShowNew(false);
    setNewName('');
  };

  const handleSave = (nodes: any[], edges: any[]) => {
    if (!selected) return;
    const updated = { ...selected, nodes, edges, updatedAt: new Date() };
    updateFlow(updated);
    setSelected(updated);
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left sidebar: flow list */}
      <div className="w-72 border-r border-zinc-800 bg-zinc-900 flex flex-col">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <div className="font-semibold text-white">Agent Flows</div>
            <div className="text-xs text-zinc-500 mt-0.5">{flows.length} flows</div>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 text-xs bg-white text-black px-4 py-2 rounded-2xl font-semibold hover:bg-zinc-100"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>

        {showNew && (
          <div className="p-4 border-b border-zinc-800 bg-zinc-950">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNew(false); }}
              placeholder="Flow name…"
              className="w-full bg-zinc-900 border border-zinc-700 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none mb-2"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={handleCreate} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl">Create</button>
              <button onClick={() => setShowNew(false)} className="flex-1 py-2 border border-zinc-700 text-zinc-400 text-xs rounded-xl hover:border-zinc-500">Cancel</button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {flows.length === 0 && !showNew ? (
            <div className="py-16 text-center text-zinc-500">
              <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <div className="text-sm">No flows yet.</div>
              <div className="text-xs mt-1 text-zinc-600">Create your first agent flow above.</div>
            </div>
          ) : (
            flows.map((flow) => (
              <div
                key={flow.id}
                onClick={() => setSelected(flow)}
                className={`p-4 rounded-2xl cursor-pointer border group relative transition-all ${selected?.id === flow.id ? 'border-blue-500 bg-blue-950/20' : 'border-zinc-800 hover:border-zinc-600 bg-zinc-900'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400 text-sm">
                    <GitBranch className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{flow.name}</div>
                    <div className="text-[10px] text-zinc-500">{flow.nodes.length} nodes</div>
                  </div>
                  <div className={`text-[10px] px-2 py-0.5 rounded-full ${flow.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-700 text-zinc-500'}`}>
                    {flow.status}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteFlow(flow.id); if (selected?.id === flow.id) setSelected(null); }}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: canvas + palette */}
      {selected ? (
        <div className="flex-1 flex overflow-hidden">
          <NodePalette />
          <FlowCanvas flow={selected} onSave={handleSave} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-zinc-950">
          <div className="text-center text-zinc-500">
            <GitBranch className="w-20 h-20 mx-auto mb-6 opacity-10" />
            <div className="text-xl font-medium text-zinc-400">Build your first Agent Flow</div>
            <div className="text-sm text-zinc-600 mt-2 max-w-xs">
              Visually connect agents and integration tools into multi-step automated workflows.
            </div>
            <button
              onClick={() => setShowNew(true)}
              className="mt-6 flex items-center gap-2 mx-auto bg-white text-black px-8 py-3 rounded-2xl font-semibold hover:bg-zinc-100 transition-all text-sm"
            >
              <Plus className="w-4 h-4" /> Create Flow
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
