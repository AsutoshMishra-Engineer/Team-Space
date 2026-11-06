import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { callGroqWorkEngine, checkWorkRelevance } from '../lib/groqService';

export default function AIStudioPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `### ⚡ Groq Work Studio — Enterprise Intelligence Core\nWelcome to TeamSpace's dedicated technical workspace, built for high-pressure engineering and disciplined workplace productivity.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeModel, setActiveModel] = useState('GPT-OSS 120B');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [error, setError] = useState('');
  const messagesStreamRef = useRef(null);
  const textareaRef = useRef(null);

  // Smooth scroll ONLY inside the message stream, and NEVER on initial mount
  useEffect(() => {
    if (messages.length > 1 && messagesStreamRef.current) {
      messagesStreamRef.current.scrollTo({
        top: messagesStreamRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, loading]);

  const handleSend = async (customText = null) => {
    const text = (customText || input).trim();
    if (!text || loading) return;

    setError('');

    // Fast Zero-Token Work Guardrail
    const check = checkWorkRelevance(text);
    if (!check.isWork) {
      setMessages(prev => [
        ...prev,
        {
          role: 'user',
          content: text,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        {
          role: 'assistant',
          content: `🛡️ **Work-Only Protocol Enforced:**\n\nTeam-Space AI Studio is strictly configured for **engineering, code development, database architecture, and agile team management**.\n\nPersonal, entertainment, or casual discussions are restricted. **Please return to your task and focus on work deliverables.**`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setInput('');
      return;
    }

    const userMsg = {
      role: 'user',
      content: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await callGroqWorkEngine(newMessages, 0.2);
      setActiveModel(response.model);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: response.content,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err) {
      setError(`⚠️ Groq Gateway Error: ${err.message}`);
      setMessages(prev => prev.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyMessage = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: `### ⚡ Groq Work Studio — Enterprise Intelligence Core\nWelcome to TeamSpace's dedicated technical workspace, built for high-pressure engineering and disciplined workplace productivity.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const exportMarkdown = () => {
    const transcript = messages
      .map(m => `### ${m.role === 'user' ? '👤 Engineer' : '⚡ Groq AI Work Engine'} (${m.time})\n\n${m.content}\n\n---`)
      .join('\n\n');
    const blob = new Blob([transcript], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GroqAI_WorkStudio_${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Structured Markdown renderer
  const renderFormattedMessage = (content) => {
    const lines = content.split('\n');
    const elements = [];
    let inCodeBlock = false;
    let codeLanguage = '';
    let codeBuffer = [];
    let inTable = false;
    let tableBuffer = [];

    const flushTable = (idx) => {
      if (tableBuffer.length === 0) return;
      const headerRow = tableBuffer[0];
      const dataRows = tableBuffer.slice(2);

      elements.push(
        <div key={`table-wrapper-${idx}`} className="pro-ai-table-container">
          <table className="pro-ai-table">
            <thead>
              <tr>
                {headerRow.map((cell, cIdx) => (
                  <th key={cIdx}>{cell.trim()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx}>{cell.trim()}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableBuffer = [];
      inTable = false;
    };

    lines.forEach((line, idx) => {
      if (line.trim().startsWith('```')) {
        if (inTable) flushTable(idx);

        if (inCodeBlock) {
          elements.push(
            <div key={`code-${idx}`} className="pro-ai-codeblock">
              <div className="pro-ai-code-header">
                <span className="pro-code-lang">{codeLanguage || 'CODE'}</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(codeBuffer.join('\n'))}
                  className="pro-ai-code-copy"
                >
                  📋 Copy Code Snippet
                </button>
              </div>
              <pre><code>{codeBuffer.join('\n')}</code></pre>
            </div>
          );
          codeBuffer = [];
          codeLanguage = '';
          inCodeBlock = false;
        } else {
          codeLanguage = line.trim().slice(3).trim();
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        return;
      }

      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        const cells = line.split('|').slice(1, -1);
        tableBuffer.push(cells);
        inTable = true;
        return;
      } else if (inTable) {
        flushTable(idx);
      }

      if (line.startsWith('### ')) {
        elements.push(<h4 key={`h3-${idx}`} className="pro-ai-h3">{line.replace('### ', '')}</h4>);
        return;
      }
      if (line.startsWith('## ')) {
        elements.push(<h3 key={`h2-${idx}`} className="pro-ai-h2">{line.replace('## ', '')}</h3>);
        return;
      }
      if (line.startsWith('> ')) {
        elements.push(<blockquote key={`quote-${idx}`} className="pro-ai-quote">{line.replace('> ', '')}</blockquote>);
        return;
      }

      const parsedParts = line.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, pIdx) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={pIdx} className="pro-ai-inline-code">{part.slice(1, -1)}</code>;
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
      const isNumbered = /^\d+\.\s/.test(line.trim());

      elements.push(
        <div key={`line-${idx}`} className={`pro-ai-msg-line ${isBullet ? 'pro-bullet' : ''} ${isNumbered ? 'pro-num' : ''}`}>
          {parsedParts.length > 0 ? parsedParts : '\u00A0'}
        </div>
      );
    });

    if (inTable) flushTable(lines.length);
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
    <div className="ai-studio-page-container">
      {/* Top Breadcrumb & Action Header */}
      <div className="ai-studio-header">
        <div className="ai-studio-title-area">
          <Link to="/workspace" className="back-link" style={{ marginBottom: 2 }}>
            ← Back to Dashboard
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.4rem' }}>⚡</span>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.3rem', color: '#fff', lineHeight: 1.2 }}>Groq AI Work Studio</h1>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#8888aa' }}>
                Dedicated enterprise workspace for software architecture, code optimization, database schemas, and sprint execution.
              </p>
            </div>
          </div>
        </div>

        <div className="ai-studio-header-actions">
          <span className="ai-studio-status-pill">
            <span className="pulse-dot-green" /> Groq LPU Engine · {activeModel}
          </span>
          <button onClick={exportMarkdown} className="btn btn-secondary btn-sm" title="Export Markdown Transcript">
            📥 Export .md
          </button>
          <button onClick={clearChat} className="btn btn-secondary btn-sm" title="Clear Conversation">
            🔄 Clear Session
          </button>
        </div>
      </div>

      {/* Main Studio Full-Width Chat Box — Single Page, Internal Scroll Only */}
      <div className="ai-studio-full-container">
        <div className="ai-studio-chat-panel">
          <div className="ai-studio-messages-stream" ref={messagesStreamRef}>
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              return (
                <div key={i} className={`ai-studio-msg-row ${isUser ? 'user' : 'bot'}`}>
                  <div className="ai-studio-avatar">
                    {isUser ? '👤' : '⚡'}
                  </div>
                  <div className="ai-studio-msg-body">
                    <div className="ai-studio-msg-head">
                      <strong>{isUser ? 'Engineer' : 'Groq AI Work Engine'}</strong>
                      <span className="ai-studio-msg-time">{msg.time}</span>
                      {!isUser && (
                        <button
                          type="button"
                          onClick={() => copyMessage(msg.content, i)}
                          className="ai-studio-copy-btn"
                          title="Copy Output"
                        >
                          {copiedIndex === i ? '✓ Copied' : '📋 Copy'}
                        </button>
                      )}
                    </div>
                    <div className="ai-studio-msg-content">
                      {renderFormattedMessage(msg.content)}
                    </div>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="ai-studio-msg-row bot">
                <div className="ai-studio-avatar">⚡</div>
                <div className="ai-studio-msg-body">
                  <div className="ai-studio-msg-head">
                    <strong>Groq AI Work Engine</strong>
                    <span style={{ color: 'var(--accent)', fontSize: '0.78rem' }}>Processing through Groq LPU...</span>
                  </div>
                  <div className="pro-ai-wave-dots" style={{ marginTop: 8 }}>
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="pro-ai-error-banner" style={{ margin: '12px 0' }}>
                {error}
              </div>
            )}
          </div>

          {/* Console Input Bar — Pinned at bottom like ChatGPT / Gemini */}
          <div className="ai-studio-input-bar">
            <textarea
              ref={textareaRef}
              className="ai-studio-textarea"
              placeholder="State your engineering order or technical inquiry... (Enter to send, Shift+Enter for newline)"
              rows={2}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <div className="ai-studio-input-actions">
              <span className="ai-studio-tip">
                🔒 Strict Work-Only Guardrail Active · Zero-Token Client Filter
              </span>
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="btn btn-primary"
                style={{ padding: '8px 20px', fontWeight: 700 }}
              >
                {loading ? 'Processing...' : '⚡ Execute Order'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
