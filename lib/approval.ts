/**
 * Approval request manager for Human-in-the-Loop (HITL) tool approval.
 *
 * When HITL is enabled, tool calls that require approval create a pending
 * request. The SSE stream emits a `tool_approval_request` event, and the
 * client must POST to `/api/run/approve` to resolve it.
 */

interface PendingApproval {
  id: string;
  agentId: string;
  agentName?: string;
  tool: string;
  input: Record<string, unknown>;
  resolve: (value: { approved: boolean; modifiedInput?: Record<string, unknown> }) => void;
  reject: (error: Error) => void;
  createdAt: number;
}

const pendingApprovals = new Map<string, PendingApproval>();

const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface ApprovalRequest {
  id: string;
  agentId: string;
  agentName?: string;
  tool: string;
  input: Record<string, unknown>;
}

/**
 * Create a pending approval request and return a promise that resolves
 * when the client approves or rejects it.
 */
export function requestApproval(params: {
  agentId: string;
  agentName?: string;
  tool: string;
  input: Record<string, unknown>;
}): Promise<{ approved: boolean; modifiedInput?: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const id = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const pending: PendingApproval = {
      id,
      agentId: params.agentId,
      agentName: params.agentName,
      tool: params.tool,
      input: params.input,
      resolve,
      reject,
      createdAt: Date.now(),
    };

    pendingApprovals.set(id, pending);

    // Auto-reject after timeout
    setTimeout(() => {
      if (pendingApprovals.has(id)) {
        pendingApprovals.delete(id);
        reject(new Error(`Approval request ${id} timed out after ${APPROVAL_TIMEOUT_MS / 1000}s`));
      }
    }, APPROVAL_TIMEOUT_MS);
  });
}

/**
 * Resolve a pending approval request (called by the /api/run/approve endpoint).
 */
export function resolveApproval(
  id: string,
  approved: boolean,
  modifiedInput?: Record<string, unknown>
): boolean {
  const pending = pendingApprovals.get(id);
  if (!pending) return false;

  pendingApprovals.delete(id);
  pending.resolve({ approved, modifiedInput });
  return true;
}

/**
 * Get all currently pending approval requests (for SSE polling).
 */
export function getPendingApprovals(): ApprovalRequest[] {
  return Array.from(pendingApprovals.values()).map(({ id, agentId, agentName, tool, input }) => ({
    id,
    agentId,
    agentName,
    tool,
    input,
  }));
}

/**
 * Check if HITL approval is required for a specific tool call.
 * Rules:
 * - Always require approval for: code_execution, file_write, file_edit
 * - Never require approval for: remember, recall, web_search, analyze_data, generate_image, file_read
 * - If agent has guardrails.requireApproval = true, require for all tools
 */
export function needsApproval(
  tool: string,
  agentGuardrails?: { requireApproval?: boolean; maxCost?: number; maxTokens?: number }
): boolean {
  // Per-agent override: if requireApproval is set, all tools need approval
  if (agentGuardrails?.requireApproval) return true;

  // High-impact tools always require approval
  const highImpactTools = ['bash', 'file_write', 'file_edit'];
  return highImpactTools.includes(tool);
}