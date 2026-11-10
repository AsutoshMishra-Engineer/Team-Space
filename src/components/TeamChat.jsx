import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { dispatchPushNotification } from '../lib/pushService';
import { getSafeExternalUrl } from '../lib/urlUtils';

export default function TeamChat({ teamId, teamName, isLeader }) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const scrollRef = useRef(null);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*, profiles!chat_messages_profiles_fkey(user_id, username, avatar_url)')
        .eq('team_id', teamId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      scrollToBottom();
    } catch (err) {
      console.error('Error fetching chat messages:', err);
    }
  };

  useEffect(() => {
    if (!teamId) return;

    fetchMessages();

    // Setup Supabase Realtime Channel
    const channel = supabase
      .channel(`team-chat-${teamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `team_id=eq.${teamId}`
        },
        async (payload) => {
          // Fetch the profile for the new message
          let senderProfile = null;
          try {
            const { data } = await supabase
              .from('profiles')
              .select('user_id, username, avatar_url')
              .eq('id', payload.new.sender_id)
              .maybeSingle();
            senderProfile = data;
          } catch (e) {
            console.error('Error fetching sender profile:', e);
          }

          const completeMsg = {
            ...payload.new,
            profiles: senderProfile
          };

          setMessages((prev) => {
            // Avoid duplicate if already present
            if (prev.some((m) => m.id === completeMsg.id)) return prev;
            return [...prev, completeMsg];
          });
          scrollToBottom();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
          filter: `team_id=eq.${teamId}`
        },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 80);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content || sending) return;

    try {
      setSending(true);
      setNewMessage('');
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          team_id: teamId,
          sender_id: user.id,
          message: content
        });

      if (error) throw error;
      scrollToBottom();

      // Dispatch WhatsApp-style push notification to offline team members
      try {
        const senderName = profile?.username?.trim() || profile?.user_id || 'Teammate';
        const teamTag = teamName ? ` • ${teamName}` : '';
        dispatchPushNotification({
          teamId,
          title: `💬 ${senderName}${teamTag}`,
          message: content,
          url: window.location.origin + '/#/workspace',
          tag: 'team-chat'
        });
      } catch (e) {}
    } catch (err) {
      alert('Failed to send: ' + err.message);
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (msgId) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      // Optimistically remove from state immediately
      setMessages((prev) => prev.filter((m) => m.id !== msgId));

      // Try RPC first (bypasses RLS issues)
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('delete_chat_message', {
        p_message_id: msgId
      });

      if (!rpcErr && rpcRes && rpcRes.success === false) {
        throw new Error(rpcRes.error || 'Failed to delete');
      }

      if (rpcErr) {
        // Fallback to direct DELETE
        const { error: directErr } = await supabase
          .from('chat_messages')
          .delete()
          .eq('id', msgId);

        if (directErr) throw directErr;
      }
    } catch (err) {
      alert('Delete failed: ' + err.message);
      fetchMessages();
    }
  };

  const handleClearAllChat = async () => {
    const confirmation = window.confirm(
      'Are you sure you want to delete ALL messages in this team chat? This action cannot be undone.'
    );
    if (!confirmation) return;

    try {
      setClearing(true);
      const prevList = [...messages];
      setMessages([]);

      // Try RPC first
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('clear_team_chat', {
        p_team_id: teamId
      });

      if (!rpcErr && rpcRes && rpcRes.success === false) {
        throw new Error(rpcRes.error || 'Failed to clear');
      }

      if (rpcErr) {
        // Fallback to direct DELETE
        const { error: directErr } = await supabase
          .from('chat_messages')
          .delete()
          .eq('team_id', teamId);

        if (directErr) throw directErr;
      }
    } catch (err) {
      alert('Failed to clear chat: ' + err.message);
      fetchMessages();
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="workspace-section wa-chat-section">
      <div className="wa-chat-header">
        <div className="wa-header-info">
          <div className="wa-header-avatar">💬</div>
          <div>
            <div className="wa-header-title">Team Chat</div>
            <div className="wa-header-status">
              <span className="wa-status-dot"></span>
              {messages.length} message{messages.length === 1 ? '' : 's'} · Realtime
            </div>
          </div>
        </div>

        {/* Clear entire team chat box button */}
        {messages.length > 0 && (
          <button
            onClick={handleClearAllChat}
            disabled={clearing}
            className="wa-clear-chat-btn"
            title="Delete all messages in this team chat"
          >
            {clearing ? 'Clearing...' : '🗑️ Clear Chat'}
          </button>
        )}
      </div>

      <div className="wa-chat-messages" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="wa-empty-chat">
            <div className="wa-empty-icon">💬</div>
            <div className="wa-empty-title">No messages yet</div>
            <div className="wa-empty-subtitle">
              Send a message to start chatting with your team in real time!
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.sender_id === user.id;
            const senderName =
              msg.profiles?.username || msg.profiles?.user_id || 'User';
            const timeStr = new Date(msg.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div
                key={msg.id || index}
                className={`wa-msg-row ${isMe ? 'wa-msg-row-me' : 'wa-msg-row-them'}`}
              >
                {!isMe && (
                  <div className="wa-sender-avatar">
                    {getSafeExternalUrl(msg.profiles?.avatar_url) ? (
                      <img src={getSafeExternalUrl(msg.profiles.avatar_url)} alt={senderName} />
                    ) : (
                      <span>{senderName.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                )}

                <div className={`wa-bubble ${isMe ? 'wa-bubble-me' : 'wa-bubble-them'}`}>
                  {!isMe && <div className="wa-sender-name">{senderName}</div>}

                  <div className="wa-msg-text">{msg.message}</div>

                  <div className="wa-msg-footer">
                    <span className="wa-msg-time">{timeStr}</span>
                    {isMe && <span className="wa-checkmarks">✓✓</span>}
                    {(isMe || isLeader) && (
                      <button
                        onClick={() => handleDelete(msg.id)}
                        className="wa-delete-single-btn"
                        title="Delete message"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSend} className="wa-chat-input-bar">
        <input
          type="text"
          className="wa-input-field"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !newMessage.trim()}
          className="wa-send-btn"
          title="Send Message"
        >
          {sending ? (
            <span className="wa-send-spinner"></span>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
