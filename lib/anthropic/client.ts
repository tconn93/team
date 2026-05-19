import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_MODEL } from '../models';

export { Anthropic, DEFAULT_MODEL };

export function createAnthropicClient(apiKey?: string): Anthropic {
  return new Anthropic({
    apiKey: apiKey || process.env.ANTHROPIC_API_KEY || '',
    dangerouslyAllowBrowser: false,
  });
}

export function getAgentModel(agentModel?: string, agentProvider?: string): string {
  if (agentProvider === 'anthropic' && agentModel?.startsWith('claude')) {
    return agentModel;
  }
  return DEFAULT_MODEL;
}