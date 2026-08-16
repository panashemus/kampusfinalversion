'use client';

import { useState, useEffect } from 'react';
import { X, MessageCircle, Loader as Loader2, ChevronRight } from 'lucide-react';
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
  const [peerMap, setPeerMap] = useState<Record<string, string>>({}); // NEW: Dynamic username lookup
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
        
        // 1. Find the user IDs of everyone we are talking to
        const peerIds = [...new Set(convos.map(c => 
          c.participant_a === myId ? c.participant_b : c.participant_a
        ))];

        // 2. Fetch their actual, current usernames from the profiles table
        if (peerIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', peerIds);

          if (profiles) {
            const newPeerMap: Record<string, string> = {};
            profiles.forEach(p => {
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
    // The centered backdrop overlay
    <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* The strictly sized floating window */}
      <div className="relative w-full max-w-[420px] h-[80dvh] bg-midnight rounded-3xl border border-gray-800 flex flex-col shadow-2xl overflow-hidden animate-slide-up">
        
        {/* Header - shrink-0 protects it from flex squishing */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-surface shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-pine/20 border border-pine/50 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-pine" strokeWidth={1.5} />
            </div>
            <span className="text-white font-black text-xl tracking-tight">MESSAGES</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="active:scale-90 transition-transform">
            <X className="w-6 h-6 text-sage hover:text-white transition-colors" strokeWidth={1.5} />
          </button>
        </div>

        {/* Main List Area - flex-1 allows scrolling */}
        <div className="flex-1 overflow-y-auto flex flex-col no-scrollbar p-4 gap-3 bg-[#0B1611]">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-sage" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-full bg-ink border border-gray-800 flex items-center justify-center">
                <MessageCircle className="w-7 h-7 text-sage" strokeWidth={1.5} />
              </div>
              <span className="text-white font-bold text-lg">Inbox Zero</span>
              <span className="text-sage text-sm text-center max-w-[240px]">
                You have no active conversations. Find a hustle or peer to message!
              </span>
            </div>
          ) : (
            conversations.map((c) => {
              // 3. Dynamically assign the correct peer details
              const isUserA = c.participant_a === myId;
              const peerId = isUserA ? c.participant_b : c.participant_a;
              
              // Ignore the database peer_username completely. Look it up dynamically.
              const displayUsername = peerMap[peerId] || 'Student';

              return (
                <button
                  key={c.id}
                  onClick={() => onOpenConversation(peerId, displayUsername)}
                  className="w-full flex items-center justify-between p-4 bg-surface border border-gray-800 rounded-2xl active:scale-[0.98] transition-transform text-left group"
                >
                  <div className="flex flex-col gap-1 overflow-hidden pr-4">
                    <span className="text-white font-bold text-base truncate group-hover:text-pine transition-colors">
                      @{displayUsername}
                    </span>
                    <span className={`text-sm truncate ${!c.last_message ? 'text-gray-600 italic' : 'text-sage'}`}>
                      {c.last_message || 'No messages yet'}
                    </span>
                    {c.last_message_at && (
                      <span className="text-gray-500 text-[10px] font-medium mt-1 uppercase tracking-wider">
                        {timeAgo(c.last_message_at)}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-700 shrink-0 group-hover:text-pine transition-colors" strokeWidth={2} />
                </button>
              );
            })
          )}
        </div>
        
      </div>
    </div>
  );
}
