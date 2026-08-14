'use client';

import { useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import type { Comment } from '@/lib/types';

export default function CommentThread({
  comments,
  onAdd,
  onDelete,
  currentUserId,
  placeholder = 'Reply anonymously...',
}: {
  comments: Comment[];
  onAdd: (c: Comment) => void;
  onAuthorClick?: (username: string, authorId?: string) => void; // Kept so CommunityHub doesn't break
  onDelete?: (id: string) => void;
  currentUserId?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    
    // Forces every local comment to instantly be anonymous
    onAdd({
      id: `temp-${Date.now()}`,
      author: 'Anonymous',
      text: text.trim(),
      time: 'just now',
      is_anonymous: true,
    });
    setText('');
  };

  return (
    <div className="flex flex-col gap-3">
      {comments.length > 0 && (
        <div className="flex flex-col gap-3 max-h-48 overflow-y-auto no-scrollbar">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-2 group">
              <div className="flex items-start gap-2">
                {/* 100% Anonymous Avatar */}
                <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
                  <span className="text-[10px]">🤫</span>
                </div>
                
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-2">
                    {/* 100% Anonymous Name */}
                    <span className="text-zinc-300 text-xs font-bold">Anonymous</span>
                    <span className="text-sage text-[10px]">{c.time}</span>
                  </div>
                  <p className="text-gray-300 text-xs leading-relaxed">{c.text}</p>
                </div>
              </div>
              
              {/* Only the author (validated by their hidden currentUserId) can delete their own anonymous comment */}
              {currentUserId && c.authorId === currentUserId && onDelete && (
                <button 
                  onClick={() => onDelete(c.id)} 
                  className="p-1 text-gray-600 hover:text-red-400 transition-colors shrink-0"
                  aria-label="Delete comment"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="relative flex items-center mt-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className="w-full h-10 rounded-full bg-ink border border-gray-800 pl-4 pr-10 text-white placeholder:text-sage text-xs outline-none focus:border-pine transition-colors"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="absolute right-1 top-1 bottom-1 w-8 rounded-full bg-pine flex items-center justify-center text-black disabled:opacity-50 active:scale-95 transition-transform"
        >
          <Send className="w-3.5 h-3.5 -ml-0.5" strokeWidth={2} />
        </button>
      </form>
    </div>
  );
}
