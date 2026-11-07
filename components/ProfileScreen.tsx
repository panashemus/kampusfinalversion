'use client';
import SecureImage from './SecureImage';

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
  ShieldCheck,
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
import { classifyUniversity, isValidCourseForSchool } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Profile } from '@/lib/types';
import StudentPreferences from './StudentPreferences';
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
  onOpenAdminQueue,
}: {
  profile: Profile | null;
  onProfileUpdate?: (updated: Profile) => void;
  onDisconnect: () => void;
  onOpenAdminQueue?: () => void;
}) {
  const { toast } = useToast();
  const schoolInfo = classifyUniversity(profile?.email || profile?.university);

  const [signingOut, setSigningOut] = useState(false);
  const [activeListings, setActiveListings] = useState(0);
  const [safetyAlerts, setSafetyAlerts] = useState(0);
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


    })();
  }, [profile]);

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

  const handleSaveProfile = async () => {
    if (!profile || !editUsername.trim()) return;
    if (editCourse && !isValidCourseForSchool(editCourse, profile.email || profile.university)) {
      toast({
        title: 'Check programme title',
        description: 'Enter a programme title between 3 and 120 characters.',
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
        course_code: editCourse || null,
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
          'Your contribution will be reviewed for possible educational use, subject to consent.',
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
    <div className="flex-1 w-full bg-midnight flex flex-col items-center overflow-y-auto px-4 sm:px-6 pb-32 pt-5 relative">
      <div className="w-full max-w-2xl flex flex-col items-center">

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
                    <SecureImage
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
                  maxLength={120}
                  className="bg-ink rounded-xl h-10 w-full pl-9 pr-3 border border-gray-800 text-white placeholder:text-sage/60 outline-none focus:border-pine text-xs"
                />
              </div>

              <div className="max-h-44 overflow-y-auto rounded-xl bg-ink border border-gray-800 divide-y divide-gray-800/70 no-scrollbar">
                {filteredCourses.length === 0 ? (
                  <div className="p-3 text-center text-sage text-xs">
                    Not on the current list? You can enter your programme below.
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
              {courseSearch.trim().length >= 3 && !schoolInfo.courses.includes(courseSearch.trim()) && (
                <button type="button" onClick={() => setEditCourse(courseSearch.trim())}
                  className="mt-2 w-full rounded-xl border border-pine/40 px-3 py-2.5 text-left text-xs text-pine hover:border-pine">
                  Use my programme: {courseSearch.trim().slice(0,120)} (self-reported)
                </button>
              )}
              <p className="mt-2 text-[11px] leading-relaxed text-sage">
                Catalogue includes BQA programme titles. Missing courses can be self-reported, not certified by KAMPUS.
                {' '}<a className="underline text-pine" href="https://www.bqa.org.bw/accredited-learning-programmes-ncqf" target="_blank" rel="noopener noreferrer">Verify on BQA</a>
              </p>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={isSavingProfile || !editUsername.trim()}
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
              . Submissions can help improve Kritic only after review and appropriate consent. No payments or royalties are currently offered.
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

      {profile?.is_admin && onOpenAdminQueue && (
        <button
          onClick={onOpenAdminQueue}
          className="w-full mb-5 h-11 rounded-2xl bg-surface border border-red-500/40 text-red-400 font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <ShieldAlert className="w-4 h-4 text-red-400" strokeWidth={1.75} />
          <span>Flagged Content Queue</span>
        </button>
      )}

      {/* Student identity */}
      <section className="relative w-full overflow-hidden rounded-[28px] border border-pine/30 bg-gradient-to-br from-[#214833] via-[#142b21] to-[#0a1712] shadow-2xl shadow-black/30">
        <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-20 h-64 w-64 rounded-full border border-pine/20 bg-pine/5" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-16 h-48 w-48 rounded-full border border-white/5" />
        <div className="relative p-5 sm:p-8">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-pine">KAMPUS / Student identity</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-[11px] font-semibold text-white">
              <ShieldCheck className="h-3.5 w-3.5 text-pine" aria-hidden="true" />
              {profile?.verified && profile?.email_verified ? 'Verified student' : 'Student account'}
            </span>
          </div>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
            <div className="relative shrink-0">
              <div className="h-24 w-24 overflow-hidden rounded-2xl border-2 border-white/25 bg-midnight/80 p-1 shadow-xl">
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-surface">
                  {localAvatarUrl ? <SecureImage src={localAvatarUrl} alt="Your profile photo" className="h-full w-full object-cover" /> : <User className="h-10 w-10 text-sage" strokeWidth={1.5} />}
                </div>
              </div>
              <button type="button" onClick={() => setIsEditModalOpen(true)} aria-label="Edit profile photo"
                className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#142b21] bg-pine text-black shadow-lg transition-transform hover:scale-105">
                <Camera className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-2xl font-black tracking-tight text-white sm:text-3xl">@{localUsername.replace(/^@/, '')}</h1>
              <p className="mt-1 text-sm font-medium text-[#c5d6cd]">{schoolInfo.fullName}</p>
              <p className="mt-2 text-xs text-sage">{profile?.is_admin ? 'Platform administrator' : 'KAMPUS community member'}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/15 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#b8c9bb]">{schoolInfo.code} / Academic programme</p>
              <p className="break-words text-sm font-semibold text-white">{localCourse || 'Add your course to complete your profile'}</p>
            </div>
            <button type="button" onClick={() => setIsEditModalOpen(true)}
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-pine/60 bg-pine px-4 text-xs font-black text-black hover:brightness-105">
              <Edit3 className="h-4 w-4" aria-hidden="true" />Edit profile
            </button>
          </div>
        </div>
      </section>

      {/* Contributor Benchmark Card (For High-Scoring Students) */}
      <div className="w-full mt-3 bg-surface border border-pine/30 rounded-2xl p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-ink border border-pine/40 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5 text-pine" strokeWidth={1.75} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-pine text-[10px] font-black uppercase tracking-wider">
              Contribute Academic Work
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
            className="w-full rounded-2xl border border-white/10 bg-surface p-4 sm:p-5 flex flex-col gap-2"
          >
            <span className="text-pine font-black font-mono text-2xl">
              {stat.value}
            </span>
            <span className="text-sage text-xs font-medium">
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {profile && <StudentPreferences profile={profile} onProfileUpdate={onProfileUpdate} />}
      <div className="w-full mt-4"><PushNotificationBanner userId={profile?.id ?? ''} /></div>

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
    </div>
  );
}
