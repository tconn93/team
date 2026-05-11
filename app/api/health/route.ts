import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'TeamForge Hyperagent OS',
    version: '0.1.0',
    environment: process.env.NODE_ENV || 'development'
  });
}
