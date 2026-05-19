/**
 * Model configuration — driven by environment variables.
 *
 * DEFAULT_MODEL — standard model for agent execution (balanced cost/capability)
 * FAST_MODEL    — cheaper, faster model for reviews, scouts, context optimization
 * EXPERT_MODEL  — most capable model for complex planning and coordination
 *
 * Set these in .env to configure per-environment without code changes.
 */

export const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'claude-sonnet-4-20250514';
export const FAST_MODEL = process.env.FAST_MODEL || 'claude-3-5-haiku-20241022';
export const EXPERT_MODEL = process.env.EXPERT_MODEL || 'claude-opus-4-20250514';