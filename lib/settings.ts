/**
 * App-wide settings persistence.
 *
 * Settings are stored in Postgres (app_settings table) with graceful
 * fallback to localStorage on the client side. The Zustand store holds
 * the runtime state and syncs to the backend.
 */

import type { AppSettings } from './types';
import { getPool } from './db';

const DEFAULT_SETTINGS: AppSettings = {
  hitlEnabled: false,
  guardrailsEnabled: false,
  checkpointingEnabled: false,
};

/**
 * Load settings from Postgres. Returns defaults if DB unavailable.
 */
export async function loadSettings(): Promise<AppSettings> {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT key, value FROM app_settings');
    const settings = { ...DEFAULT_SETTINGS };

    for (const row of result.rows) {
      switch (row.key) {
        case 'hitlEnabled':
          settings.hitlEnabled = row.value === true || row.value?.hitlEnabled === true;
          break;
        case 'guardrailsEnabled':
          settings.guardrailsEnabled = row.value === true || row.value?.guardrailsEnabled === true;
          break;
        case 'checkpointingEnabled':
          settings.checkpointingEnabled = row.value === true || row.value?.checkpointingEnabled === true;
          break;
      }
    }

    return settings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Save a single setting to Postgres.
 */
export async function saveSetting(key: keyof AppSettings, value: boolean): Promise<void> {
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, JSON.stringify(value)],
    );
  } catch {
    // DB unavailable — setting not persisted, client still works
  }
}

/**
 * Save all settings at once.
 */
export async function saveAllSettings(settings: AppSettings): Promise<void> {
  try {
    const pool = getPool();
    for (const [key, value] of Object.entries(settings)) {
      await pool.query(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, JSON.stringify(value)],
      );
    }
  } catch {
    // DB unavailable
  }
}

export { DEFAULT_SETTINGS };