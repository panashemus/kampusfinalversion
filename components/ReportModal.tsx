'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ReportReason, ReportContentType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

const REASONS: ReportReason[] = ['Spam', 'Harassment', 'Inappropriate Content', 'Fake Alert'];

export default function ReportModal({
  open,
  onClose,
  contentType,
  contentId,
  reporterId,
}: {
  open: boolean;
  onClose: () => void;
  contentType: ReportContentType;
  contentId: string;
  reporterId: string;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState<ReportReason>('Spam');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    const { error } = await supabase.from('reports').insert({
      reporter_id: reporterId,
      content_type: contentType,
      content_id: contentId,
      reason,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Report failed', description: 'Please try again.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Report submitted', description: 'Thank you. Our admins will review it.' });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[430px] bg-midnight rounded-t-3xl sm:rounded-3xl border border-gray-800 p-5 pb-8 animate-in slide-in-from-bottom duration-300">
        <div className="mx-auto w-10 h-1 rounded-full bg-gray-700 mb-4" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-black text-lg">Report Post</h2>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-surface flex items-center justify-center active:scale-95 transition-transform">
            <X className="w-4 h-4 text-sage" strokeWidth={2} />
          </button>
        </div>
        <p className="text-sage text-xs mb-4">Why are you reporting this post?</p>
        <div className="flex flex-col gap-2 mb-5">
          {REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`rounded-xl py-3 px-4 text-sm font-bold transition-all text-left ${
                reason === r ? 'bg-pine text-black' : 'bg-surface border border-gray-800 text-sage'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full h-12 rounded-xl bg-red-600 text-white font-bold text-base active:scale-95 transition-transform disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Report'}
        </button>
      </div>
    </div>
  );
}
