'use client';

/**
 * chatBridge — UI → AI chat handoff hook.
 * Any UI component can call sendToChatAsUser() to inject a message into
 * the agentic chat loop and stream the AI response.
 */

export interface ChatBridgeOptions {
  /** Extra structured context forwarded to the chat route (non-conversational) */
  context?: Record<string, unknown>;
}

/**
 * Fire a user message into /api/chat and collect the streamed response.
 * Returns the final text string once the stream closes.
 */
export async function sendToChatAsUser(
  message: string,
  options: ChatBridgeOptions = {}
): Promise<string> {
  const body: Record<string, unknown> = { role: 'user', content: message };
  if (options.context) body.context = options.context;

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `Chat request failed: ${res.status}`);
  }

  // The chat route may stream or return JSON — handle both
  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
    const reader = res.body?.getReader();
    if (!reader) return '';
    const decoder = new TextDecoder();
    let result = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }
    return result;
  }

  const data = await res.json();
  return data.assistantMessage?.content ?? data.message ?? data.response ?? JSON.stringify(data);
}

/**
 * React hook wrapping sendToChatAsUser with loading / error state.
 */
export function useChatBridge() {
  return { sendToChatAsUser };
}
