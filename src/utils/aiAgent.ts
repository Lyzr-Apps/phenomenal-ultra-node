/**
 * AI Agent Utility
 *
 * Direct wrapper for calling the Lyzr AI Agent API
 *
 * @example
 * ```tsx
 * import { callAIAgent } from '@/utils/aiAgent'
 *
 * const response = await callAIAgent('Explain React hooks', '68cbe7e5db8dcfa96f0df85b')
 * console.log(response)
 * ```
 */

import parseLLMJson from '@/utils/jsonParser'

// Direct Lyzr Agent API endpoint
const LYZR_API_URL = 'https://agent-prod.studio.lyzr.ai/v3/inference/chat/'

// API Key from environment variable
const LYZR_API_KEY = import.meta.env.VITE_LYZR_API_KEY || ''

export interface AIAgentRequest {
  message: string
  agent_id: string
  user_id?: string
  session_id?: string
}

export interface AIAgentResponse {
  success: boolean
  response?: any
  agent_id?: string
  user_id?: string
  session_id?: string
  timestamp?: string
  raw_response?: string
  error?: string
  details?: string
}

/**
 * Generate random UUID for user_id and session_id
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * Call the AI Agent with a message and agent_id
 *
 * @param message - Your query or prompt for the AI agent
 * @param agent_id - Agent ID (required, e.g., '68eba8c8bc2960ccbdf1b1a0')
 * @param options - Optional user_id and session_id (auto-generated if not provided)
 * @returns Promise with AI agent response
 *
 * @example
 * ```tsx
 * // Basic usage
 * const result = await callAIAgent('What is TypeScript?', '68eba8c8bc2960ccbdf1b1a0')
 *
 * // With custom user_id and session_id
 * const result = await callAIAgent(
 *   'Review this code',
 *   '68eba8c8bc2960ccbdf1b1a0',
 *   { user_id: 'shreyas@lyzr.ai', session_id: 'custom-session' }
 * )
 * ```
 */
export async function callAIAgent(
  message: string,
  agent_id: string,
  options?: { user_id?: string; session_id?: string }
): Promise<AIAgentResponse> {
  try {
    // Auto-generate IDs if not provided
    const user_id = options?.user_id || `user-${generateUUID()}`
    const session_id = options?.session_id || `${agent_id}-${generateUUID().substring(0, 12)}`

    // Direct call to Lyzr Agent API
    const response = await fetch(LYZR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LYZR_API_KEY,
      },
      body: JSON.stringify({
        message,
        agent_id,
        user_id,
        session_id,
      }),
    })

    const rawText = await response.text()

    if (response.ok) {
      // Parse raw response with bulletproof JSON parser
      const parsed = parseLLMJson(rawText)

      // Check if parsing failed
      if (parsed?.success === false || parsed?.error) {
        return {
          success: false,
          error: parsed?.error || 'Failed to parse agent response',
          raw_response: rawText,
        }
      }

      // The parsed data should be the agent's response object:
      // { status: "success", result: {...}, message: "..." }
      // Return it as-is so UI can access response.status, response.result, etc.
      return {
        success: true,
        response: parsed,
        agent_id: parsed?.agent_id || agent_id,
        user_id: parsed?.user_id || user_id,
        session_id: parsed?.session_id || session_id,
        timestamp: parsed?.timestamp || new Date().toISOString(),
        raw_response: rawText,
      }
    } else {
      // Try to parse error response
      let errorData: any = { error: 'Unknown error' }
      try {
        errorData = parseLLMJson(rawText) || JSON.parse(rawText)
      } catch {
        errorData = { error: rawText || `API returned status ${response.status}` }
      }

      return {
        success: false,
        error: errorData.error || errorData.message || `API returned status ${response.status}`,
        details: errorData.details || rawText,
        raw_response: rawText,
      }
    }
  } catch (error) {
    console.error('AI Agent call failed:', error)
    return {
      success: false,
      error: 'Failed to call AI agent',
      details: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Hook for using AI Agent in React components
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { callAgent, loading, error, response } = useAIAgent()
 *
 *   async function handleClick() {
 *     await callAgent('Explain useState hook', '68cbe7e5db8dcfa96f0df85b')
 *   }
 *
 *   return (
 *     <div>
 *       <button onClick={handleClick} disabled={loading}>
 *         Ask AI
 *       </button>
 *       {loading && <p>Loading...</p>}
 *       {error && <p>Error: {error}</p>}
 *       {response && <p>{response}</p>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useAIAgent() {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [response, setResponse] = React.useState<any>(null)

  const callAgent = async (
    message: string,
    agent_id: string,
    options?: { user_id?: string; session_id?: string }
  ) => {
    setLoading(true)
    setError(null)
    setResponse(null)

    const result = await callAIAgent(message, agent_id, options)

    if (result.success) {
      setResponse(result.response)
    } else {
      setError(result.error || 'Unknown error')
    }

    setLoading(false)
    return result
  }

  return {
    callAgent,
    loading,
    error,
    response,
  }
}

// React import for the hook
import React from 'react'

/**
 * Common AI Agent Use Cases
 */

/**
 * Generate a commit message from code changes
 * @param changes - The code changes/diff
 * @param agent_id - The agent ID to use
 */
export async function generateCommitMessage(
  changes: string,
  agent_id: string
): Promise<string> {
  const result = await callAIAgent(
    `Generate a concise git commit message for these changes:\n\n${changes}\n\nRequirements:\n- One line summary (max 72 chars)\n- Present tense\n- No quotes`,
    agent_id
  )

  if (result.success && result.response) {
    return typeof result.response === 'string'
      ? result.response
      : result.response.message || result.response.response || 'Update'
  }

  return 'Update'
}

/**
 * Ask for code explanation
 * @param code - The code to explain
 * @param agent_id - The agent ID to use
 */
export async function explainCode(code: string, agent_id: string): Promise<string> {
  const result = await callAIAgent(
    `Explain this code in simple terms:\n\n${code}`,
    agent_id
  )

  if (result.success && result.response) {
    return typeof result.response === 'string'
      ? result.response
      : result.response.message || result.response.response || ''
  }

  return ''
}

/**
 * Get code suggestions
 * @param code - The code to analyze
 * @param agent_id - The agent ID to use
 */
export async function getSuggestions(code: string, agent_id: string): Promise<string[]> {
  const result = await callAIAgent(
    `Suggest improvements for this code:\n\n${code}\n\nProvide 3-5 specific suggestions.`,
    agent_id
  )

  if (result.success && result.response) {
    const text = typeof result.response === 'string'
      ? result.response
      : result.response.message || result.response.response || ''

    // Split by newlines and filter out empty lines
    return text.split('\n').filter((line: string) => line.trim().length > 0)
  }

  return []
}

/**
 * Generate documentation
 * @param code - The code to document
 * @param agent_id - The agent ID to use
 */
export async function generateDocs(code: string, agent_id: string): Promise<string> {
  const result = await callAIAgent(
    `Generate JSDoc documentation for this code:\n\n${code}`,
    agent_id
  )

  if (result.success && result.response) {
    return typeof result.response === 'string'
      ? result.response
      : result.response.message || result.response.response || ''
  }

  return ''
}
