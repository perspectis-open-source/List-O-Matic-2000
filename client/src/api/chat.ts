const API_BASE = import.meta.env.VITE_API_URL ?? ''

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export type ReasoningStep = { title: string; detail: string }

export type ChatResponse = {
  matchingCompanyNames: string[]
  parentCompany?: string | null
  explanation?: string
  reasoningSteps?: ReasoningStep[]
}

export async function postChat(
  messages: ChatMessage[],
  uniqueCompanyNames: string[],
  previousMatchingNames?: string[],
  originalCompany?: string
): Promise<ChatResponse> {
  const body: { messages: ChatMessage[]; uniqueCompanyNames: string[]; previousMatchingNames?: string[]; originalCompany?: string } = {
    messages,
    uniqueCompanyNames,
  }
  if (previousMatchingNames != null && previousMatchingNames.length > 0) {
    body.previousMatchingNames = previousMatchingNames
  }
  if (originalCompany != null && String(originalCompany).trim() !== '') {
    body.originalCompany = String(originalCompany).trim()
  }
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<ChatResponse>
}
