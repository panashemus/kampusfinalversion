'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Send,
  ArrowLeft,
  ShieldCheck,
  User,
  Loader as Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  getOrCreateConversation,
  fetchMessages,
  sendMessage,
} from '@/lib/chat';
import type { Message } from '@/lib/types';
import PublicProfileModal from '@/components/PublicProfileModal';

export default function ChatRoom({
  myId, listingId,
  peerId,
  peerUsername,
  onClose,
}: {
  myId: string;
  listingId?: string;
  peerId: string;
  peerUsername: string;
  onClose: () => void;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending,setSending]=useState(false);
  const [error,setError]=useState('');const [retry,setRetry]=useState(0);const [hasEarlier,setHasEarlier]=useState(false);
  const [sources,setSources]=useState<{id:string;title:string;available:boolean}[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);setError('');setConversationId(null);setMessages([]);
      try {
      const convo = await getOrCreateConversation(myId, peerId, peerUsername,listingId);
      if (cancelled || !convo) {
        setLoading(false);
        return;
      }
      setConversationId(convo.id);
      const msgs = await fetchMessages(convo.id);
      if (!cancelled){setMessages(msgs);setHasEarlier(msgs.length===50);}
      const {data:refs}=await supabase.from('conversation_sources').select('listing_id').eq('conversation_id',convo.id).limit(20);
      const ids=(refs||[]).map(r=>r.listing_id);
      const {data:listings}=await supabase.from('listing_preview').select('id,title').in('id',ids).eq('status','active');
      if(!cancelled)setSources(ids.map(id=>({id,title:listings?.find(l=>l.id===id)?.title||'Listing no longer available',available:!!listings?.find(l=>l.id===id)})));
      }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Conversation unavailable.');}
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [myId, peerId, peerUsername,listingId,retry]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages(prev=>prev.some(m=>m.id===payload.new.id)?prev:[...prev,payload.new as Message]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !conversationId || sending || text.length>4000) return;
    setError('');
    setSending(true);
    setInput('');

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
      setMessages((prev) =>
        [...prev.filter(m=>m.id!==optimistic.id&&m.id!==msg.id),msg]
      );
    }else{setMessages(prev=>prev.filter(m=>m.id!==optimistic.id));setInput(text);setError("Message was not sent. Check your connection or message permissions and try again.");}
    setSending(false);
  }, [input, conversationId, myId,sending]);

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-[420px] h-[80dvh] bg-[#0B0F0E] rounded-3xl ring-1 ring-white/[0.08] flex flex-col shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06] bg-[#121816] shrink-0">
          <button
            onClick={onClose}
            aria-label="Go Back"
            className="p-1.5 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={1.75} />
          </button>
          <button
            onClick={() => setShowProfileModal(true)}
            className="flex flex-col items-center group"
          >
            <span className="text-white font-semibold text-sm group-hover:text-emerald-400 transition-colors leading-tight">
              {peerUsername}
            </span>
            <span className="text-zinc-500 text-[10px] leading-tight mt-0.5">
              Tap to view student profile
            </span>
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        {sources.length>0&&<div className="px-4 py-3 border-b border-gray-800 text-xs text-sage">Listing context{sources.map(source=><div key={source.id}>{source.available?<a className="text-pine block py-2" href={"#hustle?listing="+source.id} onClick={onClose}>{source.title}</a>:<span>{source.title}</span>}</div>)}</div>}
        {error&&<div role="alert" className="px-4 py-3 text-sm text-red-300">{error}{!conversationId&&<button className="foundation-action mt-2" onClick={()=>setRetry(v=>v+1)}>Try again</button>}</div>}
        {hasEarlier&&<button className="foundation-action" onClick={async()=>{if(!conversationId||!messages[0])return;try{const earlier=await fetchMessages(conversationId,messages[0].created_at);setMessages(prev=>[...earlier,...prev]);setHasEarlier(earlier.length===50);}catch{setError('Earlier messages could not be loaded.');}}}>Load earlier messages</button>}
        {/* Chat Stream */}
        <div className="flex-1 overflow-y-auto flex flex-col no-scrollbar bg-[#0B0F0E]">
          <div className="p-3.5 shrink-0">
            <div className="bg-emerald-950/30 border border-emerald-800/30 rounded-2xl p-3 flex gap-2.5">
              <ShieldCheck
                className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5"
                strokeWidth={1.75}
              />
              <p className="text-zinc-300 text-[11px] leading-relaxed">
                <strong className="text-emerald-300 font-semibold">
                  Protected In-App Chat:
                </strong>{' '}
                Kampus is not processing payments or escrow transfers. Inspect items in a public campus spot, agree terms directly, and never treat chat messages as payment confirmation.
              </p>
            </div>
          </div>

          <div className="px-4 pb-4 flex flex-col gap-3 flex-1">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2.5">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 ring-1 ring-white/[0.06] flex items-center justify-center">
                  <User className="w-5 h-5 text-zinc-400" strokeWidth={1.5} />
                </div>
                <span className="text-zinc-200 font-semibold text-xs">
                  Start the conversation
                </span>
                <span className="text-zinc-500 text-[11px]">
                  Say hello to {peerUsername}
                </span>
              </div>
            ) : (
              messages.map((m) => {
                const mine = m.sender_id === myId;
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col max-w-[82%] ${
                      mine ? 'self-end items-end' : 'self-start items-start'
                    }`}
                  >
                    <div
                      className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                        mine
                          ? 'bg-amber-400 text-zinc-950 rounded-tr-sm font-medium'
                          : 'bg-zinc-900/90 ring-1 ring-white/[0.06] text-zinc-100 rounded-tl-sm'
                      }`}
                    >
                      {m.text}
                    </div>
                    <span className="text-zinc-500 text-[10px] mt-1 px-1">
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={scrollRef} />
          </div>
        </div>

        {/* Sticky Input Bar */}
        <div className="p-3 bg-[#121816] border-t border-white/[0.06] flex items-center gap-2 shrink-0">
          <input
            aria-label="Message"
            maxLength={4000}
            disabled={!conversationId}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            placeholder="Write a message…"
            className="flex-1 bg-zinc-950/90 rounded-full h-10 px-4 ring-1 ring-white/[0.07] text-white placeholder:text-zinc-500 text-xs outline-none focus:ring-emerald-700/50 transition-all"
          />
          <button
            onClick={handleSend}
            aria-label="Send message"
            disabled={!input.trim() || sending || !conversationId}
            className="w-10 h-10 rounded-full bg-amber-400 hover:bg-amber-300 flex items-center justify-center text-zinc-950 disabled:opacity-40 active:scale-[0.96] transition-all shrink-0"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
            ) : (
              <Send className="w-4 h-4 -ml-0.5" strokeWidth={2} />
            )}
          </button>
        </div>
      </div>

      {showProfileModal && (
        <PublicProfileModal
          userId={peerId}
          username={peerUsername}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  );
}
