'use client';

import { useState, useEffect, useRef } from 'react';
import {
  User,
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
  Search,
  Check,
  Award,
  FileText,
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

  // Edit Profile & Official Course Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editUsername, setEditUsername] = useState(
    profile?.username || profile?.email?.split('@')[0] || ''
  );
  const [editCourse, setEditCourse] = useState(profile?.course_code || '');
  const [courseSearch, setCourseSearch] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Contributor Benchmark Portal Modal
  const [showContributorModal, setShowContributorModal] = useState(false);
  const [contribTitle, setContribTitle] = useState('');
  const [contribGrade, setContribGrade] = useState('85%');
  const [contribNotes, setContribNotes] = useState('');
  const [submittingContrib, setSubmittingContrib] = useState(false);

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
    if (!editCourse || !schoolInfo.courses.includes(editCourse)) {
      toast({
        title: 'Select Official Programme',
        description: `Please select a valid degree programme offered at ${schoolInfo.code}.`,
        variant: 'destructive',
      });
      return;
    }

    setIsSavingProfile(true);
    const cleanUsername = editUsername.trim().replace(/^@/, '');

    const { error } = await supabase
      .from('profiles')
      .update({
        username: cleanUsername,
        course_code: editCourse,
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
      setLocalCourse(editCourse);
      setIsEditModalOpen(false);
      if (onProfileUpdate) {
        onProfileUpdate({
          ...profile,
          username: cleanUsername,
          course_code: editCourse,
          university: schoolInfo.fullName,
        });
      }
      toast({
        title: 'Profile Updated',
        description: `Saved @${cleanUsername} (${editCourse}).`,
      });
    }
  };

  const handleSubmitContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !contribTitle.trim() || !contribNotes.trim()) return;
    setSubmittingContrib(true);

    const { error } = await supabase.from('academic_contributors').insert({
      user_id: profile.id,
      email: profile.email,
      institution: schoolInfo.code,
      course_code: localCourse || schoolInfo.code,
      grade_achieved: contribGrade.trim(),
      sample_title: contribTitle.trim(),
      methodology_notes: contribNotes.trim(),
      verified: false,
    });

    setSubmittingContrib(false);

    if (error) {
      toast({
        title: 'Submission Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setContribTitle('');
      setContribNotes('');
      setShowContributorModal(false);
      toast({
        title: 'Benchmark Submitted for Verification',
        description:
          'Once verified, your anonymized work will earn passive royalties.',
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

  const filteredCourses = schoolInfo.courses.filter((c) =>
    c.toLowerCase().includes(courseSearch.trim().toLowerCase())
  );

  return (
    <div className="flex-1 bg-midnight flex flex-col items-center overflow-y-auto px-4 pb-32 pt-5 relative">
      <PushNotificationBanner userId={profile?.id ?? ''} />

      {/* Edit Profile & Official School Course Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[6000] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setIsEditModalOpen(false)}
          />
          <div className="relative w-full max-w-[430px] max-h-[88dvh] bg-surface border-t sm:border border-gray-800 rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4 animate-slide-up overflow-y-auto no-scrollbar pb-10">
            <div className="flex items-center justify-between">
              <span className="text-white font-black text-base">
                Edit Student Profile &amp; Programme
              </span>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-sage hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div
                className="relative w-20 h-20 rounded-full bg-ink border-2 border-pine/50 p-1 cursor-pointer group"
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
                    <User className="w-8 h-8 text-sage" />
                  )}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploadingAvatar ? (
                      <Loader2 className="w-4 h-4 text-pine animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4 text-white" />
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
              <span className="text-sage text-[11px]">
                Tap photo to change avatar
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
                className="bg-ink rounded-xl h-11 w-full px-3.5 border border-gray-800 text-white placeholder:text-sage/60 outline-none focus:border-pine transition-colors text-xs font-bold"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sage text-xs font-bold uppercase tracking-wider">
                  Official {schoolInfo.code} Programme
                </label>
                <span className="text-pine text-[10px] font-bold">
                  {schoolInfo.code} Catalogue
                </span>
              </div>

              <div className="relative flex items-center">
                <Search className="absolute left-3 w-3.5 h-3.5 text-sage" />
                <input
                  type="text"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  placeholder={`Search ${schoolInfo.code} courses (e.g. Law, Computer, Finance)...`}
                  className="bg-ink rounded-xl h-10 w-full pl-9 pr-3 border border-gray-800 text-white placeholder:text-sage/60 outline-none focus:border-pine text-xs"
                />
              </div>

              <div className="max-h-44 overflow-y-auto rounded-xl bg-ink border border-gray-800 divide-y divide-gray-800/70 no-scrollbar">
                {filteredCourses.length === 0 ? (
                  <div className="p-3 text-center text-sage text-xs">
                    No matching course offered at {schoolInfo.code}.
                  </div>
                ) : (
                  filteredCourses.map((c) => {
                    const isSelected = editCourse === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditCourse(c)}
                        className={`w-full px-3 py-2.5 text-left text-xs flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-pine text-black font-black'
                            : 'text-white hover:bg-surface font-medium'
                        }`}
                      >
                        <span className="pr-2">{c}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={isSavingProfile || !editUsername.trim() || !editCourse}
              className="w-full h-11 mt-1 rounded-xl bg-pine text-black font-black text-xs flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSavingProfile ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Save Profile & Programme'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Contributor Benchmark Submission Drawer */}
      {showContributorModal && (
        <div className="fixed inset-0 z-[6000] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setShowContributorModal(false)}
          />
          <form
            onSubmit={handleSubmitContribution}
            className="relative w-full max-w-[430px] max-h-[88dvh] bg-surface border-t sm:border border-gray-800 rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4 animate-slide-up overflow-y-auto no-scrollbar pb-10"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-pine" />
                <span className="text-white font-black text-base">
                  Submit 80%+ Course Benchmark
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowContributorModal(false)}
                className="text-sage hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sage text-xs leading-relaxed">
              Lend your anonymized distinction assignments or test solutions for{' '}
              <strong className="text-white">
                {localCourse || schoolInfo.code}
              </strong>
              . Every time Kampus Kritic references your benchmark to audit a
              junior student, passive royalties are logged to your eWallet.
            </p>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-2 flex flex-col gap-1">
                <label className="text-sage text-[10px] font-bold uppercase">
                  Assignment / Module Title
                </label>
                <input
                  type="text"
                  required
                  value={contribTitle}
                  onChange={(e) => setContribTitle(e.target.value)}
                  placeholder="e.g. BIS302 Database Design Project"
                  className="bg-ink rounded-xl h-10 px-3 border border-gray-800 text-white placeholder:text-sage/60 text-xs outline-none focus:border-pine"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sage text-[10px] font-bold uppercase">
                  Grade Scored
                </label>
                <input
                  type="text"
                  required
                  value={contribGrade}
                  onChange={(e) => setContribGrade(e.target.value)}
                  placeholder="e.g. 88% / A"
                  className="bg-ink rounded-xl h-10 px-3 border border-gray-800 text-pine font-black text-xs outline-none focus:border-pine"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sage text-[10px] font-bold uppercase">
                Paste Assignment Text, Methodology, or Rubric Breakdown
              </label>
              <textarea
                rows={5}
                required
                value={contribNotes}
                onChange={(e) => setContribNotes(e.target.value)}
                placeholder="Paste your high-scoring essay structure, methodology, or key marking criteria..."
                className="bg-ink rounded-xl p-3 border border-gray-800 text-white placeholder:text-sage/60 text-xs outline-none focus:border-pine resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submittingContrib}
              className="w-full h-11 rounded-xl bg-pine text-black font-black text-xs flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              {submittingContrib ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span>Submit Anonymized Benchmark</span>
            </button>
          </form>
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

      {/* Official Degree Programme Card */}
      <div className="w-full mt-5 bg-surface border border-gray-800 rounded-2xl p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-ink border border-pine/30 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-pine" strokeWidth={1.75} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sage text-[10px] font-bold uppercase tracking-wider">
              {schoolInfo.code} Degree Programme
            </span>
            <span className="text-white font-bold text-xs truncate">
              {localCourse || `Select your official ${schoolInfo.code} course`}
            </span>
          </div>
        </div>
        <button
          onClick={() => setIsEditModalOpen(true)}
          className="px-3 py-2 rounded-xl bg-pine text-black text-xs font-black shrink-0 active:scale-95 transition-transform"
        >
          {localCourse ? 'Change' : 'Select'}
        </button>
      </div>

      {/* Contributor Benchmark Card (For High-Scoring Students) */}
      <div className="w-full mt-3 bg-surface border border-pine/30 rounded-2xl p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-ink border border-pine/40 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5 text-pine" strokeWidth={1.75} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-pine text-[10px] font-black uppercase tracking-wider">
              Passive Royalty Program
            </span>
            <span className="text-white font-bold text-xs truncate">
              Lend 80%+ Coursework to Kritic Vault
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowContributorModal(true)}
          className="px-3 py-2 rounded-xl bg-ink border border-pine/40 text-pine text-xs font-black shrink-0 active:scale-95 transition-transform"
        >
          Submit
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
