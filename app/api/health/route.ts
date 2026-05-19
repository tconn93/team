import { NextResponse } from 'next/server';
import { isDbAvailable } from '@/lib/db';

export async function GET() {
  const dbAvailable = await isDbAvailable().catch(() => false);

  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'TeamForge Hyperagent OS',
    version: '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    database: dbAvailable ? 'connected' : 'unavailable',
  });
}
