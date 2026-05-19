import Anthropic from '@anthropic-ai/sdk';
import { FAST_MODEL } from '@/lib/models';

export async function POST(request: Request) {
  try {
    const { provider, apiKey } = await request.json();

    if (provider === 'anthropic' && apiKey) {
      const client = new Anthropic({ apiKey });

      // Make a minimal API call to verify the key works
      const response = await client.messages.create({
        model: FAST_MODEL,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      });

      return Response.json({
        success: true,
        message: `Connected to Anthropic API. Model: ${response.model}`,
      });
    }

    return Response.json({
      success: false,
      message: `Testing for ${provider} is not yet implemented. Key saved.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({
      success: false,
      message: `Connection failed: ${message}`,
    });
  }
}