/**
 * User question manager for agent-to-user communication.
 *
 * When an agent uses the `ask_user` tool, a pending question is created.
 * The SSE stream emits a `user_question` event, and the client must
 * POST to `/api/run/respond` to resolve it.
 */

interface PendingQuestion {
  id: string;
  agentId: string;
  question: string;
  options?: string[];
  resolve: (value: { answer: string }) => void;
  reject: (error: Error) => void;
  createdAt: number;
}

const pendingQuestions = new Map<string, PendingQuestion>();

const QUESTION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export interface QuestionRequest {
  id: string;
  agentId: string;
  question: string;
  options?: string[];
}

/**
 * Create a pending question and return a promise that resolves
 * when the client responds.
 */
export function requestUserQuestion(params: {
  agentId: string;
  question: string;
  options?: string[];
}): Promise<{ answer: string }> {
  return new Promise((resolve, reject) => {
    const id = `question-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const pending: PendingQuestion = {
      id,
      agentId: params.agentId,
      question: params.question,
      options: params.options,
      resolve,
      reject,
      createdAt: Date.now(),
    };

    pendingQuestions.set(id, pending);

    // Auto-reject after timeout
    setTimeout(() => {
      if (pendingQuestions.has(id)) {
        pendingQuestions.delete(id);
        reject(new Error(`Question ${id} timed out after ${QUESTION_TIMEOUT_MS / 1000}s`));
      }
    }, QUESTION_TIMEOUT_MS);
  });
}

/**
 * Resolve a pending question (called by the /api/run/respond endpoint).
 */
export function resolveQuestion(id: string, answer: string): boolean {
  const pending = pendingQuestions.get(id);
  if (!pending) return false;

  pendingQuestions.delete(id);
  pending.resolve({ answer });
  return true;
}

/**
 * Get all currently pending questions (for SSE polling).
 */
export function getPendingQuestions(): QuestionRequest[] {
  return Array.from(pendingQuestions.values()).map(({ id, agentId, question, options }) => ({
    id,
    agentId,
    question,
    options,
  }));
}