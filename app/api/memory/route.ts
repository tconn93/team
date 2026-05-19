import * as memawi from '@/lib/memawi';
import { optimizeIfNeeded } from '@/lib/context-optimizer';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'status';

  try {
    switch (action) {
      case 'status': {
        const available = await memawi.isAvailable();
        if (!available) {
          return Response.json({ available: false, message: 'Memawi server not reachable' });
        }
        const stats = await memawi.getStats();
        return Response.json({ available: true, ...stats });
      }
      case 'context': {
        const q = url.searchParams.get('q') || '';
        const agentId = url.searchParams.get('agentId') || 'coordinator';
        const tokenLimit = parseInt(url.searchParams.get('tokenLimit') || '1024');
        const context = await memawi.getContext({ q, agentId, tokenLimit });
        return Response.json(context);
      }
      case 'search': {
        const q = url.searchParams.get('q') || '';
        const agentId = url.searchParams.get('agentId') || 'coordinator';
        const n = parseInt(url.searchParams.get('n') || '10');
        const results = await memawi.recall({ query: q, agentId, n });
        return Response.json(results);
      }
      case 'list': {
        const agentId = url.searchParams.get('agentId') || 'coordinator';
        const memories = await memawi.listMemories({ agentId });
        return Response.json(memories);
      }
      case 'agent-metadata': {
        const agentId = url.searchParams.get('agentId') || 'coordinator';
        const metadata = await memawi.getAgentMetadata(agentId);
        const tokens = {
          memory: memawi.estimateTokens(metadata.memory),
          context: memawi.estimateTokens(metadata.context),
          todo: memawi.estimateTokens(metadata.todo),
          taskList: memawi.estimateTokens(metadata.taskList),
        };
        return Response.json({ ...metadata, tokens, contextOverflow: memawi.isContextOverflow(metadata.context) });
      }
      case 'agent-memory': {
        const agentId = url.searchParams.get('agentId') || 'coordinator';
        const content = await memawi.getAgentMemory(agentId);
        return Response.json({ agentId, content, tokens: memawi.estimateTokens(content) });
      }
      case 'agent-context': {
        const agentId = url.searchParams.get('agentId') || 'coordinator';
        const content = await memawi.getAgentContextFile(agentId);
        return Response.json({ agentId, content, tokens: memawi.estimateTokens(content), overflow: memawi.isContextOverflow(content) });
      }
      case 'agent-todo': {
        const agentId = url.searchParams.get('agentId') || 'coordinator';
        const content = await memawi.getAgentTodo(agentId);
        return Response.json({ agentId, content });
      }
      case 'agent-tasklist': {
        const agentId = url.searchParams.get('agentId') || 'coordinator';
        const content = await memawi.getAgentTaskList(agentId);
        return Response.json({ agentId, content });
      }
      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'Memawi error',
      available: false,
    }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'remember': {
        const memory = await memawi.remember({
          content: body.content,
          agentId: body.agentId || 'coordinator',
          level: body.level || 'agent',
          importance: body.importance,
          tags: body.tags,
          source: body.source || 'api',
        });
        return Response.json(memory, { status: 201 });
      }
      case 'ingest': {
        const memories = await memawi.ingestConversation({
          messages: body.messages,
          agentId: body.agentId || 'coordinator',
          level: body.level || 'agent',
        });
        return Response.json(memories, { status: 201 });
      }
      case 'store-todo': {
        const memory = await memawi.storeAgentTodo({
          agentId: body.agentId || 'coordinator',
          tasks: body.tasks,
          notes: body.notes,
        });
        return Response.json(memory, { status: 201 });
      }
      case 'file-context': {
        const memory = await memawi.rememberFileContext({
          agentId: body.agentId || 'coordinator',
          filePath: body.filePath,
          content: body.content,
          operation: body.operation || 'read',
        });
        return Response.json(memory, { status: 201 });
      }
      case 'task-result': {
        const memory = await memawi.rememberTaskResult({
          agentId: body.agentId || 'coordinator',
          taskTitle: body.taskTitle,
          result: body.result,
          quality: body.quality,
        });
        return Response.json(memory, { status: 201 });
      }
      case 'consolidate': {
        const result = await memawi.consolidate({
          agentId: body.agentId || 'coordinator',
          level: body.level || 'agent',
        });
        return Response.json(result);
      }
      case 'update-memory': {
        await memawi.updateAgentMemory(body.agentId || 'coordinator', body.content || '');
        return Response.json({ updated: true });
      }
      case 'update-context': {
        await memawi.updateAgentContext(body.agentId || 'coordinator', body.content || '');
        return Response.json({ updated: true });
      }
      case 'update-todo': {
        await memawi.updateAgentTodoFile(body.agentId || 'coordinator', body.content || '');
        return Response.json({ updated: true });
      }
      case 'update-tasklist': {
        await memawi.updateAgentTaskList(body.agentId || 'coordinator', body.content || '');
        return Response.json({ updated: true });
      }
      case 'optimize-context': {
        const apiKey = body.apiKey || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return Response.json({ error: 'Anthropic API key required for context optimization' }, { status: 400 });
        }
        const result = await optimizeIfNeeded(body.agentId || 'coordinator', apiKey);
        if (!result) {
          return Response.json({ message: 'Context is within limits, no optimization needed' });
        }
        return Response.json(result);
      }
      default:
        return Response.json({ error: `Unknown action: ${action}. Valid: remember, ingest, store-todo, file-context, task-result, consolidate, update-memory, update-context, update-todo, update-tasklist, optimize-context` }, { status: 400 });
    }
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'Memawi error',
    }, { status: 502 });
  }
}