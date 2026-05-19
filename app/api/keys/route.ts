import { saveApiKey, getApiKey, getConfiguredProviders, deleteApiKey, type Provider } from '@/lib/api-keys';

export async function GET() {
  const providers = await getConfiguredProviders();
  // Never return the actual key values — only which providers are configured
  return Response.json({
    configured: providers,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, key } = body;

    if (!provider || !key) {
      return Response.json({ error: 'provider and key are required' }, { status: 400 });
    }

    const validProviders: Provider[] = ['anthropic', 'openai', 'xai', 'google'];
    if (!validProviders.includes(provider)) {
      return Response.json({ error: `Invalid provider. Valid: ${validProviders.join(', ')}` }, { status: 400 });
    }

    // Validate the key works before saving (optional — skip for now, just save)
    await saveApiKey(provider as Provider, key);
    return Response.json({ saved: true, provider });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to save key' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider') as Provider | null;

  if (!provider) {
    return Response.json({ error: 'provider query param required' }, { status: 400 });
  }

  const deleted = await deleteApiKey(provider);
  return Response.json({ deleted });
}