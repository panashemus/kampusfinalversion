'use client';
import { useEffect, useState } from 'react';
import { X, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import PublicReviewQueue from './PublicReviewQueue';

export default function AdminDashboard({ onClose, adminProfile }: { onClose: () => void; adminProfile: Profile | null }) {
  const [pending, setPending] = useState<{ id: string; status: string; created_at: string }[]>([]);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!adminProfile?.is_admin) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase.from('escrow_transactions').select('id,status,created_at').order('created_at', { ascending: false }).limit(100);
      if (!active) return;
      if (error) setNotice('Historical escrow records could not be loaded. Review them securely in Supabase.');
      else setPending((data || []) as { id: string; status: string; created_at: string }[]);
    })();
    return () => { active = false; };
  }, [adminProfile?.is_admin]);
  return (
    <div className="fixed inset-0 z-[8000] bg-black/80 grid place-items-center p-4">
      <section className="w-full max-w-lg bg-surface border border-gray-800 rounded-2xl p-6 max-h-[85vh] overflow-y-auto text-white">
        <div className="flex items-center justify-between gap-4"><h2 className="font-bold flex items-center gap-2"><ShieldAlert size={20}/>Kampus administration</h2><button aria-label="Close" onClick={onClose}><X/></button></div>
        {!adminProfile?.is_admin ? <p className="text-red-300 mt-5">Access denied.</p> : <>
          <p className="text-sage text-sm mt-4">Kampus is free. New charges, escrow checkouts, paid entitlements, and manual payment approval controls are disabled.</p>
          <PublicReviewQueue />
          <h3 className="font-semibold mt-6">Historical escrow records (read only)</h3>
          <p className="text-sage text-xs mt-2">Do not assume a payment was received based on its stored status. Reconcile outstanding obligations with actual financial records outside this interface.</p>
          {notice && <p className="text-amber-200 text-sm mt-3">{notice}</p>}
          <div className="mt-4 space-y-2">{pending.map(t => <div key={t.id} className="border border-gray-700 rounded-xl p-3 text-xs"><span className="text-sage">Reference {t.id.slice(0,8)}</span><span className="float-right">{t.status}</span></div>)}</div>
          {!pending.length && !notice && <p className="text-sage text-sm mt-3">No records returned.</p>}
        </>}
      </section>
    </div>
  );
}
