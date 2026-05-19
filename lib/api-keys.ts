import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { getPool, isDbAvailable, initSchema } from './db';

// Encryption key derived from env var or a fixed key for dev
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'teamforge-default-encryption-key-change-in-prod';

function getKey(): Buffer {
  // Derive a 32-byte key from the encryption key string using scrypt
  return scryptSync(ENCRYPTION_KEY, 'teamforge-salt', 32);
}

function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(ciphertext: string): string {
  const key = getKey();
  const [ivHex, encrypted] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

let dbReady = false;
let dbChecked = false;

async function ensureDb(): Promise<boolean> {
  if (dbChecked) return dbReady;
  dbChecked = true;
  try {
    dbReady = await isDbAvailable();
    if (dbReady) {
      await initSchema();
      // Ensure api_keys table exists (may already be in initSchema)
    }
  } catch {
    dbReady = false;
  }
  return dbReady;
}

export type Provider = 'anthropic' | 'openai' | 'xai' | 'google';

/**
 * Save an API key (encrypted) for a provider.
 */
export async function saveApiKey(provider: Provider, key: string): Promise<void> {
  if (await ensureDb()) {
    const encrypted = encrypt(key);
    await getPool().query(
      `INSERT INTO api_keys (provider, key_encrypted, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (provider) DO UPDATE SET key_encrypted = EXCLUDED.key_encrypted, updated_at = NOW()`,
      [provider, encrypted]
    );
  }
  // Also keep in localStorage for client-side fallback — handled by the store
}

/**
 * Retrieve a decrypted API key for a provider.
 * Checks DB first, falls back to env vars.
 */
export async function getApiKey(provider: Provider): Promise<string | undefined> {
  // Always check env var first (fastest, no DB round-trip)
  const envKey = process.env[`${provider.toUpperCase()}_API_KEY`];
  if (envKey) return envKey;

  if (await ensureDb()) {
    const result = await getPool().query(
      'SELECT key_encrypted FROM api_keys WHERE provider = $1',
      [provider]
    );
    if (result.rows.length > 0) {
      try {
        return decrypt(result.rows[0].key_encrypted);
      } catch {
        // Decryption failed — key may be corrupted
        console.error(`[ApiKey] Failed to decrypt key for ${provider}`);
        return undefined;
      }
    }
  }

  return undefined;
}

/**
 * Get all configured providers (those with keys in DB or env).
 */
export async function getConfiguredProviders(): Promise<Provider[]> {
  const providers: Provider[] = [];
  const envMap: Record<string, Provider> = {
    ANTHROPIC_API_KEY: 'anthropic',
    OPENAI_API_KEY: 'openai',
    XAI_API_KEY: 'xai',
    GOOGLE_API_KEY: 'google',
  };

  // Check env vars
  for (const [envVar, provider] of Object.entries(envMap)) {
    if (process.env[envVar]) {
      providers.push(provider);
    }
  }

  // Check DB
  if (await ensureDb()) {
    const result = await getPool().query('SELECT provider FROM api_keys');
    for (const row of result.rows) {
      if (!providers.includes(row.provider)) {
        providers.push(row.provider as Provider);
      }
    }
  }

  return providers;
}

/**
 * Delete an API key for a provider.
 */
export async function deleteApiKey(provider: Provider): Promise<boolean> {
  if (await ensureDb()) {
    const result = await getPool().query('DELETE FROM api_keys WHERE provider = $1', [provider]);
    return (result.rowCount ?? 0) > 0;
  }
  return false;
}