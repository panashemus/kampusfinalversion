'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, ArrowLeft, ShieldAlert, User, Loader as Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getOrCreateConversation, fetchMessages, sendMessage } from '@/lib/chat';
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

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !conversationId) return;
    setSending(true);
    setInput('');

    // Optimistic update so it feels instant
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
    <div className="fixed inset-0 z-[3000] bg-midnight flex flex-col animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-surface shrink-0">
        <button onClick={onClose} aria-label="Go Back">
          <ArrowLeft className="w-6 h-6 text-sage hover:text-white transition-colors" strokeWidth={1.5} />
        </button>
        <button
          onClick={() => setShowProfileModal(true)}
          className="flex flex-col items-center group"
        >
          <span className="text-white font-bold text-base group-hover:text-pine transition-colors leading-tight">
            {peerUsername}
          </span>
          <span className="text-sage text-[10px] leading-tight mt-0.5">Tap to view profile</span>
        </button>
        <button onClick={onClose} aria-label="Close">
          <X className="w-6 h-6 text-sage hover:text-white transition-colors" strokeWidth={1.5} />
        </button>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Safety Warning Banner */}
        <div className="p-4 shrink-0">
          <div className="bg-orange-950/30 border border-orange-900/50 rounded-xl p-3 flex gap-3">
            <ShieldAlert className="w-5 h-5 text-orange-500 shrink-0" strokeWidth={2} />
            <p className="text-orange-200 text-[11px] leading-relaxed">
              <strong className="text-orange-400">Safety Warning:</strong> Keep your chats inside Kampus to protect your account and transactions. Kampus is not liable for deals moved off-platform. Never pay for items prior to inspection in a public campus location.
            </p>
          </div>
        </div>

        {/* Messages Content */}
        <div className="px-4 pb-4 flex flex-col gap-4 flex-1">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-sage" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-full bg-ink border border-gray-800 flex items-center justify-center">
                <User className="w-7 h-7 text-sage" strokeWidth={1.5} />
              </div>
              <span className="text-white font-bold text-lg">No messages yet</span>
              <span className="text-sage text-sm">Say hello to {peerUsername}</span>
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === myId;
              return (
                <div
                  key={m.id}
                  className={`flex flex-col max-w-[85%] ${mine ? 'self-end items-end' : 'self-start items-start'}`}
                >
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      mine
                        ? 'bg-pine text-black rounded-tr-sm font-medium'
                        : 'bg-surface border border-gray-800 text-white rounded-tl-sm'
                    }`}
                  >
                    {m.text}
                  </div>
                  <span className="text-sage text-[10px] mt-1 px-1">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
          {/* Empty div to auto-scroll into view */}
          <div ref={scrollRef} />
        </div>
      </div>

      {/* Sticky Input Area */}
      <div className="p-4 bg-surface border-t border-gray-800 pb-[max(16px,env(safe-area-inset-bottom))] flex items-center gap-2 shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
          placeholder="Type a message…"
          className="flex-1 bg-ink rounded-full h-12 px-4 border border-gray-800 text-white placeholder:text-sage text-sm outline-none focus:border-pine transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="w-12 h-12 rounded-full bg-pine flex items-center justify-center text-black disabled:opacity-50 active:scale-95 transition-transform shrink-0"
        >
          {sending ? (
            <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
          ) : (
            <Send className="w-5 h-5 -ml-0.5" strokeWidth={2} />
          )}
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
