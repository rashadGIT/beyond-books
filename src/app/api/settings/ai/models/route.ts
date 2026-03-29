import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const FetchModelsSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'google']),
  apiKey: z.string().min(1),
});

async function fetchAnthropicModels(apiKey: string): Promise<string[]> {
  const res = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
  });
  if (!res.ok) throw new Error('Invalid Anthropic API key or request failed');
  const data = await res.json();
  return (data.data as { id: string }[])
    .map(m => m.id)
    .filter(id => id.startsWith('claude-'))
    .sort((a, b) => b.localeCompare(a));
}

async function fetchOpenAIModels(apiKey: string): Promise<string[]> {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error('Invalid OpenAI API key or request failed');
  const data = await res.json();
  // Explicit allowlist — only models confirmed to work with v1/chat/completions.
  // o3, o3-pro, and other reasoning models use the Responses API and are excluded.
  const CHAT_MODELS = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
    'o1',
    'o1-mini',
    'o1-preview',
    'o3-mini',
  ];
  const ids = (data.data as { id: string }[]).map(m => m.id);
  return CHAT_MODELS.filter(m => ids.some(id => id === m || id.startsWith(m + '-')))
    .flatMap(m => ids.filter(id => id === m || id.startsWith(m + '-')))
    .filter((id, i, arr) => arr.indexOf(id) === i) // dedupe
    .sort((a, b) => b.localeCompare(a));
}

async function fetchGoogleModels(apiKey: string): Promise<string[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );
  if (!res.ok) throw new Error('Invalid Google API key or request failed');
  const data = await res.json();
  return (data.models as { name: string; supportedGenerationMethods?: string[] }[])
    .filter(m =>
      m.name.includes('gemini') &&
      m.supportedGenerationMethods?.includes('generateContent')
    )
    .map(m => m.name.replace('models/', ''))
    .sort((a, b) => b.localeCompare(a));
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = FetchModelsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { provider, apiKey } = parsed.data;

  try {
    let models: string[];
    if (provider === 'anthropic') models = await fetchAnthropicModels(apiKey);
    else if (provider === 'openai') models = await fetchOpenAIModels(apiKey);
    else if (provider === 'google') models = await fetchGoogleModels(apiKey);
    else return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });

    return NextResponse.json({ models });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
