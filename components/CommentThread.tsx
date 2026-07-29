'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import type { Comment } from '@/lib/types';

let commentSeq = 0;
function nextCommentId() {
  commentSeq += 1;
  return `c-${Date.now()}-${commentSeq}`;
}

export default function CommentThread({
  comments,
  onAdd,
  placeholder = 'Add a comment...',
  onAuthorClick,
}: {
  comments: Comment[];
  onAdd: (comment: Comment) => void;
  placeholder?: string;
  onAuthorClick?: (username: string) => void;
}) {
  const [draft, setDraft] = useState('');

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onAdd({
      id: nextCommentId(),
      author: '@you',
      text,
      time: 'now',
    });
    setDraft('');
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sage text-xs font-bold uppercase tracking-wider">
        Comments & Updates
      </span>

      <div className="flex flex-col gap-3 max-h-44 overflow-y-auto no-scrollbar">
        {comments.length === 0 && (
          <span className="text-sage text-xs italic">No comments yet. Start the thread.</span>
        )}
        {comments.map((c) => (
          <div key={c.id} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onAuthorClick?.(c.author)}
                className="text-pine text-xs font-bold hover:underline"
              >
                {c.author}
              </button>
              <span className="text-sage text-[10px]">{c.time}</span>
            </div>
            <span className="text-white text-sm leading-snug">{c.text}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 bg-ink rounded-lg h-11 px-3 border border-gray-800 focus-within:border-sage transition-colors">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-white text-sm placeholder:text-sage outline-none"
        />
        <button
          onClick={submit}
          aria-label="Send comment"
          className="text-pine active:scale-90 transition-transform"
        >
          <Send className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
