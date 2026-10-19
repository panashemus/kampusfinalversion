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
  BookOpen,
  GraduationCap,
  PauseCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { classifyUniversity } from '@/lib/utils';
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
  onProfileUpdate,
  onDisconnect,
  onOpenSubscription,
  onOpenAdminQueue,
}: {
  profile: Profile | null;
  onProfileUpdate?: (updated: Profile) => void;
  onDisconnect: () => void;
  onOpenSubscription: () => void;
  onOpenAdminQueue?: () => void;
}) {
  const { toast } = useToast();
  const schoolInfo = classifyUniversity(profile?.email || profile?.university);

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
  const [editCourse, setEditCourse] = useState(profile?.course_code || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(
    profile?.avatar_url || null
  );
  const [localUsername, setLocalUsername] = useState<string>(
    profile?.username || profile?.email?.split('@')[0] || 'Student'
  );
  const [localCourse, setLocalCourse] = useState<string>(
    profile?.course_code || ''
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setLocalUsername(
      profile.username || profile.email?.split('@')[0] || 'Student'
    );
    setLocalCourse(profile.course_code || '');
    setEditUsername(profile.username || profile.email?.split('@')[0] || '');
    setEditCourse(profile.course_code || '');

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
    !!profile?.kritic_unlimited ||
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

    const cleanUsername = editUsername.trim().replace(/^@/, '');
    const cleanCourse = editCourse.trim().toUpperCase();

    const { error } = await supabase
      .from('profiles')
      .update({
        username: cleanUsername,
        course_code: cleanCourse || null,
        university: schoolInfo.fullName,
      })
      .eq('id', profile.id);

    setIsSavingProfile(false);

    if (error) {
      toast({
        title: 'Error',
        description: 'Could not update profile. Username might be taken.',
        variant: 'destructive',
      });
    } else {
      setLocalUsername(cleanUsername);
      setLocalCourse(cleanCourse);
      setIsEditModalOpen(false);
      if (onProfileUpdate) {
        onProfileUpdate({
          ...profile,
          username: cleanUsername,
          course_code: cleanCourse || null,
          university: schoolInfo.fullName,
        });
      }
      toast({
        title: 'Profile Updated',
        description: 'Your username and course settings are now active.',
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
    <div className="flex-1 bg-midnight flex flex-col items-center overflow-y-auto px-4 pb-32 pt-5 relative">
      <PushNotificationBanner userId={profile?.id ?? ''} />

      {/* Edit Profile & Course Modal */}
      {isEditModalOpen && (
        <div className="absolute inset-0 z-[2000] flex items-end">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsEditModalOpen(false)}
          />
          <div className="relative w-full bg-surface border-t border-gray-800 rounded-t-3xl p-6 flex flex-col gap-5 animate-slide-up pb-10">
            <div className="flex items-center justify-between">
              <span className="text-white font-black text-base">
                Edit Student Profile
              </span>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-sage hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div
                className="relative w-24 h-24 rounded-full bg-ink border-2 border-pine/50 p-1 cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-full h-full rounded-full bg-surface flex items-center justify-center overflow-hidden relative">
                  {localAvatarUrl ? (
                    <img
                      src={localAvatarUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-sage" />
                  )}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploadingAvatar ? (
                      <Loader2 className="w-5 h-5 text-pine animate-spin" />
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
              <span className="text-sage text-xs">
                Tap photo to upload a new avatar
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sage text-xs font-bold uppercase tracking-wider">
                Student Username
              </label>
              <input
                type="text"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                placeholder="Enter your campus username"
                className="bg-ink rounded-xl h-11 w-full px-3.5 border border-gray-800 text-white placeholder:text-sage/60 outline-none focus:border-pine transition-colors text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sage text-xs font-bold uppercase tracking-wider">
                Active Course / Programme (Used by Kampus Kritic)
              </label>
              <input
                type="text"
                value={editCourse}
                onChange={(e) => setEditCourse(e.target.value)}
                placeholder="e.g. CSE311 / BSc Computer Systems / ACC201"
                className="bg-ink rounded-xl h-11 w-full px-3.5 border border-gray-800 text-white placeholder:text-sage/60 outline-none focus:border-pine transition-colors text-sm"
              />
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={isSavingProfile || !editUsername.trim()}
              className="w-full h-12 mt-1 rounded-xl bg-pine text-black font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSavingProfile ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Save Profile & Course'
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
              className="bg-red-950/30 border border-red-500/40 rounded-2xl p-4 flex flex-col gap-3 w-full"
            >
              <div className="flex items-center gap-2">
                <PauseCircle className="w-4 h-4 text-red-400" />
                <span className="text-red-300 font-bold text-xs">
                  Listing Paused
                </span>
              </div>
              <p className="text-white text-xs leading-relaxed">
                Payment verification needed for reference{' '}
                <span className="text-pine font-mono font-bold">
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
                    className="bg-ink rounded-xl h-10 px-3 border border-gray-800 text-white placeholder:text-sage/60 text-xs outline-none"
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
                      className="flex-1 h-9 rounded-xl bg-pine text-black text-xs font-black active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />{' '}
                      Reactivate
                    </button>
                    <button
                      onClick={() => setResubmitId(null)}
                      className="h-9 px-4 rounded-xl bg-surface border border-gray-800 text-sage text-xs font-bold"
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
                  className="w-full h-9 rounded-xl bg-ink border border-pine/40 text-pine text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5"
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
          className="w-full mb-5 h-11 rounded-2xl bg-surface border border-red-500/40 text-red-400 font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <ShieldAlert className="w-4 h-4 text-red-400" strokeWidth={1.75} />
          <span>Flagged Content Queue</span>
        </button>
      )}

      {/* Avatar & Identity Header */}
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-surface border-2 border-gray-800 p-1 shadow-lg">
          <div className="w-full h-full rounded-full bg-ink flex items-center justify-center overflow-hidden">
            {localAvatarUrl ? (
              <img
                src={localAvatarUrl}
                alt="PFP"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-10 h-10 text-sage" strokeWidth={1.5} />
            )}
          </div>
        </div>
        <button
          onClick={() => setIsEditModalOpen(true)}
          className="absolute bottom-0 right-0 w-8 h-8 bg-pine rounded-full flex items-center justify-center border-2 border-midnight active:scale-95 transition-transform shadow-md"
        >
          <Edit3 className="w-3.5 h-3.5 text-black" strokeWidth={2.25} />
        </button>
      </div>

      <div className="flex flex-col items-center gap-2 mt-3.5">
        <span className="text-white font-black tracking-tight text-xl">
          @{localUsername.replace(/^@/, '')}
        </span>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          <div className="flex items-center gap-1.5 rounded-full bg-surface border border-pine/40 px-3 py-1">
            <GraduationCap className="w-3.5 h-3.5 text-pine" strokeWidth={2} />
            <span className="text-white text-[11px] font-bold">
              {schoolInfo.fullName}
            </span>
          </div>

          {active ? (
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold bg-pine/15 text-pine border border-pine/40">
              <Crown className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>
                {profile?.is_admin
                  ? 'Admin Access'
                  : profile?.kritic_unlimited
                  ? 'Kritic Unlimited'
                  : profile?.is_premium
                  ? 'Pro Member'
                  : `Active until ${fmtDate(profile?.subscribed_until ?? null)}`}
              </span>
            </div>
          ) : (
            <button
              onClick={onOpenSubscription}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black bg-pine text-black active:scale-95 transition-all"
            >
              <Crown className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Upgrade Plan</span>
            </button>
          )}
        </div>
      </div>

      {/* Dedicated Course & Academic Calibration Card */}
      <div className="w-full mt-5 bg-surface border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-ink border border-pine/30 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-pine" strokeWidth={1.75} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sage text-[10px] font-bold uppercase tracking-wider">
              Course / Programme
            </span>
            <span className="text-white font-bold text-sm truncate">
              {localCourse || 'Not set — tap Edit to configure Kritic'}
            </span>
          </div>
        </div>
        <button
          onClick={() => setIsEditModalOpen(true)}
          className="px-3 py-1.5 rounded-xl bg-pine text-black text-xs font-black shrink-0 active:scale-95 transition-transform"
        >
          {localCourse ? 'Edit' : 'Set Course'}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 w-full mt-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-surface border border-gray-800 rounded-2xl p-3.5 flex flex-col items-center gap-1"
          >
            <span className="text-pine font-black font-mono text-lg">
              {stat.value}
            </span>
            <span className="text-sage text-[11px] font-bold text-center">
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* Emergency Hotlines */}
      <div className="w-full mt-6">
        <span className="text-sage text-xs font-bold uppercase tracking-wider px-1">
          Campus Security Hotlines
        </span>
        <div className="flex flex-col gap-2.5 mt-2.5">
          <a
            href="tel:+2673552396"
            className="bg-surface border border-gray-800 hover:border-pine/40 rounded-2xl p-4 flex items-center justify-between active:scale-[0.99] transition-all"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-white text-xs font-bold">
                UB Protection Services
              </span>
              <span className="text-sage text-xs font-mono">+267 355 2396</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-ink border border-pine/30 flex items-center justify-center">
              <Phone className="w-4 h-4 text-pine" strokeWidth={1.75} />
            </div>
          </a>
          <a
            href="tel:+2673953062"
            className="bg-surface border border-gray-800 hover:border-pine/40 rounded-2xl p-4 flex items-center justify-between active:scale-[0.99] transition-all"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-white text-xs font-bold">
                BAC / BSBS Campus Security
              </span>
              <span className="text-sage text-xs font-mono">+267 395 3062</span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-ink border border-pine/30 flex items-center justify-center">
              <Phone className="w-4 h-4 text-pine" strokeWidth={1.75} />
            </div>
          </a>
        </div>
      </div>

      {/* Account Settings */}
      <div className="w-full mt-6">
        <span className="text-sage text-xs font-bold uppercase tracking-wider px-1">
          Account Settings
        </span>
        <div className="bg-surface border border-gray-800 rounded-2xl mt-2.5 flex flex-col overflow-hidden">
          {SETTINGS.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className={`flex items-center justify-between px-4 py-3.5 w-full text-left transition-colors hover:bg-ink/60 ${
                  i !== SETTINGS.length - 1 ? 'border-b border-gray-800' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-pine" strokeWidth={1.75} />
                  <span className="text-white text-xs font-bold">
                    {item.label}
                  </span>
                </div>
                <ChevronRight
                  className="w-4 h-4 text-sage"
                  strokeWidth={1.75}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Payout Methods */}
      <div className="w-full mt-6">
        <span className="text-sage text-xs font-bold uppercase tracking-wider px-1">
          Escrow &amp; Benchmark Payout Number
        </span>
        <div className="bg-surface border border-gray-800 rounded-2xl mt-2.5 p-4 flex flex-col gap-3">
          <label className="text-white text-xs font-bold">
            eWallet / Mobile Money Number
          </label>
          <input
            type="tel"
            value={ewallet}
            onChange={(e) => setEwallet(e.target.value)}
            placeholder="+267 7X XXX XXX"
            className="bg-ink rounded-xl h-10 w-full px-3.5 border border-gray-800 text-white placeholder:text-sage/60 outline-none focus:border-pine transition-colors text-xs font-mono"
          />
          <p className="text-sage text-[11px] leading-snug">
            Used for disbursing your verified Escrow payouts and 80%+ benchmark
            royalties.
          </p>
          <button
            onClick={handleSaveEwallet}
            disabled={isSavingEwallet || !ewallet.trim()}
            className="self-end flex items-center justify-center gap-1.5 rounded-xl bg-pine text-black text-xs font-black px-4 h-9 active:scale-95 transition-all disabled:opacity-50"
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
        className="w-full mt-6 h-11 rounded-2xl bg-surface border border-gray-800 hover:border-red-500/40 flex items-center justify-center gap-2 px-4 transition-all disabled:opacity-50"
      >
        {signingOut ? (
          <Loader2
            className="w-4 h-4 text-red-400 animate-spin"
            strokeWidth={2}
          />
        ) : (
          <LogOut className="w-4 h-4 text-red-400" strokeWidth={1.75} />
        )}
        <span className="text-red-400 font-bold text-xs">
          {signingOut ? 'Signing out...' : 'Sign Out'}
        </span>
      </button>
    </div>
  );
}
