'use client';

import { useState, useEffect } from 'react';
import { X, MessageCircle, ArrowLeft } from 'lucide-react';
import { fetchConversations } from '@/lib/chat';
import type { Conversation } from '@/lib/types';

export default function ChatInbox({
  myId,
  onOpenConversation,
  onClose,
}: {
  myId: string;
  onOpenConversation: (peerId: string, peerUsername: string) => void;
  onClose: () => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const convos = await fetchConversations(myId);
      if (!cancelled) setConversations(convos);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [myId]);

  const peerOf = (c: Conversation) =>
    c.participant_a === myId ? c.participant_b : c.participant_a;

  return (
    <div className="absolute inset-0 z-[2400] flex flex-col bg-midnight">
      {/* Header */}
      <header className="flex items-center gap-3 p-4 border-b border-gray-800">
        <button onClick={onClose} aria-label="Back" className="shrink-0">
          <ArrowLeft className="w-5 h-5 text-sage" strokeWidth={1.5} />
        </button>
        <span className="text-white font-black text-lg">Messages</span>
        <button onClick={onClose} aria-label="Close" className="ml-auto">
          <X className="w-5 h-5 text-sage" strokeWidth={1.5} />
        </button>
      </header>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {loading ? (
          <span className="text-sage text-sm text-center mt-8">Loading…</span>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-16 h-16 rounded-full bg-surface border border-gray-800 flex items-center justify-center">
              <MessageCircle className="w-7 h-7 text-sage" strokeWidth={1.5} />
            </div>
            <span className="text-white text-sm font-bold">No conversations yet</span>
            <span className="text-sage text-xs text-center max-w-[240px]">
              Message a seller from any gig or profile to start a chat.
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {conversations.map((c) => {
              const peerId = peerOf(c);
              const name = c.peer_username ?? peerId;
              return (
                <button
                  key={c.id}
                  onClick={() => onOpenConversation(peerId, name)}
                  className="w-full text-left bg-surface rounded-xl p-4 flex items-center gap-3 active:scale-95 transition-transform"
                >
                  <div className="w-11 h-11 rounded-full bg-ink border border-gray-800 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-5 h-5 text-pine" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                    <span className="text-white text-sm font-bold truncate">{name}</span>
                    <span className="text-sage text-xs truncate">
                      {c.last_message ?? 'No messages yet'}
                    </span>
                  </div>
                  {c.last_message_at && (
                    <span className="text-sage text-[10px] shrink-0">
                      {new Date(c.last_message_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
