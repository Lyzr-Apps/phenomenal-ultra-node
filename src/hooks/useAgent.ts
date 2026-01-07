import { useState, useCallback } from 'react'
import { isInIframe, sendErrorToParent, requestFixFromParent } from '@/components/ErrorBoundary'
import parseLLMJson from '@/utils/jsonParser'

// =============================================================================
// Constants
// =============================================================================

// Direct Lyzr Agent API endpoint
const LYZR_API_URL = 'https://agent-prod.studio.lyzr.ai/v3/inference/chat'

// API Key from environment variable
const LYZR_API_KEY = import.meta.env.VITE_LYZR_API_KEY || ''

// =============================================================================
// Types
// =============================================================================

interface ErrorDetails {
  type: 'react_error' | 'api_error' | 'parse_error' | 'network_error' | 'unknown'
  message: string
  stack?: string
  componentStack?: string
  raw_response?: string
  endpoint?: string
  timestamp: string
  userAgent: string
  url: string
}

interface AgentResponse<T = any> {
  success: boolean
  data: T | null
  message: string
  raw_response?: string
  error?: ErrorDetails
}

interface UseAgentOptions {
  agentId?: string
  onError?: (error: ErrorDetails) => void
  showErrorModal?: boolean
}

interface AgentCallOptions {
  message: string
  agentId?: string
  userId?: string
  sessionId?: string
  assets?: string[]
}

// =============================================================================
// Global Error State for Modal
// =============================================================================

let globalErrorCallback: ((error: ErrorDetails | null) => void) | null = null

export const setGlobalErrorCallback = (callback: (error: ErrorDetails | null) => void) => {
  globalErrorCallback = callback
}

export const clearGlobalError = () => {
  if (globalErrorCallback) {
    globalErrorCallback(null)
  }
}

// =============================================================================
// Extract message from agent response with all fallbacks
// =============================================================================

export const extractAgentMessage = (data: any): string => {
  // Priority 1: Check if response has valid parsed data
  if (data.response && typeof data.response === 'object') {
    // Check if parsing failed
    if (data.response.success === false || data.response.error) {
      // Parsing failed - fall through to raw_response
    } else {
      // Valid parsed response - extract message
      if (data.response.result?.message) return data.response.result.message
      if (data.response.message) return data.response.message
      if (data.response.result && typeof data.response.result === 'string') return data.response.result
      if (typeof data.response === 'string') return data.response
      // Return stringified object
      return JSON.stringify(data.response, null, 2)
    }
  }

  // Priority 2: Try raw_response (from response object if parsing failed)
  const rawResponse = data.response?.raw_response || data.raw_response
  if (rawResponse) {
    try {
      const parsed = JSON.parse(rawResponse)
      // Extract message from common structures
      if (parsed.result?.message) return parsed.result.message
      if (parsed.message) return parsed.message
      if (parsed.status === 'success' && parsed.result) {
        return typeof parsed.result === 'string'
          ? parsed.result
          : (parsed.result.message || JSON.stringify(parsed.result, null, 2))
      }
      return JSON.stringify(parsed, null, 2)
    } catch {
      // raw_response is plain text
      return rawResponse
    }
  }

  return 'No response received'
}

// =============================================================================
// Detect if response has parsing/API error
// =============================================================================

const detectError = (data: any, endpoint: string): ErrorDetails | null => {
  // Check for parse error (response.success === false with error message)
  if (data.response && typeof data.response === 'object') {
    if (data.response.success === false && data.response.error) {
      return {
        type: 'parse_error',
        message: data.response.error,
        raw_response: data.response.raw_response || data.raw_response,
        endpoint,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      }
    }
  }

  // Check for top-level API error
  if (data.success === false && data.error) {
    return {
      type: 'api_error',
      message: data.error,
      raw_response: data.details || data.raw_response,
      endpoint,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    }
  }

  return null
}

// =============================================================================
// useAgent Hook
// =============================================================================

export const useAgent = (options: UseAgentOptions = {}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ErrorDetails | null>(null)
  const [lastResponse, setLastResponse] = useState<any>(null)

  const callAgent = useCallback(async (callOptions: AgentCallOptions): Promise<AgentResponse> => {
    const { message, agentId, userId, sessionId, assets } = callOptions
    const finalAgentId = agentId || options.agentId || import.meta.env.VITE_AGENT_ID

    if (!finalAgentId) {
      const err: ErrorDetails = {
        type: 'api_error',
        message: 'No agent_id provided',
        endpoint: LYZR_API_URL,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      }
      setError(err)
      return { success: false, data: null, message: 'No agent_id provided', error: err }
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(LYZR_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': LYZR_API_KEY },
        body: JSON.stringify({
          message,
          agent_id: finalAgentId,
          user_id: userId,
          session_id: sessionId,
          assets,
        }),
      })

      const rawText = await res.text()

      // Parse with bulletproof JSON parser
      const parsed = parseLLMJson(rawText)

      // Transform Lyzr API response to expected format
      let data: any
      if (res.ok) {
        // Check if parsing failed
        if (parsed?.success === false || parsed?.error) {
          data = {
            success: false,
            error: parsed?.error || 'Failed to parse agent response',
            raw_response: rawText,
          }
        } else {
          // The parsed data should be the agent's response object:
          // { status: "success", result: {...}, message: "..." }
          // Return it as-is so UI can access response.status, response.result, etc.
          data = {
            success: true,
            response: parsed,
            agent_id: parsed?.agent_id || finalAgentId,
            user_id: parsed?.user_id || userId,
            session_id: parsed?.session_id || sessionId,
            timestamp: parsed?.timestamp || new Date().toISOString(),
            raw_response: rawText,
          }
        }
      } else {
        data = {
          success: false,
          error: parsed?.error || parsed?.message || `API returned status ${res.status}`,
          details: rawText,
          raw_response: rawText,
        }
      }

      setLastResponse(data)

      // Detect any errors (parse errors, API errors)
      const detectedError = detectError(data, LYZR_API_URL)

      if (detectedError) {
        setError(detectedError)

        // Notify parent if in iframe
        if (isInIframe()) {
          sendErrorToParent(detectedError)
          // Trigger global error modal
          if (globalErrorCallback && options.showErrorModal !== false) {
            globalErrorCallback(detectedError)
          }
        }

        // Call custom error handler
        if (options.onError) {
          options.onError(detectedError)
        }

        // Still return the extracted message as fallback
        const message = extractAgentMessage(data)
        return {
          success: false,
          data: null,
          message,
          raw_response: data.raw_response,
          error: detectedError,
        }
      }

      // Success - extract message
      const extractedMessage = extractAgentMessage(data)
      return {
        success: true,
        data: data.response,
        message: extractedMessage,
        raw_response: data.raw_response,
      }

    } catch (networkError) {
      const err: ErrorDetails = {
        type: 'network_error',
        message: networkError instanceof Error ? networkError.message : 'Network request failed',
        stack: networkError instanceof Error ? networkError.stack : undefined,
        endpoint: LYZR_API_URL,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      }

      setError(err)

      if (isInIframe()) {
        sendErrorToParent(err)
        if (globalErrorCallback && options.showErrorModal !== false) {
          globalErrorCallback(err)
        }
      }

      if (options.onError) {
        options.onError(err)
      }

      return {
        success: false,
        data: null,
        message: 'Failed to connect to agent',
        error: err,
      }

    } finally {
      setLoading(false)
    }
  }, [options])

  const requestFix = useCallback(() => {
    if (error) {
      requestFixFromParent(error)
    }
  }, [error])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    callAgent,
    loading,
    error,
    lastResponse,
    requestFix,
    clearError,
  }
}

// =============================================================================
// Simple fetch wrapper for non-hook usage
// =============================================================================

export const callAgentAPI = async (
  message: string,
  agentId: string,
  options?: { userId?: string; sessionId?: string; assets?: string[] }
): Promise<AgentResponse> => {
  try {
    const res = await fetch(LYZR_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': LYZR_API_KEY },
      body: JSON.stringify({
        message,
        agent_id: agentId,
        user_id: options?.userId,
        session_id: options?.sessionId,
        assets: options?.assets,
      }),
    })

    const rawText = await res.text()

    // Parse with bulletproof JSON parser
    const parsed = parseLLMJson(rawText)

    // Transform Lyzr API response to expected format
    let data: any
    if (res.ok) {
      // Check if parsing failed
      if (parsed?.success === false || parsed?.error) {
        data = {
          success: false,
          error: parsed?.error || 'Failed to parse agent response',
          raw_response: rawText,
        }
      } else {
        // The parsed data should be the agent's response object:
        // { status: "success", result: {...}, message: "..." }
        // Return it as-is so UI can access response.status, response.result, etc.
        data = {
          success: true,
          response: parsed,
          agent_id: parsed?.agent_id || agentId,
          user_id: parsed?.user_id || options?.userId,
          session_id: parsed?.session_id || options?.sessionId,
          timestamp: parsed?.timestamp || new Date().toISOString(),
          raw_response: rawText,
        }
      }
    } else {
      data = {
        success: false,
        error: parsed?.error || parsed?.message || `API returned status ${res.status}`,
        details: rawText,
        raw_response: rawText,
      }
    }

    const detectedError = detectError(data, LYZR_API_URL)

    if (detectedError) {
      if (isInIframe()) {
        sendErrorToParent(detectedError)
        if (globalErrorCallback) {
          globalErrorCallback(detectedError)
        }
      }

      return {
        success: false,
        data: null,
        message: extractAgentMessage(data),
        raw_response: data.raw_response,
        error: detectedError,
      }
    }

    return {
      success: true,
      data: data.response,
      message: extractAgentMessage(data),
      raw_response: data.raw_response,
    }

  } catch (networkError) {
    const err: ErrorDetails = {
      type: 'network_error',
      message: networkError instanceof Error ? networkError.message : 'Network request failed',
      endpoint: '/api/agent',
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    }

    if (isInIframe()) {
      sendErrorToParent(err)
      if (globalErrorCallback) {
        globalErrorCallback(err)
      }
    }

    return {
      success: false,
      data: null,
      message: 'Failed to connect to agent',
      error: err,
    }
  }
}

export default useAgent
