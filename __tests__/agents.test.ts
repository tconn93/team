import { describe, it, expect } from 'vitest';
import { predefinedAgents } from '../lib/agents';

describe('Agents', () => {
  it('has predefined agents', () => {
    expect(predefinedAgents.length).toBeGreaterThan(0);
    expect(predefinedAgents.some(a => a.id === 'coordinator')).toBe(true);
  });
});
