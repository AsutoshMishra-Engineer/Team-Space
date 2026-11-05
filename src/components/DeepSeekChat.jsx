import React, { useState, useRef, useEffect } from 'react';

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY;

// Active models with fallback
const MODELS = [
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'qwen/qwen3.8-27b',
  'allam-2-7b',
];

const SUGGESTED_PROMPTS = [
  { icon: '💻', text: 'Write clean code for...' },
  { icon: '📝', text: 'Draft a team project summary' },
  { icon: '🐞', text: 'Help me debug this error...' },
  { icon: '⚡', text: 'Brainstorm creative features' },
];

async function callGroq(key, model, messages) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are TeamSpace AI, an elite intelligent engineering and collaboration assistant. Format your answers clearly with markdown formatting, bullet points, and code blocks with syntax highlighting whenever appropriate. Keep responses sharp, helpful, and professional.',
        },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.6,
      max_tokens: 1500,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
  return data.choices?.[0]?.message?.content || 'No response received.';
}

export default function AISidebar() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "👋 **Hello! I'm your TeamSpace Copilot.**\n\nI can write code, troubleshoot bugs, draft project documentation, and help your team execute tasks faster.\n\n*How can I assist your workflow today?*",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [messages, open]);

  const sendMessage = async (customPrompt) => {
    const text = (customPrompt || input).trim();
    if (!text || loading) return;

    setError('');
    const userMsg = {
      role: 'user',
      content: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    let reply = null;
    let lastError = '';

    for (const model of MODELS) {
      try {
        reply = await callGroq(GROQ_KEY, model, newMessages);
        break;
      } catch (err) {
        lastError = err.message;
        const isModelError =
          err.message.includes('decommissioned') ||
          err.message.includes('does not exist') ||
          err.message.includes('model_not_found');
        if (!isModelError) break;
      }
    }

    if (reply) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } else {
      setError('⚠️ ' + (lastError || 'Failed to connect with AI.'));
      setMessages(prev => prev.slice(0, -1));
      setInput(text);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: "🔄 **Conversation cleared.**\nWhat would you like to explore next?",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setError('');
  };

  // Render markdown-styled message paragraphs and code blocks
  const renderFormattedMessage = (content) => {
    const lines = content.split('\n');
    let inCodeBlock = false;
    let codeBuffer = [];
    const elements = [];

    lines.forEach((line, idx) => {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // Close block
          elements.push(
            <div key={`code-${idx}`} className="pro-ai-codeblock">
              <div className="pro-ai-code-header">
                <span>Code Output</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(codeBuffer.join('\n'))}
                  className="pro-ai-code-copy"
                >
                  📋 Copy
                </button>
              </div>
              <pre><code>{codeBuffer.join('\n')}</code></pre>
            </div>
          );
          codeBuffer = [];
          inCodeBlock = false;
        } else {
          // Open block
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
      } else {
        // Bold parsing (**text**)
        const parsed = line.split(/(\*\*.*?\*\*)/g).map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
          }
          return part;
        });

        elements.push(
          <div key={`line-${idx}`} className="pro-ai-msg-line">
            {parsed.length > 0 ? parsed : '\u00A0'}
          </div>
        );
      }
    });

    if (inCodeBlock && codeBuffer.length > 0) {
      elements.push(
        <div key="code-remaining" className="pro-ai-codeblock">
          <pre><code>{codeBuffer.join('\n')}</code></pre>
        </div>
      );
    }

    return elements;
  };

  return (
    <>
      {open && <div className="pro-ai-backdrop" onClick={() => setOpen(false)} />}

      {/* Modern Slide-out AI Drawer */}
      <div className={`pro-ai-drawer ${open ? 'pro-ai-drawer-open' : ''}`}>
        {/* Header */}
        <div className="pro-ai-header">
          <div className="pro-ai-brand">
            <div className="pro-ai-avatar-glow">⚡</div>
            <div>
              <div className="pro-ai-name-row">
                <span className="pro-ai-name">TeamSpace Copilot</span>
                <span className="pro-ai-version-pill">GPT-OSS</span>
              </div>
              <div className="pro-ai-status">
                <span className="pro-ai-pulse-dot" />
                <span>Ready · Realtime Intelligence</span>
              </div>
            </div>
          </div>

          <div className="pro-ai-header-actions">
            <button
              onClick={clearChat}
              className="pro-ai-h-btn"
              title="Reset conversation"
            >
              🔄
            </button>
            <button
              onClick={() => setOpen(false)}
              className="pro-ai-h-btn"
              title="Collapse Assistant"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="pro-ai-messages-scroll">
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={i}
                className={`pro-ai-msg-group ${isUser ? 'pro-ai-user-group' : 'pro-ai-bot-group'}`}
              >
                <div className="pro-ai-sender-info">
                  <div className={`pro-ai-badge-avatar ${isUser ? 'pro-avatar-user' : 'pro-avatar-bot'}`}>
                    {isUser ? '👤' : '⚡'}
                  </div>
                  <span className="pro-ai-sender-name">
                    {isUser ? 'You' : 'Copilot AI'}
                  </span>
                  <span className="pro-ai-timestamp">{msg.time}</span>
                  {!isUser && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(msg.content, i)}
                      className="pro-ai-msg-copy-btn"
                      title="Copy response"
                    >
                      {copiedIndex === i ? '✓ Copied' : '📋'}
                    </button>
                  )}
                </div>

                <div className={`pro-ai-bubble ${isUser ? 'pro-ai-bubble-user' : 'pro-ai-bubble-bot'}`}>
                  {renderFormattedMessage(msg.content)}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="pro-ai-msg-group pro-ai-bot-group">
              <div className="pro-ai-sender-info">
                <div className="pro-ai-badge-avatar pro-avatar-bot">⚡</div>
                <span className="pro-ai-sender-name">Copilot AI</span>
                <span className="pro-ai-thinking-tag">Thinking...</span>
              </div>
              <div className="pro-ai-bubble pro-ai-bubble-bot">
                <div className="pro-ai-wave-dots">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}

          {error && <div className="pro-ai-error-banner">{error}</div>}
          <div ref={bottomRef} />
        </div>

        {/* Starter Prompt Chips (only if conversation is short) */}
        {messages.length <= 2 && !loading && (
          <div className="pro-ai-chips-bar">
            {SUGGESTED_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => sendMessage(p.text)}
                className="pro-ai-chip"
              >
                <span>{p.icon}</span> {p.text}
              </button>
            ))}
          </div>
        )}

        {/* Professional Input Console */}
        <div className="pro-ai-input-console">
          <div className="pro-ai-input-wrapper">
            <textarea
              ref={inputRef}
              className="pro-ai-textarea"
              placeholder="Ask TeamSpace Copilot... (Enter to send, Shift+Enter for newline)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              disabled={loading}
            />
            <div className="pro-ai-input-footer">
              <span className="pro-ai-model-tag">Groq · Instant Engine</span>
              <button
                type="button"
                className="pro-ai-send-action-btn"
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                title="Send message"
              >
                {loading ? (
                  <span className="wa-send-spinner" style={{ width: '14px', height: '14px' }}></span>
                ) : (
                  <>
                    <span>Send</span>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Side Edge Trigger Tab */}
      <button
        className={`pro-ai-floating-tab ${open ? 'pro-tab-pushed' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Open TeamSpace Copilot AI"
      >
        <span className="pro-tab-sparkle">⚡</span>
        <span className="pro-tab-text">COPILOT AI</span>
      </button>
    </>
  );
}
