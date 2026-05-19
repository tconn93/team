/**
 * Model configuration — driven by environment variables.
 *
 * Anthropic-specific env vars take priority over the generic ones:
 *   ANTHROPIC_MODEL              → overrides DEFAULT_MODEL
 *   ANTHROPIC_DEFAULT_SONNET_MODEL → overrides FAST_MODEL
 *   ANTHROPIC_DEFAULT_OPUS_MODEL   → overrides EXPERT_MODEL
 *
 * These are useful when pointing at a proxy or alternative provider
 * that speaks the Anthropic Messages API format.
 */

export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || process.env.DEFAULT_MODEL || 'claude-sonnet-4-20250514';
export const FAST_MODEL = process.env.ANTHROPIC_DEFAULT_SONNET_MODEL || process.env.FAST_MODEL || 'claude-3-5-haiku-20241022';
export const EXPERT_MODEL = process.env.ANTHROPIC_DEFAULT_OPUS_MODEL || process.env.EXPERT_MODEL || 'claude-opus-4-20250514';