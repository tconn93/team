import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createXai } from '@ai-sdk/xai';
import { LanguageModelV1 } from 'ai';
import { z } from 'zod';

export type Provider = 'openai' | 'anthropic' | 'xai' | 'google';

export interface ApiKeyConfig {
  openai?: string;
  anthropic?: string;
  xai?: string;
  google?: string;
}

const providerFactories = {
  openai: (apiKey?: string) =>
    createOpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    }),
  anthropic: (apiKey?: string) =>
    createAnthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    }),
  xai: (apiKey?: string) =>
    createXai({
      apiKey: apiKey || process.env.XAI_API_KEY,
    }),
  google: (apiKey?: string) =>
    createGoogleGenerativeAI({
      apiKey: apiKey || process.env.GOOGLE_API_KEY,
    }),
} as const;

/**
 * Unified LLM Router
 */
export function getLLM(provider: Provider, model: string, apiKeys: ApiKeyConfig = {}): LanguageModelV1 {
  const factory = providerFactories[provider];
  if (!factory) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const key = apiKeys[provider];
  const instance = factory(key);

  switch (provider) {
    case 'openai':
    case 'anthropic':
    case 'xai':
    case 'google':
      return instance(model as any);
    default:
      throw new Error(`Model selection not implemented for provider ${provider}`);
  }
}

/**
 * Generate structured execution plan (mock for now - replace with real LLM call)
 */
export async function generateStructuredPlan(
  goal: string, 
  provider: Provider = 'xai', 
  model: string = 'grok-3-beta',
  apiKeys: ApiKeyConfig = {}
) {
  console.log(`[LLM Router] Generating plan with ${provider}/${model} for goal: ${goal.substring(0, 60)}...`);
  
  return {
    id: 'plan-' + Date.now(),
    goal,
    subtasks: [
      {
        id: 't1',
        title: 'Comprehensive Research Phase',
        description: 'Gather market data, competitor analysis, regulatory requirements using web tools.',
        assignedAgent: 'researcher',
        status: 'pending' as const,
        estimatedTime: 25,
      },
      {
        id: 't2',
        title: 'Financial Modeling & Projections',
        description: 'Build comprehensive 3-year financial projections.',
        assignedAgent: 'analyst',
        status: 'pending' as const,
        estimatedTime: 30,
      },
      {
        id: 't3',
        title: 'Go-to-Market Strategy Development',
        description: 'Develop detailed GTM plan including positioning and pricing.',
        assignedAgent: 'writer',
        status: 'pending' as const,
        estimatedTime: 20,
      },
    ],
    estimatedCost: 12.45,
    createdAt: new Date(),
  };
}

// Zod schema for structured plan output
export const ExecutionPlanSchema = z.object({
  goal: z.string(),
  subtasks: z.array(z.object({
    title: z.string(),
    description: z.string(),
    assignedAgent: z.string(),
    estimatedTime: z.number(),
  })),
  estimatedCost: z.number(),
});

/**
 * Dynamically fetches available models from a provider's /v1/models endpoint (or equivalent).
 * Supports real API calls for OpenAI, Anthropic, xAI. Falls back gracefully.
 */
export async function listModels(
  provider: Provider, 
  apiKey?: string
): Promise<string[]> {
  const baseHeaders = {
    'Content-Type': 'application/json',
  };

  try {
    let url: string;
    let headers: Record<string, string> = { ...baseHeaders };
    let filterFn = (model: any) => true;

    switch (provider) {
      case 'xai':
        url = 'https://api.x.ai/v1/models';
        headers.Authorization = `Bearer ${apiKey}`;
        filterFn = (model: any) => 
          model.id?.toLowerCase().includes('grok') && 
          !model.id?.toLowerCase().includes('vision');
        break;

      case 'openai':
        url = 'https://api.openai.com/v1/models';
        headers.Authorization = `Bearer ${apiKey}`;
        filterFn = (model: any) => 
          model.id?.startsWith('gpt-') || 
          model.id?.startsWith('o1-') || 
          model.id?.startsWith('o3-');
        break;

      case 'anthropic':
        url = 'https://api.anthropic.com/v1/models';
        headers['x-api-key'] = apiKey || '';
        headers['anthropic-version'] = '2023-06-01';
        filterFn = (model: any) => model.type === 'model' || model.id?.includes('claude');
        break;

      case 'google':
        return ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'];

      default:
        return [];
    }

    if (!apiKey) {
      throw new Error('No API key provided');
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`${provider} API error: ${response.status}`);
    }

    const data = await response.json();
    
    let models: any[] = [];
    if (provider === 'anthropic') {
      models = data.models || [];
    } else {
      models = data.data || [];
    }

    const filtered = models
      .filter(filterFn)
      .map((model: any) => model.id || model.name)
      .filter(Boolean)
      .sort();

    return filtered.length > 0 ? filtered : getStaticFallback(provider);
  } catch (error) {
    console.warn(`Failed to fetch dynamic models for ${provider}:`, error);
    return getStaticFallback(provider);
  }
}

function getStaticFallback(provider: Provider): string[] {
  const fallbacks: Record<Provider, string[]> = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'],
    anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
    xai: ['grok-3-beta', 'grok-2-1212'],
    google: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  };
  return fallbacks[provider] || [];
}
