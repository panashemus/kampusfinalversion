'use client';

import { useState, useEffect } from 'react';
import { Star, MessageSquare, Loader2, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export default function ProfileReviews({
  targetUserId,
}: {
  targetUserId: string;
}) {
  const { toast } = useToast();

  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
      fetchReviews();
    };
    init();
  }, [targetUserId]);

  const fetchReviews = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profile_reviews')
      .select('rating, comment, created_at')
      .eq('target_user_id', targetUserId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setReviews(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) return;
    if (currentUserId === targetUserId) {
      toast({
        title: 'Action not allowed',
        description: "You can't review your own profile.",
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from('profile_reviews').insert({
      target_user_id: targetUserId,
      reviewer_id: currentUserId,
      rating,
      comment: comment.trim(),
    });

    setSubmitting(false);

    if (error) {
      toast({
        title: 'Error',
        description:
          error.code === '23505'
            ? 'You have already reviewed this student.'
            : error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Review Submitted',
      description: 'Your anonymous peer review is live.',
    });
    setComment('');
    setRating(5);
    fetchReviews();
  };

  const avgRating =
    reviews.length > 0
      ? (
          reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length
        ).toFixed(1)
      : '—';

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center justify-between bg-zinc-950/60 ring-1 ring-white/[0.06] p-3.5 rounded-2xl">
        <div className="flex flex-col">
          <span className="text-zinc-100 font-semibold text-xs">
            Peer Trust Rating
          </span>
          <span className="text-zinc-500 text-[11px]">
            {reviews.length} Anonymous Reviews
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-bold font-mono text-amber-300">
            {avgRating}
          </span>
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
        </div>
      </div>

      {currentUserId && currentUserId !== targetUserId && (
        <form
          onSubmit={handleSubmit}
          className="bg-zinc-950/60 ring-1 ring-white/[0.06] p-4 rounded-2xl flex flex-col gap-3"
        >
          <span className="text-zinc-400 text-xs font-medium">
            Leave an Anonymous Review
          </span>

          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="focus:outline-none transition-transform active:scale-90"
              >
                <Star
                  className={`w-5 h-5 ${
                    rating >= star
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-zinc-700'
                  }`}
                />
              </button>
            ))}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience trading or interacting with this student..."
            required
            maxLength={250}
            className="w-full bg-zinc-900/90 ring-1 ring-white/[0.07] rounded-xl p-3 text-white placeholder:text-zinc-500 text-xs outline-none focus:ring-emerald-700/50 resize-none h-20"
          />

          <button
            type="submit"
            disabled={submitting || !comment.trim()}
            className="w-full h-10 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-xs active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>Submit Review</span>
          </button>
        </form>
      )}

      <div className="flex flex-col gap-2.5">
        {loading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center p-5 text-zinc-500 text-xs bg-zinc-950/40 ring-1 ring-white/[0.05] rounded-2xl">
            No peer reviews yet.
          </div>
        ) : (
          reviews.map((rev, i) => (
            <div
              key={i}
              className="bg-zinc-950/60 ring-1 ring-white/[0.06] p-3.5 rounded-2xl flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center">
                    <MessageSquare className="w-2.5 h-2.5 text-emerald-400" />
                  </div>
                  <span className="text-zinc-200 text-xs font-medium">
                    Verified Student
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, idx) => (
                    <Star
                      key={idx}
                      className={`w-3 h-3 ${
                        idx < rev.rating
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-zinc-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <p className="text-zinc-400 text-xs leading-relaxed">
                {rev.comment}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
