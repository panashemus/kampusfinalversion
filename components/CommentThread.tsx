'use client';

import { useState } from 'react';
import { Send, User, Trash2 } from 'lucide-react';
import type { Comment } from '@/lib/types';

export default function CommentThread({
  comments,
  onAdd,
  onAuthorClick,
  onDelete,
  currentUserId,
  placeholder = 'Write a comment...',
}: {
  comments: Comment[];
  onAdd: (c: Comment) => void;
  onAuthorClick?: (username: string, authorId?: string) => void;
  onDelete?: (id: string) => void;
  currentUserId?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    
    onAdd({
      id: `temp-${Date.now()}`,
      author: 'You',
      text: text.trim(),
      time: 'just now',
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
                <div className="w-6 h-6 rounded-full bg-ink border border-gray-800 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3 h-3 text-sage" strokeWidth={2} />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-2">
                    <button 
                      onClick={() => onAuthorClick?.(c.author, c.authorId)}
                      className="text-white text-xs font-bold hover:text-pine transition-colors"
                    >
                      {c.author}
                    </button>
                    <span className="text-sage text-[10px]">{c.time}</span>
                  </div>
                  <p className="text-gray-300 text-xs leading-relaxed">{c.text}</p>
                </div>
              </div>
              
              {/* Delete Button for Comment Author */}
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
      
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className="w-full h-10 rounded-full bg-ink border border-gray-800 pl-4 pr-10 text-white placeholder:text-sage text-xs outline-none focus:border-pine transition-colors"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="absolute right-1 w-8 h-8 rounded-full bg-pine flex items-center justify-center text-black disabled:opacity-50 active:scale-95 transition-transform"
        >
          <Send className="w-3.5 h-3.5 -ml-0.5" strokeWidth={2} />
        </button>
      </form>
    </div>
  );
}
