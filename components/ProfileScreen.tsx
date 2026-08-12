'use client';

import { useState, useEffect, useRef } from 'react';
import {
  User,
  ShieldCheck,
  ChevronRight,
  Lock,
  Bell,
  Mail,
  Phone,
  Crown,
  LogOut,
  Loader as Loader2,
  ShieldAlert,
  RefreshCw,
  Camera,
  Edit3,
  X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { Profile } from '@/lib/types';
import PushNotificationBanner from '@/components/PushNotificationBanner';
import Image from 'next/image';

function fmtDate(iso: string | null) {
  if (!iso) return 'Inactive';
  const d = new Date(iso);
  if (d <= new Date()) return 'Expired';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function ProfileScreen({
  profile,
  onDisconnect,
  onOpenSubscription,
  onOpenAdminQueue,
}: {
  profile: Profile | null;
  onDisconnect: () => void;
  onOpenSubscription: () => void;
  onOpenAdminQueue?: () => void;
}) {
  const { toast } = useToast();
  
  // Existing state
  const [signingOut, setSigningOut] = useState(false);
  const [ewallet, setEwallet] = useState(profile?.ewallet_number ?? '');
  const [isSavingEwallet, setIsSavingEwallet] = useState(false);
  const [activeListings, setActiveListings] = useState(0);
  const [safetyAlerts, setSafetyAlerts] = useState(0);
  const [suspendedGigs, setSuspendedGigs] = useState<Array<{ id: string; title: string; reference_code: string | null; payment_ref_id: string | null }>>([]);
  const [resubmitId, setResubmitId] = useState<string | null>(null);
  const [resubmitRef, setResubmitRef] = useState('');

  // NEW: Profile Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editUsername, setEditUsername] = useState(profile?.username || profile?.email?.split('@')[0] || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Local profile state to instantly update the UI without full reload
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(profile?.avatar_url || null);
  const [localUsername, setLocalUsername] = useState<string>(profile?.username || profile?.email?.split('@')[0] || 'Student');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { count: listings } = await supabase
        .from('hustles')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', profile.id)
        .eq('status', 'active');
      setActiveListings(listings ?? 0);
      
      const { count: alerts } = await supabase
        .from('sos_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id);
      setSafetyAlerts(alerts ?? 0);
      
      const { data: suspended } = await supabase
        .from('hustles')
        .select('id, title, reference_code, payment_ref_id')
        .eq('seller_id', profile.id)
        .eq('status', 'unpaid_suspended');
      setSuspendedGigs((suspended as Array<{ id: string; title: string; reference_code: string | null; payment_ref_id: string | null }>) ?? []);
    })();
  }, [profile]);

  const active =
    !!profile?.is_admin ||
    !!profile?.is_premium ||
    (!!profile?.subscribed_until && new Date(profile.subscribed_until) > new Date());

  const stats = [
    { label: 'Active Listings', value: String(activeListings) },
    { label: 'Safety Alerts', value: String(safetyAlerts) },
  ];

  const SETTINGS = [
    {
      icon: Lock,
      label: 'Walled Garden Privacy',
      onClick: () => toast({ title: 'Walled Garden Active', description: 'Profile locked to verified students only.' }),
    },
    {
      icon: Bell,
      label: 'Notification Preferences',
      onClick: () => toast({ title: 'Notification Preferences', description: 'Notification preferences modal triggered.' }),
    },
    {
      icon: Mail,
      label: 'Linked Student Email',
      onClick: () => toast({ title: 'Student Email', description: profile?.email ?? 'No email linked.' }),
    },
  ];

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      onDisconnect();
    } catch {
      toast({ title: 'Sign out failed', description: 'Please try again.', variant: 'destructive' });
      setSigningOut(false);
    }
  };

  const handleSaveEwallet = async () => {
    if (!profile || !ewallet.trim()) return;
    setIsSavingEwallet(true);
    const { error } = await supabase.from('profiles').update({ ewallet_number: ewallet.trim() }).eq('id', profile.id);
    setIsSavingEwallet(false);

    if (error) toast({ title: 'Error Saving', description: 'Could not update your eWallet number. Try again.', variant: 'destructive' });
    else toast({ title: 'eWallet Saved', description: 'Your payout number has been securely updated.' });
  };

  // NEW: Save Profile Information (Username)
  const handleSaveProfile = async () => {
    if (!profile || !editUsername.trim()) return;
    setIsSavingProfile(true);

    const { error } = await supabase
      .from('profiles')
      .update({ username: editUsername.trim() })
      .eq('id', profile.id);

    setIsSavingProfile(false);

    if (error) {
      toast({ title: 'Error', description: 'Could not update profile. Username might be taken.', variant: 'destructive' });
    } else {
      setLocalUsername(editUsername.trim());
      setIsEditModalOpen(false);
      toast({ title: 'Profile Updated', description: 'Your username has been updated successfully.' });
    }
  };

  // NEW: Upload Avatar Image
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploadingAvatar(true);
      if (!event.target.files || event.target.files.length === 0) return;
      
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${profile?.id}-${Math.random()}.${fileExt}`;

      // Upload to Supabase Storage bucket named 'avatars'
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile record in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile?.id);

      if (updateError) throw updateError;

      setLocalAvatarUrl(publicUrl);
      toast({ title: 'PFP Updated', description: 'Looking good!' });
    } catch (error) {
      toast({ title: 'Upload Failed', description: 'Could not upload image.', variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="flex-1 bg-midnight flex flex-col items-center overflow-y-auto px-4 pb-32 pt-6 relative">
      <PushNotificationBanner userId={profile?.id ?? ''} />

      {/* --- NEW: EDIT PROFILE MODAL --- */}
      {isEditModalOpen && (
        <div className="absolute inset-0 z-[2000] flex items-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
          <div className="relative w-full bg-surface rounded-t-2xl p-6 flex flex-col gap-5 animate-slide-up pb-10">
            <div className="flex items-center justify-between">
              <span className="text-white font-black text-lg">Edit Profile</span>
              <button onClick={() => setIsEditModalOpen(false)}>
                <X className="w-5 h-5 text-sage" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-4">
              {/* Avatar Upload Trigger */}
              <div 
                className="relative w-24 h-24 rounded-full bg-ink border-2 border-pine/60 p-1 cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-full h-full rounded-full bg-surface border border-pine/40 flex items-center justify-center overflow-hidden relative">
                  {localAvatarUrl ? (
                    <img src={localAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-sage" />
                  )}
                  {/* Hover/Loading Overlay */}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploadingAvatar ? <Loader2 className="w-6 h-6 text-pine animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
                  </div>
                </div>
                {/* Hidden File Input */}
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef} 
                  onChange={handleAvatarUpload} 
                  className="hidden" 
                />
              </div>
              <span className="text-sage text-xs">Tap to change picture</span>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-white text-sm font-bold">Display Name / Username</label>
              <input
                type="text"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                placeholder="Enter your campus nickname"
                className="bg-ink rounded-lg h-12 w-full px-4 border border-gray-800 text-white placeholder:text-sage/60 outline-none focus:border-pine transition-colors text-sm"
              />
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={isSavingProfile || !editUsername.trim()}
              className="w-full h-12 mt-2 rounded-lg bg-pine text-black font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
            >
              {isSavingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* --- Existing Suspended Listings Warning Cards --- */}
      {suspendedGigs.length > 0 && (
        <div className="w-full flex flex-col gap-3 mb-4">
          {suspendedGigs.map((gig) => (
             /* Your existing suspended gigs UI logic stays exactly the same */
            <div key={gig.id} className="bg-red-950/40 border border-red-600/50 rounded-2xl p-4 flex flex-col gap-3 w-full">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⏸️</span>
                <span className="text-red-400 font-black text-sm">Post Suspended</span>
              </div>
              <p className="text-white text-xs leading-relaxed">
                C&apos;mon dude, pay up! 💸 We couldn&apos;t verify payment for reference code{' '}
                <span className="text-pine font-bold">{gig.reference_code}</span>. Send P10 via FNB/eWallet to get back online.
              </p>
              {resubmitId === gig.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={resubmitRef}
                    onChange={(e) => setResubmitRef(e.target.value)}
                    placeholder="Enter new payment ref ID"
                    className="bg-ink rounded-lg h-11 px-3 border border-gray-800 text-white placeholder:text-sage/60 text-sm outline-none focus:border-pine"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (resubmitRef.trim().length < 3) return;
                        await supabase.from('hustles').update({ payment_ref_id: resubmitRef.trim(), status: 'active' }).eq('id', gig.id);
                        setSuspendedGigs((prev) => prev.filter((g) => g.id !== gig.id));
                        setResubmitId(null);
                        setResubmitRef('');
                        toast({ title: 'Payment re-submitted', description: 'Your listing is back online.' });
                      }}
                      disabled={resubmitRef.trim().length < 3}
                      className="flex-1 h-10 rounded-lg bg-pine text-black text-xs font-bold active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} /> Re-activate
                    </button>
                    <button onClick={() => setResubmitId(null)} className="h-10 px-4 rounded-lg bg-surface border border-gray-800 text-sage text-xs font-bold">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setResubmitId(gig.id); setResubmitRef(''); }}
                  className="w-full h-10 rounded-lg bg-pine/20 border border-pine/50 text-pine text-xs font-bold active:scale-95 transition-transform flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} /> Re-submit Payment Ref
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {profile?.is_admin && onOpenAdminQueue && (
        <button
          onClick={onOpenAdminQueue}
          className="w-full mb-4 h-12 rounded-xl bg-red-600/20 border border-red-600/50 text-red-400 font-bold text-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <ShieldAlert className="w-5 h-5" strokeWidth={2} />
          Flagged Content Queue
        </button>
      )}
      
      {/* --- UPDATED: Avatar & Name Section --- */}
      <div className="relative">
        <div className="w-28 h-28 rounded-full bg-surface border-2 border-pine/60 p-1 shadow-lg">
          <div className="w-full h-full rounded-full bg-surface border border-pine/40 flex items-center justify-center overflow-hidden">
            {localAvatarUrl ? (
              <img src={localAvatarUrl} alt="PFP" className="w-full h-full object-cover" />
            ) : (
              <User className="w-12 h-12 text-sage" strokeWidth={1.5} />
            )}
          </div>
        </div>
        <button 
          onClick={() => setIsEditModalOpen(true)}
          className="absolute bottom-0 right-0 w-8 h-8 bg-pine rounded-full flex items-center justify-center border-2 border-midnight active:scale-95 transition-transform shadow-md"
        >
          <Edit3 className="w-4 h-4 text-black" strokeWidth={2.5} />
        </button>
      </div>

      <div className="flex flex-col items-center gap-2 mt-4">
        <span className="text-white font-black text-2xl">
          {localUsername}
        </span>
        {profile?.verified ? (
          <div className="flex items-center gap-1 rounded-full bg-surface border border-sage/40 px-2.5 py-1">
            <ShieldCheck className="w-3.5 h-3.5 text-pine" strokeWidth={2} />
            <span className="text-sage text-[10px] font-bold">
              Verified: {profile?.university ?? 'Walled Garden'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 rounded-full bg-surface border border-red-500/40 px-2.5 py-1">
            <span className="text-red-400 text-[10px] font-bold">Unverified</span>
          </div>
        )}
      </div>

      {/* Subscription status */}
      <div className="flex items-center gap-2 mt-3">
        {active ? (
          <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold bg-pine/15 text-pine border border-pine/50">
            <Crown className="w-3.5 h-3.5" strokeWidth={2} />
            {profile?.is_admin
              ? 'Admin Access'
              : profile?.is_premium
              ? 'Premium Member'
              : `Subscribed until ${fmtDate(profile?.subscribed_until ?? null)}`}
          </div>
        ) : (
          <button
            onClick={onOpenSubscription}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold bg-yellow-500/15 text-yellow-500 border border-yellow-500/50 active:scale-95 transition-transform"
          >
            <Crown className="w-3.5 h-3.5" strokeWidth={2} />
            Subscribe Now!
          </button>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 w-full mt-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-surface rounded-xl p-3 flex flex-col items-center gap-1"
          >
            <span className="text-white font-black text-lg">{stat.value}</span>
            <span className="text-sage text-[10px] text-center leading-tight">
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* Emergency hotlines */}
      <div className="w-full mt-6">
        <span className="text-sage text-xs font-bold uppercase tracking-wider">
          Live Emergency Hotlines
        </span>
        <div className="flex flex-col gap-3 mt-3">
          <a
            href="tel:+2673552396"
            className="bg-surface rounded-xl border border-pine/50 p-4 flex items-center justify-between active:scale-95 transition-transform"
          >
            <span className="text-white text-sm font-bold">
              UB Protection: +267 355 2396
            </span>
            <Phone className="w-5 h-5 text-pine" strokeWidth={1.5} />
          </a>
          <a
            href="tel:+2673953062"
            className="bg-surface rounded-xl border border-pine/50 p-4 flex items-center justify-between active:scale-95 transition-transform"
          >
            <span className="text-white text-sm font-bold">
              BAC Security: +267 395 3062
            </span>
            <Phone className="w-5 h-5 text-pine" strokeWidth={1.5} />
          </a>
        </div>
      </div>

      {/* Account settings */}
      <div className="w-full mt-6">
        <span className="text-sage text-xs font-bold uppercase tracking-wider">
          Account Settings
        </span>
        <div className="bg-surface rounded-xl mt-3 flex flex-col overflow-hidden">
          {SETTINGS.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className={`flex items-center justify-between px-4 py-4 w-full text-left
                  transition-colors hover:bg-white/5 active:bg-white/10
                  ${i !== SETTINGS.length - 1 ? 'border-b border-gray-800' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-sage" strokeWidth={1.5} />
                  <span className="text-white text-sm font-bold">{item.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-sage" strokeWidth={1.5} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Payout Methods */}
      <div className="w-full mt-6">
        <span className="text-sage text-xs font-bold uppercase tracking-wider">
          Payout Methods (Secure)
        </span>
        <div className="bg-surface rounded-xl mt-3 p-4 flex flex-col gap-3">
          <label className="text-white text-sm font-bold">
            eWallet / Mobile Money Number
          </label>
          <input
            type="tel"
            value={ewallet}
            onChange={(e) => setEwallet(e.target.value)}
            placeholder="+267 7X XXX XXX"
            className="bg-ink rounded-lg h-11 w-full px-3 border border-gray-800 text-white placeholder:text-sage/60 outline-none focus:border-pine transition-colors text-sm"
          />
          <p className="text-sage text-[10px] leading-snug">
            Stored securely. Used only for sending your Escrow payouts.
          </p>
          <button
            onClick={handleSaveEwallet}
            disabled={isSavingEwallet || !ewallet.trim()}
            className="self-end flex items-center justify-center gap-2 rounded-lg bg-pine text-black text-xs font-bold px-4 h-9 active:scale-95 transition-transform disabled:opacity-70 disabled:active:scale-100"
          >
            {isSavingEwallet && <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} />}
            {isSavingEwallet ? 'Saving...' : 'Save Number'}
          </button>
        </div>
      </div>

      {/* Sign out */}
      <button
        onClick={handleLogout}
        disabled={signingOut}
        className="w-full mt-6 h-13 rounded-xl bg-surface border border-red-900/50 flex items-center justify-center gap-2.5 px-4 py-4
          transition-colors hover:bg-red-950/30 active:bg-red-950/50 disabled:opacity-60"
      >
        {signingOut ? (
          <Loader2 className="w-4 h-4 text-red-500 animate-spin" strokeWidth={2} />
        ) : (
          <LogOut className="w-4 h-4 text-red-500" strokeWidth={2} />
        )}
        <span className="text-red-500 font-bold text-sm">
          {signingOut ? 'Signing out…' : 'Sign Out'}
        </span>
      </button>
    </div>
  );
}
