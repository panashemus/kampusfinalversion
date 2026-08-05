'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, X, Users, Briefcase, Lock, CheckCircle, XCircle, Trash2, Loader as Loader2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Profile } from '@/lib/types';

type Tab = 'subs' | 'gigs' | 'escrow';

export default function AdminDashboard({
  onClose,
  adminProfile,
}: {
  onClose: () => void;
  adminProfile: Profile | null;
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('subs');
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [premiumUsers, setPremiumUsers] = useState<any[]>([]);
  const [gigs, setGigs] = useState<any[]>([]);

  // Security Check: Only musungwa60@gmail.com or marked admins can view this
  const isAdmin = adminProfile?.is_admin || adminProfile?.email === 'musungwa60@gmail.com';

  const loadAdminData = useCallback(async () => {
    setLoading(true);

    // 1. Fetch Users who have Auto-Upgraded (Premium = true OR has a payment ref)
    const { data: usersData } = await supabase
      .from('profiles')
      .select('*')
      .or('is_premium.eq.true,payment_ref_code.not.is.null')
      .order('subscribed_until', { ascending: false });

    if (usersData) setPremiumUsers(usersData);

    // 2. Fetch all Hustles to audit Listing Fees
    const { data: hustlesData } = await supabase
      .from('hustles')
      .select('*')
      .order('created_at', { ascending: false });

    if (hustlesData) setGigs(hustlesData);

    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
    }
  }, [isAdmin, loadAdminData]);

  // --- ACTIONS FOR SUBSCRIPTIONS ---
  const revokePremium = async (userId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        is_premium: false,
        tier: 'free',
        payment_ref_code: null,
        subscribed_until: null,
      })
      .eq('id', userId);

    if (!error) {
      setPremiumUsers((prev) => prev.filter((u) => u.id !== userId));
      toast({ title: 'Premium Revoked 🚫', description: 'User has been downgraded to Free.' });
    }
  };

  const verifyPremium = async (userId: string) => {
    // Clears the ref code so they don't show up as 'pending audit' anymore, but keeps them premium
    const { error } = await supabase
      .from('profiles')
      .update({ payment_ref_code: 'VERIFIED' })
      .eq('id', userId);

    if (!error) {
      setPremiumUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, payment_ref_code: 'VERIFIED' } : u))
      );
      toast({ title: 'Payment Verified ✅', description: 'Subscription confirmed.' });
    }
  };

  // --- ACTIONS FOR GIGS ---
  const updateGigStatus = async (gigId: string, newStatus: string) => {
    const { error } = await supabase
      .from('hustles')
      .update({ status: newStatus })
      .eq('id', gigId);

    if (!error) {
      setGigs((prev) => prev.map((g) => (g.id === gigId ? { ...g, status: newStatus } : g)));
      toast({ title: 'Gig Updated', description: `Status changed to ${newStatus}.` });
    }
  };

  const deleteGig = async (gigId: string) => {
    const { error } = await supabase.from('hustles').delete().eq('id', gigId);
    if (!error) {
      setGigs((prev) => prev.filter((g) => g.id !== gigId));
      toast({ title: 'Gig Deleted 🗑️', description: 'Listing permanently removed.' });
    }
  };

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <div className="bg-red-950/30 border border-red-900 rounded-3xl p-8 flex flex-col items-center text-center gap-3 max-w-[300px]">
          <ShieldAlert className="w-12 h-12 text-red-500" />
          <h2 className="text-white font-black text-xl">Access Denied</h2>
          <p className="text-red-300 text-xs">You do not have administrative privileges to view the Kampus Command Center.</p>
          <button onClick={onClose} className="mt-4 bg-red-600 text-white font-bold py-2 px-6 rounded-full active:scale-95 transition-transform">Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-[420px] max-h-[85dvh] bg-midnight rounded-3xl border border-orange-500/30 flex flex-col shadow-2xl overflow-hidden animate-slide-up">
        
        {/* HEADER */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-orange-500/10 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-orange-500" strokeWidth={2.5} />
            <span className="text-orange-500 font-black text-lg tracking-tight">Kampus Admin</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-ink flex items-center justify-center text-sage hover:text-white transition-colors">
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex bg-ink border-b border-gray-800 shrink-0">
          <button
            onClick={() => setActiveTab('subs')}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'subs' ? 'text-orange-400 border-b-2 border-orange-500 bg-surface' : 'text-sage hover:text-white'}`}
          >
            <Users className="w-4 h-4" /> Subs
          </button>
          <button
            onClick={() => setActiveTab('gigs')}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'gigs' ? 'text-orange-400 border-b-2 border-orange-500 bg-surface' : 'text-sage hover:text-white'}`}
          >
            <Briefcase className="w-4 h-4" /> Gigs
          </button>
          <button
            onClick={() => setActiveTab('escrow')}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'escrow' ? 'text-orange-400 border-b-2 border-orange-500 bg-surface' : 'text-sage hover:text-white'}`}
          >
            <Lock className="w-4 h-4" /> Vault
          </button>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 no-scrollbar">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : (
            <>
              {/* TAB 1: SUBSCRIPTIONS */}
              {activeTab === 'subs' && (
                <div className="flex flex-col gap-3">
                  {premiumUsers.length === 0 ? (
                    <p className="text-sage text-center text-sm py-10">No premium upgrades to review.</p>
                  ) : (
                    premiumUsers.map((user) => (
                      <div key={user.id} className="bg-surface border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-white font-bold">{user.email}</div>
                            <div className="text-sage text-[10px] mt-0.5">Tier: <span className="text-yellow-500 font-bold uppercase">{user.tier || 'pro'}</span></div>
                          </div>
                          {user.payment_ref_code === 'VERIFIED' ? (
                            <span className="bg-pine/20 text-pine text-[10px] font-black px-2 py-1 rounded">VERIFIED</span>
                          ) : (
                            <span className="bg-orange-500/20 text-orange-400 text-[10px] font-black px-2 py-1 rounded animate-pulse">PENDING AUDIT</span>
                          )}
                        </div>
                        
                        <div className="bg-ink rounded p-2 text-xs flex flex-col gap-1 border border-gray-800">
                          <span className="text-sage">Ref Code: <strong className="text-white">{user.payment_ref_code || 'N/A'}</strong></span>
                          <span className="text-sage">SMS ID: <strong className="text-white">{user.payment_ref_id || 'N/A'}</strong></span>
                        </div>

                        {user.payment_ref_code !== 'VERIFIED' && (
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => verifyPremium(user.id)} className="flex-1 bg-pine/20 border border-pine/40 text-pine rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform">
                              <CheckCircle className="w-3.5 h-3.5" /> Confirm Payment
                            </button>
                            <button onClick={() => revokePremium(user.id)} className="flex-1 bg-red-950/40 border border-red-600/50 text-red-400 rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform">
                              <XCircle className="w-3.5 h-3.5" /> Fake (Revoke)
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 2: GIGS / LISTING FEES */}
              {activeTab === 'gigs' && (
                <div className="flex flex-col gap-3">
                  {gigs.length === 0 ? (
                    <p className="text-sage text-center text-sm py-10">No gigs listed.</p>
                  ) : (
                    gigs.map((gig) => (
                      <div key={gig.id} className="bg-surface border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div className="max-w-[70%]">
                            <div className="text-white font-bold truncate">{gig.title}</div>
                            <div className="text-sage text-[10px] mt-0.5">By: @{gig.seller_name}</div>
                          </div>
                          <span className={`text-[10px] font-black px-2 py-1 rounded ${gig.status === 'active' ? 'bg-pine/20 text-pine' : 'bg-red-950 border border-red-500/50 text-red-400'}`}>
                            {gig.status === 'active' ? 'LIVE' : 'SUSPENDED'}
                          </span>
                        </div>
                        
                        <div className="bg-ink rounded p-2 text-xs flex flex-col gap-1 border border-gray-800">
                          <span className="text-sage">Gig Code: <strong className="text-white">{gig.reference_code || 'N/A'}</strong></span>
                          <span className="text-sage">SMS ID: <strong className="text-white">{gig.payment_ref_id || 'N/A'}</strong></span>
                        </div>

                        <div className="flex gap-2 pt-1">
                          {gig.status !== 'active' ? (
                            <button onClick={() => updateGigStatus(gig.id, 'active')} className="flex-1 bg-pine/20 border border-pine/40 text-pine rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform">
                              <CheckCircle className="w-3.5 h-3.5" /> Approve
                            </button>
                          ) : (
                            <button onClick={() => updateGigStatus(gig.id, 'unpaid_suspended')} className="flex-1 bg-orange-950/40 border border-orange-600/50 text-orange-400 rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform">
                              <XCircle className="w-3.5 h-3.5" /> Suspend
                            </button>
                          )}
                          <button onClick={() => deleteGig(gig.id)} className="w-10 bg-red-950/40 border border-red-600/50 text-red-400 rounded-lg flex items-center justify-center active:scale-95 transition-transform">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: THE VAULT (ESCROW) */}
              {activeTab === 'escrow' && (
                <div className="flex flex-col items-center justify-center h-full gap-3 pt-10 text-center">
                  <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
                    <Lock className="w-7 h-7 text-orange-500" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-white font-black text-lg">The Vault</h3>
                  <p className="text-sage text-xs max-w-[250px] leading-relaxed">
                    Escrow trades currently process directly to your phone via FNB/eWallet. To track pending trades here, we will need to create an <strong>escrow_transactions</strong> table in Supabase.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
