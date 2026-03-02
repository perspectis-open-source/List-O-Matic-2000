const API_BASE = import.meta.env.VITE_API_URL ?? ''

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export type ChatResponse = {
  matchingCompanyNames: string[]
  explanation?: string
}

export async function postChat(
  messages: ChatMessage[],
  uniqueCompanyNames: string[]
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, uniqueCompanyNames }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<ChatResponse>
}
