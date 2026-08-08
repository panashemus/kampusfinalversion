'use client';

import { useState, useEffect } from 'react';
import { Star, MessageSquare, Loader2, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export default function ProfileReviews({ targetUserId }: { targetUserId: string }) {
  const { toast } = useToast();
  
  // State
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Form State
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
      fetchReviews();
    };
    init();
  }, [targetUserId]);

  const fetchReviews = async () => {
    setLoading(true);
    // CRITICAL: We DO NOT select reviewer_id here. Total anonymity on the frontend.
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
      toast({ title: 'Nice try', description: "You can't review yourself!", variant: 'destructive' });
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
        description: error.code === '23505' ? 'You have already reviewed this user.' : error.message, 
        variant: 'destructive' 
      });
      return;
    }

    toast({ title: 'Review Submitted', description: 'Your anonymous review is now live.' });
    setComment('');
    setRating(5);
    fetchReviews();
  };

  // Calculate average rating
  const avgRating = reviews.length > 0 
    ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length).toFixed(1)
    : 0;

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header & Stats */}
      <div className="flex items-center justify-between bg-surface border border-gray-800 p-4 rounded-2xl">
        <div className="flex flex-col">
          <span className="text-white font-black text-lg">Trust Score</span>
          <span className="text-sage text-xs">{reviews.length} Anonymous Reviews</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black text-pine">{avgRating}</span>
          <Star className="w-6 h-6 text-pine fill-pine" />
        </div>
      </div>

      {/* Review Form */}
      {currentUserId && currentUserId !== targetUserId && (
        <form onSubmit={handleSubmit} className="bg-ink border border-gray-800 p-4 rounded-2xl flex flex-col gap-4">
          <span className="text-sage text-xs font-bold uppercase tracking-wider">Leave an Anonymous Review</span>
          
          {/* Star Selector */}
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="focus:outline-none transition-transform active:scale-90"
              >
                <Star className={`w-7 h-7 ${rating >= star ? 'text-pine fill-pine' : 'text-gray-700'}`} />
              </button>
            ))}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What was it like dealing with this student?"
            required
            maxLength={250}
            className="w-full bg-surface border border-gray-800 rounded-xl p-3 text-white placeholder:text-sage text-sm outline-none focus:border-pine resize-none h-24"
          />
          
          <button
            type="submit"
            disabled={submitting || !comment.trim()}
            className="w-full h-10 rounded-xl bg-pine text-black font-bold text-sm active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit Anonymously
          </button>
        </form>
      )}

      {/* Reviews List */}
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 text-pine animate-spin" /></div>
        ) : reviews.length === 0 ? (
          <div className="text-center p-6 text-sage text-sm bg-surface border border-gray-800 rounded-2xl">
            No reviews yet. Be the first to rate them!
          </div>
        ) : (
          reviews.map((rev, i) => (
            <div key={i} className="bg-surface border border-gray-800 p-4 rounded-2xl flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-pine/20 flex items-center justify-center">
                    <MessageSquare className="w-3 h-3 text-pine" />
                  </div>
                  <span className="text-white text-xs font-bold">Anonymous Student</span>
                </div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, idx) => (
                    <Star key={idx} className={`w-3 h-3 ${idx < rev.rating ? 'text-pine fill-pine' : 'text-gray-700'}`} />
                  ))}
                </div>
              </div>
              <p className="text-sage text-sm leading-relaxed mt-1">{rev.comment}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
