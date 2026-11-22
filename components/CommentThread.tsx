'use client';

import { useState,useMemo } from 'react';
import { Send, Trash2, User } from 'lucide-react';
import SecureImage from '@/components/SecureImage';
import type { Comment } from '@/lib/types';
import {moderateText,type ModerationResult} from '@/lib/moderation';
import {CirklesSubmissionError} from '@/lib/cirkles-client';
import CirklesModerationNotice from './CirklesModerationNotice';

export default function CommentThread({
  comments,
  onAdd,
  onDelete,
  currentUserId,
  isAnonymousPost = false,
  myName = 'student',
  onAuthorClick,
  moderationEnabled = false,
  placeholder = isAnonymousPost ? 'Reply anonymously...' : 'Reply to this post...',
}: {
  comments: Comment[];
  onAdd: (c: Comment) => Promise<boolean | void> | boolean | void;
  onDelete?: (id: string) => void;
  currentUserId?: string;
  isAnonymousPost?: boolean;
  myName?: string;
  onAuthorClick?: (username: string, authorId?: string) => void;
  moderationEnabled?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice,setNotice]=useState('');
  const [serverModeration,setServerModeration]=useState<ModerationResult|null>(null);
  const localModeration=useMemo(()=>moderationEnabled?moderateText(text):{allowed:true,matches:[],suggestion:''},[text,moderationEnabled]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const draft = text.trim();
    if (!draft || submitting || !localModeration.allowed) return;
    setNotice('');setServerModeration(null);
    setSubmitting(true);
    try {
      const saved = await onAdd({
        id: `temp-${Date.now()}`,
        author: isAnonymousPost ? 'Anonymous' : myName,
        text: draft,
        time: 'just now',
        is_anonymous: isAnonymousPost,
      });
      // Only clear after the parent confirms success. If the network or
      // database rejects the reply, the student's typed draft survives.
      if(saved !== false) setText(current => current.trim() === draft ? '' : current);
    } catch(error) {
      // Leave the draft intact, allowing the student to retry.
      setNotice(error instanceof Error?error.message:'Reply not saved. Your draft is still here.');
      if(error instanceof CirklesSubmissionError&&error.matches.length)setServerModeration({allowed:false,matches:error.matches,suggestion:error.message});
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {comments.length > 0 && (
        <div className="flex flex-col gap-3 max-h-48 overflow-y-auto no-scrollbar">
          {comments.map((c) => {
            const commentIsAnon = isAnonymousPost || c.is_anonymous;
            return (
              <div key={c.id} className="flex items-start justify-between gap-2 group">
                <div className="flex items-start gap-2">
                  {commentIsAnon ? (
                    <div className="w-6 h-6 rounded-full bg-ink border border-gray-800 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3 h-3 text-sage" strokeWidth={1.75} aria-hidden="true" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 overflow-hidden rounded-full bg-ink border border-gray-800 flex items-center justify-center shrink-0 mt-0.5">
                      {c.avatarUrl ? <SecureImage src={c.avatarUrl} alt={c.author+"'s profile picture"} className="h-full w-full rounded-full object-cover" /> : <User className="w-3 h-3 text-sage" strokeWidth={2} />}
                    </div>
                  )}
                  
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-2">
                      {commentIsAnon ? (
                        <span className="text-sage text-xs font-bold">Anonymous</span>
                      ) : (
                        <button 
                          onClick={() => { if(c.authorId)onAuthorClick?.(c.author, c.authorId); }}
                          className="text-white text-xs font-bold hover:text-pine transition-colors"
                        >
                          {c.author}
                        </button>
                      )}
                      <span className="text-sage text-[10px]">{c.time}</span>
                    </div>
                    <p className="text-gray-300 text-xs leading-relaxed">{c.text}</p>
                  </div>
                </div>
                
                {currentUserId && (c.authorId === currentUserId || c.isOwner) && onDelete && (
                  <button 
                    onClick={() => onDelete(c.id)} 
                    className="p-2 text-sage hover:text-pine transition-colors shrink-0"
                    aria-label="Delete comment"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="relative flex items-center mt-1">
        <input
          aria-label={isAnonymousPost?'Anonymous reply':'Your reply'}
          maxLength={2000}
          value={text}
          onChange={(e) => {setText(e.target.value);setServerModeration(null);setNotice('');}}
          placeholder={placeholder}
          className="w-full h-10 rounded-full bg-ink border border-gray-800 pl-4 pr-10 text-white placeholder:text-sage text-xs outline-none focus:border-pine transition-colors"
        />
        <button
          type="submit"
          aria-label="Send reply"
          disabled={!text.trim() || submitting || !localModeration.allowed}
          className="absolute right-1 top-1 bottom-1 w-8 rounded-full bg-pine flex items-center justify-center text-black disabled:opacity-50 active:scale-95 transition-transform"
        >
          <Send className="w-3.5 h-3.5 -ml-0.5" strokeWidth={2} />
        </button>
      </form>
      <CirklesModerationNotice text={text} result={serverModeration||localModeration} onChange={value=>{setText(value);setNotice('');setServerModeration(null);}}/>
      {notice&&<p role="alert" className="text-xs text-pine">{notice}</p>}
    </div>
  );
}
