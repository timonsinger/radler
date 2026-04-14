'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { getSocket } from '@/lib/socket';

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface Props {
  rideId: string;
  userId: string;
  otherName: string;
  isOpen: boolean;
  onClose: () => void;
  onUnreadChange?: (count: number) => void;
}

export default function ChatModal({ rideId, userId, otherName, isOpen, onClose, onUnreadChange }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);

  const loadMessages = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/rides/${rideId}/messages`);
      if (data.messages) setMessages(data.messages);
    } catch {
      // ignore
    }
  }, [rideId]);

  useEffect(() => {
    if (!isOpen) return;
    loadMessages();
    apiFetch(`/api/rides/${rideId}/messages/read`, { method: 'PATCH' }).catch(() => {});
    onUnreadChange?.(0);
  }, [isOpen, rideId, loadMessages, onUnreadChange]);

  useEffect(() => {
    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket();

      const handleMessage = (data: { rideId: string; message: Message }) => {
        if (data.rideId !== rideId) return;
        setMessages((prev) => [...prev, data.message]);

        if (isOpen && data.message.sender_id !== userId) {
          apiFetch(`/api/rides/${rideId}/messages/read`, { method: 'PATCH' }).catch(() => {});
        } else if (!isOpen && data.message.sender_id !== userId) {
          // Parent handles unread count via its own socket listener
        }
      };

      const handleTyping = (data: { rideId: string; userId: string; isTyping: boolean }) => {
        if (data.rideId !== rideId || data.userId === userId) return;
        setOtherTyping(data.isTyping);
        if (data.isTyping) setTimeout(() => setOtherTyping(false), 3000);
      };

      socket.on('chat:message', handleMessage);
      socket.on('chat:typing', handleTyping);

      return () => {
        socket.off('chat:message', handleMessage);
        socket.off('chat:typing', handleTyping);
      };
    } catch {
      // ignore
    }
  }, [rideId, userId, isOpen, onUnreadChange]);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  function handleInputChange(value: string) {
    setInput(value.substring(0, 1000));
    const now = Date.now();
    if (now - lastTypingSentRef.current > 500) {
      try { getSocket().emit('chat:typing', { rideId, isTyping: true }); lastTypingSentRef.current = now; } catch {}
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      try { getSocket().emit('chat:typing', { rideId, isTyping: false }); } catch {}
    }, 1500);
  }

  async function handleSend() {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const data = await apiFetch(`/api/rides/${rideId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: input.trim() }),
      });
      if (data.message) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === data.message.id);
          return exists ? prev : [...prev, data.message];
        });
      }
      setInput('');
      try { getSocket().emit('chat:typing', { rideId, isTyping: false }); } catch {}
    } catch (err) {
      console.error('Nachricht senden fehlgeschlagen:', err);
    } finally {
      setSending(false);
    }
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-3xl shadow-2xl flex flex-col" style={{ height: '70vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">{otherName.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Chat mit {otherName}</p>
              {otherTyping && <p className="text-xs text-primary animate-pulse">schreibt...</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {messages.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">Noch keine Nachrichten.</p>
          )}
          {messages.map((msg) => {
            const isMine = msg.sender_id === userId;
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                  isMine ? 'bg-primary text-white rounded-br-md' : 'bg-gray-100 text-gray-900 rounded-bl-md'
                }`}>
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-white/60' : 'text-gray-400'}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 pb-6 pt-2 border-t border-gray-100 bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={`Nachricht an ${otherName}...`}
              maxLength={1000}
              className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center disabled:opacity-40 active:bg-primary/80 flex-shrink-0"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
