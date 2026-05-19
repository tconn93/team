import { NextResponse } from 'next/server';
import { loadSettings, saveAllSettings } from '@/lib/settings';
import { isDbAvailable } from '@/lib/db';
import type { AppSettings } from '@/lib/types';
import { DEFAULT_SETTINGS } from '@/lib/settings';

export const runtime = 'nodejs';

/**
 * GET /api/settings — load current settings
 */
export async function GET() {
  try {
    if (await isDbAvailable()) {
      const settings = await loadSettings();
      return NextResponse.json(settings);
    }
  } catch {
    // DB unavailable, return defaults
  }
  return NextResponse.json(DEFAULT_SETTINGS);
}

/**
 * POST /api/settings — save settings
 */
export async function POST(request: Request) {
  try {
    const settings: AppSettings = await request.json();

    if (await isDbAvailable()) {
      await saveAllSettings(settings);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}