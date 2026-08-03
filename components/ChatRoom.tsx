'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, ArrowLeft, ShieldAlert, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  getOrCreateConversation,
  fetchMessages,
  sendMessage,
} from '@/lib/chat';
import type { Message } from '@/lib/types';
import PublicProfileModal from '@/components/PublicProfileModal';

export default function ChatRoom({
  myId,
  peerId,
  peerUsername,
  onClose,
}: {
  myId: string;
  peerId: string;
  peerUsername: string;
  onClose: () => void;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const convo = await getOrCreateConversation(myId, peerId, peerUsername);
      if (cancelled || !convo) {
        setLoading(false);
        return;
      }
      setConversationId(convo.id);
      const msgs = await fetchMessages(convo.id);
      if (!cancelled) setMessages(msgs);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [myId, peerId, peerUsername]);

  // Real-time subscription for new messages.
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !conversationId) return;
    setSending(true);
    setInput('');
    // Optimistic: show immediately.
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: myId,
      text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    const msg = await sendMessage(conversationId, myId, text);
    if (msg) {
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? msg : m)));
    }
    setSending(false);
  }, [input, conversationId, myId]);

  return (
    <div className="absolute inset-0 z-[2500] flex flex-col bg-midnight">
      {/* Header */}
      <header className="flex items-center gap-3 p-4 border-b border-gray-800 bg-midnight shrink-0">
        <button onClick={onClose} aria-label="Back" className="shrink-0">
          <ArrowLeft className="w-5 h-5 text-sage" strokeWidth={1.5} />
        </button>
        
        {/* Interactive Profile Button */}
        <button 
          onClick={() => setShowProfileModal(true)}
          className="flex items-center gap-2.5 text-left group"
        >
          <div className="w-9 h-9 rounded-full bg-surface border border-gray-800 flex items-center justify-center shrink-0 group-active:scale-95 transition-transform">
            <User className="w-4 h-4 text-pine" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold text-sm leading-tight">{peerUsername}</span>
            <span className="text-sage text-[10px]">Tap to view profile</span>
          </div>
        </button>

        <button onClick={onClose} aria-label="Close" className="ml-auto shrink-0">
          <X className="w-5 h-5 text-sage" strokeWidth={1.5} />
        </button>
      </header>

      {/* Safety Warning Banner */}
      <div className="flex items-start gap-2 bg-yellow-950/40 border-b border-yellow-700/40 px-4 py-2.5 shrink-0">
        <ShieldAlert className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" strokeWidth={2} />
        <p className="text-yellow-200/90 text-[10px] leading-snug">
          <span className="font-bold">Safety Warning:</span> Keep your chats inside Kampus to protect your account and transactions. Kampus is not liable for deals moved off-platform. Never pay for items prior to inspection in a public campus location.
        </p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {loading ? (
          <span className="text-sage text-sm text-center mt-8">Loading chat…</span>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <div className="w-12 h-12 rounded-full bg-surface border border-gray-800 flex items-center justify-center mb-2">
              <User className="w-5 h-5 text-pine" strokeWidth={1.5} />
            </div>
            <span className="text-white text-sm font-bold">No messages yet</span>
            <span className="text-sage text-xs">Say hello to {peerUsername}</span>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === myId;
            return (
              <div
                key={m.id}
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-snug ${
                  mine
                    ? 'self-end bg-pine text-black font-medium'
                    : 'self-start bg-surface text-white border border-gray-800'
                }`}
              >
                {m.text}
                <span className={`block text-[9px] mt-1 ${mine ? 'text-black/50' : 'text-sage/60'}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-800 flex items-center gap-2 pb-[max(24px,env(safe-area-inset-bottom))] shrink-0 bg-midnight">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder="Type a message…"
          className="flex-1 bg-surface rounded-full h-11 px-4 border border-gray-800 text-white placeholder:text-sage text-sm outline-none focus:border-pine transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          aria-label="Send"
          className="w-11 h-11 rounded-full bg-pine flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40 shrink-0"
        >
          <Send className="w-5 h-5 text-black" strokeWidth={2} />
        </button>
      </div>

      {/* Render Public Profile Modal if triggered */}
      {showProfileModal && (
        <PublicProfileModal
          username={peerUsername}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  );
}
