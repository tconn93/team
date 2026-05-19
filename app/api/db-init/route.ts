import { initSchema, isDbAvailable } from '@/lib/db';

export async function POST() {
  try {
    const available = await isDbAvailable();
    if (!available) {
      return Response.json(
        { error: 'Database connection failed. Check POSTGRES_DB_URL environment variable.' },
        { status: 503 }
      );
    }

    await initSchema();
    return Response.json({ message: 'Database schema initialized successfully' });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Schema initialization failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const available = await isDbAvailable().catch(() => false);
  return Response.json({
    database: available ? 'connected' : 'unavailable',
    url: process.env.POSTGRES_DB_URL ? 'configured' : 'not set',
  });
}