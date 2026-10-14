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
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { Profile } from '@/lib/types';
import PushNotificationBanner from '@/components/PushNotificationBanner';

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

  const [signingOut, setSigningOut] = useState(false);
  const [ewallet, setEwallet] = useState(profile?.ewallet_number ?? '');
  const [isSavingEwallet, setIsSavingEwallet] = useState(false);
  const [activeListings, setActiveListings] = useState(0);
  const [safetyAlerts, setSafetyAlerts] = useState(0);
  const [suspendedGigs, setSuspendedGigs] = useState<
    Array<{
      id: string;
      title: string;
      reference_code: string | null;
      payment_ref_id: string | null;
    }>
  >([]);
  const [resubmitId, setResubmitId] = useState<string | null>(null);
  const [resubmitRef, setResubmitRef] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editUsername, setEditUsername] = useState(
    profile?.username || profile?.email?.split('@')[0] || ''
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(
    profile?.avatar_url || null
  );
  const [localUsername, setLocalUsername] = useState<string>(
    profile?.username || profile?.email?.split('@')[0] || 'Student'
  );
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
      setSuspendedGigs(
        (suspended as Array<{
          id: string;
          title: string;
          reference_code: string | null;
          payment_ref_id: string | null;
        }>) ?? []
      );
    })();
  }, [profile]);

  const active =
    !!profile?.is_admin ||
    !!profile?.is_premium ||
    (!!profile?.subscribed_until &&
      new Date(profile.subscribed_until) > new Date());

  const stats = [
    { label: 'Active Listings', value: String(activeListings) },
    { label: 'Safety Alerts', value: String(safetyAlerts) },
  ];

  const SETTINGS = [
    {
      icon: Lock,
      label: 'Walled Garden Privacy',
      onClick: () =>
        toast({
          title: 'Walled Garden Active',
          description: 'Profile locked to verified students only.',
        }),
    },
    {
      icon: Bell,
      label: 'Notification Preferences',
      onClick: () =>
        toast({
          title: 'Notification Preferences',
          description: 'Push notifications are managed via browser settings.',
        }),
    },
    {
      icon: Mail,
      label: 'Linked Student Email',
      onClick: () =>
        toast({
          title: 'Student Email',
          description: profile?.email ?? 'No email linked.',
        }),
    },
  ];

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      onDisconnect();
    } catch {
      toast({
        title: 'Sign out failed',
        description: 'Please try again.',
        variant: 'destructive',
      });
      setSigningOut(false);
    }
  };

  const handleSaveEwallet = async () => {
    if (!profile || !ewallet.trim()) return;
    setIsSavingEwallet(true);
    const { error } = await supabase
      .from('profiles')
      .update({ ewallet_number: ewallet.trim() })
      .eq('id', profile.id);
    setIsSavingEwallet(false);

    if (error)
      toast({
        title: 'Error Saving',
        description: 'Could not update your eWallet number.',
        variant: 'destructive',
      });
    else
      toast({
        title: 'eWallet Saved',
        description: 'Your payout number has been securely updated.',
      });
  };

  const handleSaveProfile = async () => {
    if (!profile || !editUsername.trim()) return;
    setIsSavingProfile(true);

    const { error } = await supabase
      .from('profiles')
      .update({ username: editUsername.trim() })
      .eq('id', profile.id);

    setIsSavingProfile(false);

    if (error) {
      toast({
        title: 'Error',
        description: 'Could not update profile. Username might be taken.',
        variant: 'destructive',
      });
    } else {
      setLocalUsername(editUsername.trim());
      setIsEditModalOpen(false);
      toast({
        title: 'Profile Updated',
        description: 'Your username has been updated.',
      });
    }
  };

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    try {
      setUploadingAvatar(true);
      if (!event.target.files || event.target.files.length === 0) return;

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${profile?.id}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile?.id);

      if (updateError) throw updateError;

      setLocalAvatarUrl(publicUrl);
      toast({ title: 'Avatar Updated', description: 'Profile photo saved.' });
    } catch {
      toast({
        title: 'Upload Failed',
        description: 'Could not upload image.',
        variant: 'destructive',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="flex-1 bg-[#0B0F0E] flex flex-col items-center overflow-y-auto px-4 pb-32 pt-5 relative">
      <PushNotificationBanner userId={profile?.id ?? ''} />

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="absolute inset-0 z-[2000] flex items-end">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsEditModalOpen(false)}
          />
          <div className="relative w-full bg-[#121816] ring-1 ring-white/[0.08] rounded-t-3xl p-6 flex flex-col gap-5 animate-slide-up pb-10">
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold tracking-tight text-base">
                Edit Student Profile
              </span>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div
                className="relative w-24 h-24 rounded-full bg-zinc-900 ring-2 ring-emerald-700/50 p-1 cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center overflow-hidden relative">
                  {localAvatarUrl ? (
                    <img
                      src={localAvatarUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-zinc-500" />
                  )}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploadingAvatar ? (
                      <Loader2 className="w-5 h-5 text-amber-300 animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5 text-white" />
                    )}
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
              <span className="text-zinc-500 text-xs">
                Tap photo to upload a new avatar
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-zinc-400 text-xs font-medium">
                Display Name / Handle
              </label>
              <input
                type="text"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                placeholder="Enter your campus handle"
                className="bg-zinc-950/90 rounded-xl h-11 w-full px-3.5 ring-1 ring-white/[0.07] text-white placeholder:text-zinc-500 outline-none focus:ring-emerald-700/50 transition-all text-sm"
              />
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={isSavingProfile || !editUsername.trim()}
              className="w-full h-11 mt-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSavingProfile ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Suspended Listings Warning Cards */}
      {suspendedGigs.length > 0 && (
        <div className="w-full flex flex-col gap-3 mb-4">
          {suspendedGigs.map((gig) => (
            <div
              key={gig.id}
              className="bg-rose-950/25 ring-1 ring-rose-500/30 rounded-2xl p-4 flex flex-col gap-3 w-full"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">⏸️</span>
                <span className="text-rose-300 font-semibold text-xs">
                  Listing Paused
                </span>
              </div>
              <p className="text-zinc-300 text-xs leading-relaxed">
                Payment verification needed for reference{' '}
                <span className="text-amber-300 font-mono font-semibold">
                  {gig.reference_code}
                </span>
                .
              </p>
              {resubmitId === gig.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={resubmitRef}
                    onChange={(e) => setResubmitRef(e.target.value)}
                    placeholder="Enter payment reference ID"
                    className="bg-zinc-950/90 rounded-xl h-10 px-3 ring-1 ring-white/[0.08] text-white placeholder:text-zinc-500 text-xs outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (resubmitRef.trim().length < 3) return;
                        await supabase
                          .from('hustles')
                          .update({
                            payment_ref_id: resubmitRef.trim(),
                            status: 'active',
                          })
                          .eq('id', gig.id);
                        setSuspendedGigs((prev) =>
                          prev.filter((g) => g.id !== gig.id)
                        );
                        setResubmitId(null);
                        setResubmitRef('');
                        toast({
                          title: 'Payment re-submitted',
                          description: 'Your listing is back online.',
                        });
                      }}
                      disabled={resubmitRef.trim().length < 3}
                      className="flex-1 h-9 rounded-xl bg-amber-400 text-zinc-950 text-xs font-semibold active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />{' '}
                      Reactivate
                    </button>
                    <button
                      onClick={() => setResubmitId(null)}
                      className="h-9 px-4 rounded-xl bg-zinc-900 ring-1 ring-white/[0.06] text-zinc-400 text-xs font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setResubmitId(gig.id);
                    setResubmitRef('');
                  }}
                  className="w-full h-9 rounded-xl bg-zinc-900 ring-1 ring-white/[0.08] text-amber-300 text-xs font-medium active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />{' '}
                  Submit Payment Ref
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {profile?.is_admin && onOpenAdminQueue && (
        <button
          onClick={onOpenAdminQueue}
          className="w-full mb-5 h-11 rounded-2xl bg-rose-950/30 ring-1 ring-rose-500/30 text-rose-300 font-medium text-xs active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <ShieldAlert className="w-4 h-4 text-rose-400" strokeWidth={1.75} />
          <span>Flagged Content Queue</span>
        </button>
      )}

      {/* Avatar & Identity Header */}
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-zinc-900 ring-2 ring-white/[0.08] p-1 shadow-lg">
          <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center overflow-hidden">
            {localAvatarUrl ? (
              <img
                src={localAvatarUrl}
                alt="PFP"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-10 h-10 text-zinc-500" strokeWidth={1.5} />
            )}
          </div>
        </div>
        <button
          onClick={() => setIsEditModalOpen(true)}
          className="absolute bottom-0 right-0 w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center ring-2 ring-[#0B0F0E] active:scale-[0.95] transition-transform shadow-md"
        >
          <Edit3 className="w-3.5 h-3.5 text-zinc-950" strokeWidth={2.25} />
        </button>
      </div>

      <div className="flex flex-col items-center gap-2 mt-3.5">
        <span className="text-white font-semibold tracking-tight text-xl">
          {localUsername}
        </span>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          {profile?.verified || profile?.email_verified ? (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-950/50 border border-emerald-800/40 px-3 py-1">
              <ShieldCheck
                className="w-3.5 h-3.5 text-emerald-400"
                strokeWidth={1.75}
              />
              <span className="text-emerald-300 text-[11px] font-medium">
                Verified · {profile?.university ?? 'Campus Network'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-full bg-rose-950/40 border border-rose-800/40 px-3 py-1">
              <span className="text-rose-300 text-[11px] font-medium">
                Unverified Student
              </span>
            </div>
          )}

          {active ? (
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium bg-amber-400/10 text-amber-300 border border-amber-400/25">
              <Crown className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>
                {profile?.is_admin
                  ? 'Admin Access'
                  : profile?.is_premium
                  ? 'Pro Member'
                  : `Active until ${fmtDate(profile?.subscribed_until ?? null)}`}
              </span>
            </div>
          ) : (
            <button
              onClick={onOpenSubscription}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium bg-amber-400 text-zinc-950 active:scale-[0.97] transition-all"
            >
              <Crown className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Upgrade Plan</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 w-full mt-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-zinc-900/60 backdrop-blur-md ring-1 ring-white/[0.06] rounded-2xl p-3.5 flex flex-col items-center gap-1"
          >
            <span className="text-white font-semibold font-mono text-lg">
              {stat.value}
            </span>
            <span className="text-zinc-400 text-[11px] font-medium text-center">
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* Emergency Hotlines */}
      <div className="w-full mt-6">
        <span className="text-zinc-400 text-xs font-medium px-1">
          Campus Security Hotlines
        </span>
        <div className="flex flex-col gap-2.5 mt-2.5">
          <a
            href="tel:+2673552396"
            className="bg-zinc-900/60 backdrop-blur-md ring-1 ring-white/[0.06] hover:ring-emerald-800/40 rounded-2xl p-4 flex items-center justify-between active:scale-[0.99] transition-all"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-zinc-100 text-xs font-semibold">
                UB Protection Services
              </span>
              <span className="text-zinc-400 text-xs font-mono">
                +267 355 2396
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-950/50 border border-emerald-800/30 flex items-center justify-center">
              <Phone
                className="w-4 h-4 text-emerald-400"
                strokeWidth={1.75}
              />
            </div>
          </a>
          <a
            href="tel:+2673953062"
            className="bg-zinc-900/60 backdrop-blur-md ring-1 ring-white/[0.06] hover:ring-emerald-800/40 rounded-2xl p-4 flex items-center justify-between active:scale-[0.99] transition-all"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-zinc-100 text-xs font-semibold">
                BAC Campus Security
              </span>
              <span className="text-zinc-400 text-xs font-mono">
                +267 395 3062
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-950/50 border border-emerald-800/30 flex items-center justify-center">
              <Phone
                className="w-4 h-4 text-emerald-400"
                strokeWidth={1.75}
              />
            </div>
          </a>
        </div>
      </div>

      {/* Account Settings */}
      <div className="w-full mt-6">
        <span className="text-zinc-400 text-xs font-medium px-1">
          Account Settings
        </span>
        <div className="bg-zinc-900/60 backdrop-blur-md ring-1 ring-white/[0.06] rounded-2xl mt-2.5 flex flex-col overflow-hidden">
          {SETTINGS.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className={`flex items-center justify-between px-4 py-3.5 w-full text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.06] ${
                  i !== SETTINGS.length - 1 ? 'border-b border-white/[0.05]' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className="w-4 h-4 text-zinc-400"
                    strokeWidth={1.75}
                  />
                  <span className="text-zinc-200 text-xs font-medium">
                    {item.label}
                  </span>
                </div>
                <ChevronRight
                  className="w-4 h-4 text-zinc-500"
                  strokeWidth={1.75}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Payout Methods */}
      <div className="w-full mt-6">
        <span className="text-zinc-400 text-xs font-medium px-1">
          Escrow Payout Number
        </span>
        <div className="bg-zinc-900/60 backdrop-blur-md ring-1 ring-white/[0.06] rounded-2xl mt-2.5 p-4 flex flex-col gap-3">
          <label className="text-zinc-200 text-xs font-medium">
            eWallet / Mobile Money Number
          </label>
          <input
            type="tel"
            value={ewallet}
            onChange={(e) => setEwallet(e.target.value)}
            placeholder="+267 7X XXX XXX"
            className="bg-zinc-950/90 rounded-xl h-10 w-full px-3.5 ring-1 ring-white/[0.07] text-white placeholder:text-zinc-500 outline-none focus:ring-emerald-700/50 transition-all text-xs font-mono"
          />
          <p className="text-zinc-500 text-[11px] leading-snug">
            Used exclusively for disbursing your verified Escrow payouts.
          </p>
          <button
            onClick={handleSaveEwallet}
            disabled={isSavingEwallet || !ewallet.trim()}
            className="self-end flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-semibold px-4 h-9 active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {isSavingEwallet && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
            )}
            <span>{isSavingEwallet ? 'Saving...' : 'Save Number'}</span>
          </button>
        </div>
      </div>

      {/* Sign Out */}
      <button
        onClick={handleLogout}
        disabled={signingOut}
        className="w-full mt-6 h-11 rounded-2xl bg-zinc-900/60 ring-1 ring-white/[0.06] hover:bg-rose-950/30 hover:ring-rose-500/30 flex items-center justify-center gap-2 px-4 transition-all disabled:opacity-50"
      >
        {signingOut ? (
          <Loader2
            className="w-4 h-4 text-rose-400 animate-spin"
            strokeWidth={2}
          />
        ) : (
          <LogOut className="w-4 h-4 text-rose-400" strokeWidth={1.75} />
        )}
        <span className="text-rose-400 font-medium text-xs">
          {signingOut ? 'Signing out…' : 'Sign Out'}
        </span>
      </button>
    </div>
  );
}
