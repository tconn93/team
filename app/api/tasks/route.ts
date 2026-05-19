import { listTasks, getTask, createTask, updateTask, deleteTask, getBoardStats } from '@/lib/tasks';
import type { TaskPriority } from '@/lib/tasks';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') as string | null;
  const priority = url.searchParams.get('priority') as TaskPriority | null;
  const assignedAgent = url.searchParams.get('agent') as string | null;

  // Single task lookup
  const taskId = url.searchParams.get('id');
  if (taskId) {
    const task = await getTask(taskId);
    if (!task) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }
    return Response.json(task);
  }

  // Board stats
  if (url.searchParams.has('stats')) {
    return Response.json(await getBoardStats());
  }

  // List with filters
  const filters: Record<string, string> = {};
  if (status) filters.status = status;
  if (priority) filters.priority = priority;
  if (assignedAgent) filters.assignedAgent = assignedAgent;

  const tasks = await listTasks(
    Object.keys(filters).length > 0 ? filters as any : undefined
  );
  return Response.json(tasks);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const task = await createTask({
      title: body.title,
      description: body.description,
      priority: body.priority || 'medium',
      assignedAgent: body.assignedAgent || null,
      createdBy: body.createdBy || 'user',
      parentTaskId: body.parentTaskId,
      dependencies: body.dependencies,
    });
    return Response.json(task, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Invalid request' },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    if (!body.id) {
      return Response.json({ error: 'Task ID required' }, { status: 400 });
    }
    const task = await updateTask(body.id, body);
    if (!task) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }
    return Response.json(task);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Invalid request' },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return Response.json({ error: 'Task ID required' }, { status: 400 });
  }
  const deleted = await deleteTask(id);
  return Response.json({ deleted });
}