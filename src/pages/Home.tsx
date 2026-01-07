import { useState, useRef, useEffect } from 'react'
import {
  Menu,
  X,
  Sun,
  Moon,
  Plus,
  Send,
  Copy,
  Trash2,
  FileText,
  Download,
  ChevronDown,
  Loader2,
  ChevronUp,
  AlertCircle,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { callAIAgent } from '@/utils/aiAgent'
import { cn } from '@/lib/utils'

// Agent configuration
const AGENT_ID = '695e4164e02ec0b2d8e5688a'
const KNOWLEDGE_BASE_ID = '695e415c299cd9b5444f1b0f'

// Sample documents data
const SAMPLE_DOCUMENTS = [
  { id: 1, name: 'Quarterly_Report_Q3.pdf', pages: 45, size: '2.3MB' },
  { id: 2, name: 'Product_Strategy_2024.pdf', pages: 32, size: '1.8MB' },
  { id: 3, name: 'Company_Research.pdf', pages: 28, size: '1.5MB' },
]

// Example queries
const EXAMPLE_QUERIES = [
  'What are the key highlights from Q3 report?',
  'Summarize the product strategy for 2024',
  'What are the main competitive advantages mentioned?',
  'List all recommendations from the research document',
]

// Types
interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  sources?: Source[]
  citations?: Citation[]
  timestamp: Date
}

interface Source {
  documentName: string
  pageNumber: number
  excerpt: string
  relevance: number
}

interface Citation {
  id: number
  sourceIndex: number
  text: string
}

interface Document {
  id: number
  name: string
  pages: number
  size: string
}

// Main Home Component
export default function Home() {
  const [isDark, setIsDark] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [documents, setDocuments] = useState<Document[]>(SAMPLE_DOCUMENTS)
  const [sessionId] = useState(() => `session-${Math.random().toString(36).substr(2, 9)}`)
  const [userId] = useState(() => `user-${Math.random().toString(36).substr(2, 9)}`)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollElement) {
        setTimeout(() => {
          scrollElement.scrollTop = scrollElement.scrollHeight
        }, 0)
      }
    }
  }, [messages])

  // Handle sending message
  const handleSendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      type: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const result = await callAIAgent(input, AGENT_ID, { user_id: userId, session_id: sessionId })

      if (result.success && result.response) {
        const responseText =
          typeof result.response === 'string'
            ? result.response
            : result.response.message ||
              result.response.response ||
              result.response.result ||
              JSON.stringify(result.response)

        // Parse citations and sources from response
        const { content, sources, citations } = parseResponseWithCitations(responseText)

        const assistantMessage: Message = {
          id: `msg-${Date.now()}-response`,
          type: 'assistant',
          content,
          sources,
          citations,
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, assistantMessage])
      } else {
        const errorMessage: Message = {
          id: `msg-${Date.now()}-error`,
          type: 'assistant',
          content: `Error: ${result.error || 'Failed to get response from agent'}`,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMessage])
      }
    } catch (error) {
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        type: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  // Parse response for citations
  const parseResponseWithCitations = (
    text: string
  ): { content: string; sources: Source[]; citations: Citation[] } => {
    // Ensure text is a string
    const textStr = typeof text === 'string' ? text : String(text || '')

    const citations: Citation[] = []
    let content = textStr

    // Extract citations like [1], [2], etc.
    const citationRegex = /\[(\d+)\]/g
    let match
    while ((match = citationRegex.exec(textStr)) !== null) {
      citations.push({
        id: parseInt(match[1]),
        sourceIndex: parseInt(match[1]) - 1,
        text: match[0],
      })
    }

    // Create mock sources based on documents
    const sources: Source[] = documents.slice(0, Math.max(2, citations.length)).map((doc, idx) => ({
      documentName: doc.name,
      pageNumber: Math.floor(Math.random() * doc.pages) + 1,
      excerpt: textStr.substring(0, 150) + '...',
      relevance: 0.95 - idx * 0.1,
    }))

    return { content, sources, citations: [...new Set(citations)] }
  }

  // Handle file upload
  const handleFileUpload = () => {
    // Simulate file upload
    const newDoc: Document = {
      id: documents.length + 1,
      name: `Document_${documents.length + 1}.pdf`,
      pages: Math.floor(Math.random() * 50) + 10,
      size: `${(Math.random() * 3 + 0.5).toFixed(1)}MB`,
    }
    setDocuments((prev) => [newDoc, ...prev])
  }

  // Delete document
  const deleteDocument = (id: number) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id))
  }

  // Copy message to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  // Theme styles
  const bgClass = isDark ? 'dark bg-slate-950' : 'bg-white'
  const textClass = isDark ? 'text-slate-100' : 'text-slate-900'
  const borderClass = isDark ? 'border-slate-800' : 'border-slate-200'
  const cardBgClass = isDark ? 'bg-slate-900' : 'bg-slate-50'
  const hoverClass = isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'

  return (
    <div className={cn('flex h-screen', bgClass, textClass)}>
      {/* Sidebar */}
      <div
        className={cn(
          'transition-all duration-300 flex flex-col border-r',
          borderClass,
          sidebarOpen ? 'w-80' : 'w-0 overflow-hidden',
          cardBgClass
        )}
      >
        {/* Sidebar Header */}
        <div className='p-4 border-b flex items-center justify-between' style={{ borderColor: `hsl(var(--border))` }}>
          <h2 className='font-semibold text-sm'>Documents</h2>
          <Badge variant='outline' className='ml-auto'>
            {documents.length}
          </Badge>
        </div>

        {/* Sidebar Scroll Area */}
        <ScrollArea className='flex-1'>
          <div className='p-4 space-y-3'>
            {/* Upload Section */}
            <div
              onClick={handleFileUpload}
              className={cn(
                'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
                borderClass,
                hoverClass
              )}
            >
              <Plus className='h-5 w-5 mx-auto mb-2 text-indigo-500' />
              <p className='text-xs font-medium'>Upload PDF</p>
            </div>

            {/* Documents List */}
            <div className='space-y-2'>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className={cn(
                    'p-3 rounded-lg border transition-colors group',
                    borderClass,
                    isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                  )}
                >
                  <div className='flex items-start gap-2 mb-1'>
                    <FileText className='h-4 w-4 flex-shrink-0 mt-0.5 text-indigo-500' />
                    <span className='text-xs font-medium truncate flex-1'>{doc.name}</span>
                    <button
                      onClick={() => deleteDocument(doc.id)}
                      className={cn(
                        'opacity-0 group-hover:opacity-100 transition-opacity p-1',
                        isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200'
                      )}
                    >
                      <Trash2 className='h-3.5 w-3.5' />
                    </button>
                  </div>
                  <p className='text-xs text-slate-500'>
                    {doc.pages} pages • {doc.size}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>

        {/* Sidebar Footer */}
        <div className={cn('p-3 border-t', borderClass)}>
          <p className='text-xs text-slate-500'>Knowledge Base ID:</p>
          <code className='text-xs text-indigo-400 block truncate'>{KNOWLEDGE_BASE_ID}</code>
        </div>
      </div>

      {/* Main Content */}
      <div className='flex-1 flex flex-col'>
        {/* Header */}
        <header className={cn('border-b flex items-center justify-between px-6 py-4', borderClass)}>
          <div className='flex items-center gap-4'>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={cn('p-2 rounded-lg transition-colors', hoverClass)}
            >
              {sidebarOpen ? <ChevronUp className='h-5 w-5' /> : <Menu className='h-5 w-5' />}
            </button>
            <div>
              <h1 className='text-2xl font-bold'>Knowledge Search</h1>
              <p className='text-xs text-slate-500'>Semantic search over your documents</p>
            </div>
          </div>

          <button
            onClick={() => setIsDark(!isDark)}
            className={cn('p-2 rounded-lg transition-colors', hoverClass)}
          >
            {isDark ? <Sun className='h-5 w-5' /> : <Moon className='h-5 w-5' />}
          </button>
        </header>

        {/* Chat Area */}
        <div className='flex-1 overflow-hidden flex flex-col'>
          {messages.length === 0 ? (
            // Empty State
            <div className='flex-1 flex flex-col items-center justify-center px-6'>
              <div className='text-center max-w-md'>
                <div className={cn('mb-4 opacity-20 flex justify-center')}>
                  <Search className='h-16 w-16' />
                </div>
                <h2 className='text-2xl font-bold mb-2'>Welcome to Knowledge Search</h2>
                <p className={cn('text-sm mb-8', isDark ? 'text-slate-400' : 'text-slate-600')}>
                  Upload documents and ask questions about them. The AI will search through your documents and provide
                  answers with citations.
                </p>

                <div className='mb-8'>
                  <p className={cn('text-xs font-semibold mb-3 uppercase', isDark ? 'text-slate-500' : 'text-slate-600')}>
                    Try asking:
                  </p>
                  <div className='space-y-2'>
                    {EXAMPLE_QUERIES.map((query, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setInput(query)
                        }}
                        className={cn(
                          'w-full text-left p-3 rounded-lg text-sm transition-colors border',
                          borderClass,
                          hoverClass
                        )}
                      >
                        {query}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <ScrollArea className='flex-1' ref={scrollAreaRef}>
              <div className='max-w-2xl mx-auto w-full px-6 py-8 space-y-6'>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn('flex', msg.type === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    {msg.type === 'user' ? (
                      // User Message
                      <div className='max-w-xs lg:max-w-md bg-indigo-600 text-white rounded-2xl px-4 py-2 text-sm'>
                        {msg.content}
                      </div>
                    ) : (
                      // Assistant Message
                      <div className='max-w-xl w-full'>
                        <Card className={cn(cardBgClass, 'border-0 shadow-sm')}>
                          <CardContent className='p-4'>
                            <p className='text-sm leading-relaxed mb-4'>{msg.content}</p>

                            {/* Citations */}
                            {msg.citations && msg.citations.length > 0 && (
                              <div className='flex flex-wrap gap-2 mb-4'>
                                {msg.citations.map((citation) => (
                                  <button
                                    key={citation.id}
                                    className='inline-flex items-center justify-center h-6 w-6 rounded-full bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors'
                                    title={`Source ${citation.id}`}
                                  >
                                    {citation.id}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Sources */}
                            {msg.sources && msg.sources.length > 0 && (
                              <SourcesSection sources={msg.sources} isDark={isDark} />
                            )}

                            {/* Actions */}
                            <div className='flex gap-2 mt-4 pt-4 border-t' style={{ borderColor: `hsl(var(--border))` }}>
                              <button
                                onClick={() => copyToClipboard(msg.content)}
                                className={cn(
                                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                                  hoverClass
                                )}
                              >
                                <Copy className='h-3.5 w-3.5' />
                                Copy
                              </button>
                              <button
                                className={cn(
                                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                                  hoverClass
                                )}
                              >
                                <Download className='h-3.5 w-3.5' />
                                Export
                              </button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className='flex justify-start'>
                    <Card className={cn(cardBgClass, 'border-0 shadow-sm')}>
                      <CardContent className='p-4'>
                        <div className='flex items-center gap-2'>
                          <Loader2 className='h-4 w-4 animate-spin text-indigo-500' />
                          <span className='text-sm text-slate-500'>Searching documents...</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Input Area */}
        <div className={cn('border-t px-6 py-6', borderClass)}>
          <div className='max-w-2xl mx-auto w-full'>
            <div className='flex gap-2'>
              <div className='flex-1 relative'>
                <Input
                  type='text'
                  placeholder='Ask anything about your documents...'
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  disabled={loading}
                  className={cn(
                    'pr-12 text-sm',
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500'
                      : 'bg-slate-100 border-slate-200 text-slate-900 placeholder:text-slate-500'
                  )}
                />
                <span className='absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500'>
                  {input.length}/500
                </span>
              </div>
              <Button
                onClick={handleSendMessage}
                disabled={loading || !input.trim()}
                className='bg-indigo-600 hover:bg-indigo-700 text-white px-6'
              >
                {loading ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <Send className='h-4 w-4' />
                )}
              </Button>
            </div>

            <p className='text-xs text-slate-500 mt-2'>
              Press Enter to send • Use Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Sources Section Component
function SourcesSection({
  sources,
  isDark,
}: {
  sources: Source[]
  isDark: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className='flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors mb-2'
      >
        {expanded ? <ChevronUp className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}
        View Sources ({sources.length})
      </button>

      {expanded && (
        <div className='space-y-2 mt-2 bg-slate-950/30 rounded-lg p-3'>
          {sources.map((source, idx) => (
            <div key={idx} className='text-xs space-y-1'>
              <div className='flex items-start justify-between gap-2'>
                <div className='flex-1'>
                  <p className='font-semibold text-indigo-400'>{source.documentName}</p>
                  <p className='text-slate-500'>Page {source.pageNumber}</p>
                </div>
                <Badge variant='outline' className='text-xs'>
                  {(source.relevance * 100).toFixed(0)}%
                </Badge>
              </div>
              <p className='text-slate-600 italic'>{source.excerpt}</p>
              {idx < sources.length - 1 && <Separator className='mt-2' />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
