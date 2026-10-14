'use client';

import { useState, useEffect } from 'react';
import {
  X,
  MessageCircle,
  Loader as Loader2,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/utils';
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
  const [peerMap, setPeerMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadConvos = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_a.eq.${myId},participant_b.eq.${myId}`)
        .order('last_message_at', { ascending: false });

      if (data && mounted) {
        const convos = data as Conversation[];

        const peerIds = Array.from(
          new Set(
            convos.map((c) =>
              c.participant_a === myId ? c.participant_b : c.participant_a
            )
          )
        );

        if (peerIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', peerIds);

          if (profiles) {
            const newPeerMap: Record<string, string> = {};
            profiles.forEach((p) => {
              newPeerMap[p.id] = p.username || 'Student';
            });
            setPeerMap(newPeerMap);
          }
        }

        setConversations(convos);
      }
      if (mounted) setLoading(false);
    };

    loadConvos();

    const channel = supabase
      .channel(`user-convos-${myId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => loadConvos()
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [myId]);

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-[420px] h-[80dvh] bg-[#0B0F0E] rounded-3xl ring-1 ring-white/[0.08] flex flex-col shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-[#121816] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center">
              <MessageCircle
                className="w-4 h-4 text-emerald-400"
                strokeWidth={1.75}
              />
            </div>
            <span className="text-white font-semibold text-base tracking-tight">
              Messages
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-zinc-900 ring-1 ring-white/[0.06] flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto flex flex-col no-scrollbar p-4 gap-2.5 bg-[#0B0F0E]">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2.5">
              <div className="w-14 h-14 rounded-2xl bg-zinc-900/60 ring-1 ring-white/[0.06] flex items-center justify-center">
                <MessageCircle
                  className="w-6 h-6 text-zinc-400"
                  strokeWidth={1.5}
                />
              </div>
              <span className="text-white font-semibold text-sm">
                No conversations yet
              </span>
              <span className="text-zinc-500 text-xs text-center max-w-[230px]">
                Message a seller on Hustle Hub or connect with peers on Campus
                Feed.
              </span>
            </div>
          ) : (
            conversations.map((c) => {
              const isUserA = c.participant_a === myId;
              const peerId = isUserA ? c.participant_b : c.participant_a;
              const displayUsername = peerMap[peerId] || 'Student';

              return (
                <button
                  key={c.id}
                  onClick={() => onOpenConversation(peerId, displayUsername)}
                  className="w-full flex items-center justify-between p-3.5 bg-zinc-900/60 hover:bg-zinc-900 ring-1 ring-white/[0.06] rounded-2xl active:scale-[0.99] transition-all text-left group"
                >
                  <div className="flex flex-col gap-0.5 overflow-hidden pr-4">
                    <span className="text-zinc-100 font-semibold text-xs truncate group-hover:text-emerald-400 transition-colors">
                      @{displayUsername}
                    </span>
                    <span
                      className={`text-xs truncate ${
                        !c.last_message
                          ? 'text-zinc-600 italic'
                          : 'text-zinc-400'
                      }`}
                    >
                      {c.last_message || 'No messages yet'}
                    </span>
                    {c.last_message_at && (
                      <span className="text-zinc-500 text-[10px] mt-0.5">
                        {timeAgo(c.last_message_at)}
                      </span>
                    )}
                  </div>
                  <ChevronRight
                    className="w-4 h-4 text-zinc-600 shrink-0 group-hover:text-emerald-400 transition-colors"
                    strokeWidth={1.75}
                  />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
