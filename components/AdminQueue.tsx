'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trash2, X, ShieldAlert, Loader as Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Report } from '@/lib/types';

type ReportWithContent = Report & {
  contentTitle?: string;
  contentText?: string;
  reporterName?: string;
};

export default function AdminQueue({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [reports, setReports] = useState<ReportWithContent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReports = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('reports')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (!data) {
      setLoading(false);
      return;
    }
    const reportRows = data as Report[];

    const enriched: ReportWithContent[] = await Promise.all(
      reportRows.map(async (r) => {
        const table = r.contentType === 'post' ? 'feed_posts' : 'hustles';
        const { data: content } = await supabase
          .from(table)
          .select(r.contentType === 'post' ? 'text' : 'title, description')
          .eq('id', r.contentId)
          .maybeSingle();
        const { data: reporter } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', r.reporterId)
          .maybeSingle();
        return {
          ...r,
          contentText:
            r.contentType === 'post'
              ? (content as { text?: string } | null)?.text ?? '[deleted]'
              : (content as { title?: string; description?: string } | null)?.title ?? '[deleted]',
          reporterName: (reporter as { email?: string } | null)?.email?.split('@')[0] ?? 'unknown',
        };
      })
    );
    setReports(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) loadReports();
  }, [open, loadReports]);

  if (!open) return null;

  const deletePost = async (report: ReportWithContent) => {
    const table = report.contentType === 'post' ? 'feed_posts' : 'hustles';
    await supabase.from(table).delete().eq('id', report.contentId);
    await supabase.from('reports').update({ status: 'deleted' }).eq('id', report.id);
    setReports((prev) => prev.filter((r) => r.id !== report.id));
    toast({ title: 'Post deleted', description: 'The reported post has been removed.' });
  };

  const dismissReport = async (report: ReportWithContent) => {
    await supabase.from('reports').update({ status: 'dismissed' }).eq('id', report.id);
    setReports((prev) => prev.filter((r) => r.id !== report.id));
    toast({ title: 'Report dismissed', description: 'The report has been dismissed.' });
  };

  return (
    <div className="fixed inset-0 z-[2100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[430px] max-h-[85vh] overflow-y-auto bg-midnight rounded-t-3xl sm:rounded-3xl border border-gray-800 p-5 pb-8 animate-in slide-in-from-bottom duration-300">
        <div className="mx-auto w-10 h-1 rounded-full bg-gray-700 mb-4" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500" strokeWidth={2} />
            <h2 className="text-white font-black text-lg">Flagged Content Queue</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-surface flex items-center justify-center active:scale-95 transition-transform">
            <X className="w-4 h-4 text-sage" strokeWidth={2} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-sage animate-spin" strokeWidth={2} />
          </div>
        ) : reports.length === 0 ? (
          <p className="text-sage text-sm text-center py-8">No pending reports. All clear!</p>
        ) : (
          <div className="flex flex-col gap-3">
            {reports.map((r) => (
              <div key={r.id} className="bg-surface rounded-xl border border-gray-800 p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-red-400 text-[10px] font-bold uppercase tracking-wider">{r.reason}</span>
                  <span className="text-sage text-[10px]">{timeAgo(r.createdAt)}</span>
                </div>
                <p className="text-white text-sm leading-snug line-clamp-2">{r.contentText}</p>
                <span className="text-sage text-[10px]">Reported by @{r.reporterName} - {r.contentType}</span>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => deletePost(r)}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-red-600/20 border border-red-600/50 text-red-400 text-xs font-bold py-2 active:scale-95 transition-transform"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                    Delete Post
                  </button>
                  <button
                    onClick={() => dismissReport(r)}
                    className="flex-1 rounded-lg bg-surface border border-gray-800 text-sage text-xs font-bold py-2 active:scale-95 transition-transform"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
