'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  ImagePlus,
  History,
  Plus,
  X,
  Lock,
  Check,
  Copy,
  Loader as Loader2,
  CreditCard,
  Wallet,
  GraduationCap,
  BookOpen,
  AlertCircle,
  Trash2,
  Search,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { uploadImages } from '@/lib/payment';
import {
  classifyUniversity,
  isValidCourseForSchool,
  timeAgo,
} from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Profile } from '@/lib/types';

type KriticMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images: string[];
  benchmark_used?: string;
  created_at: string;
};

type KriticChatSession = {
  id: string;
  title: string;
  course_code: string;
  university: string;
  created_at: string;
  messages: KriticMessage[];
};

const PROMPT_STARTERS = [
  'Check my assignment draft for Harvard citations and structure:',
  'Verify the methodology and calculations in this lab report:',
  'Convert these lecture notes into presentation slide points:',
  'Draft a formal email to my lecturer regarding my continuous assessment mark:',
];

export default function KampusKritic({
  profile,
  onProfileUpdate,
  onOpenTerms,
  onOpenProfile,
}: {
  profile: Profile | null;
  onProfileUpdate?: (updated: Profile) => void;
  onOpenTerms?: () => void;
  onOpenProfile?: () => void;
}) {
  const { toast } = useToast();

  const schoolInfo = classifyUniversity(profile?.email || profile?.university);
  const displayUsername =
    profile?.username?.replace(/^@/, '') ||
    profile?.email?.split('@')[0] ||
    'Student';

  const hasValidCourse = isValidCourseForSchool(
    profile?.course_code,
    profile?.email || profile?.university
  );

  // Course Gate Search State (for users who haven't set a valid school course yet)
  const [courseSearch, setCourseSearch] = useState('');
  const [selectedGateCourse, setSelectedGateCourse] = useState('');
  const [savingCourse, setSavingCourse] = useState(false);

  // Chat & History State
  const [sessions, setSessions] = useState<KriticChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<KriticMessage[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Composer State
  const [input, setInput] = useState('');
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);

  // Paywall State (1 Free Prompt -> P50/month Unlimited)
  const [promptsUsed, setPromptsUsed] = useState<number>(
    profile?.kritic_prompts_used ?? 0
  );
  const [payMethod, setPayMethod] = useState<'pay2cell' | 'ewallet'>('pay2cell');
  const [referenceCode, setReferenceCode] = useState('');
  const [paymentRefId, setPaymentRefId] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedNum, setCopiedNum] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const hasUnlimited =
    Boolean(profile?.is_admin) ||
    Boolean(profile?.kritic_unlimited) ||
    (Boolean(profile?.kritic_sub_until) &&
      new Date(profile!.kritic_sub_until!) > new Date());

  const isLockedByPaywall = !hasUnlimited && promptsUsed >= 1;

  useEffect(() => {
    setReferenceCode(`KRT-${Math.floor(1000 + Math.random() * 9000)}`);
  }, []);

  useEffect(() => {
    if (typeof profile?.kritic_prompts_used === 'number') {
      setPromptsUsed(profile.kritic_prompts_used);
    }
  }, [profile?.kritic_prompts_used]);

  useEffect(() => {
    if (!profile?.id) return;
    const storageKey = `kampus_kritic_sessions_${profile.id}`;
    const usedKey = `kampus_kritic_used_${profile.id}`;

    const localUsed = Number(localStorage.getItem(usedKey) || '0');
    if (localUsed > (profile.kritic_prompts_used || 0)) {
      setPromptsUsed(localUsed);
    }

    const savedRaw = localStorage.getItem(storageKey);
    if (savedRaw) {
      try {
        const parsed = JSON.parse(savedRaw) as KriticChatSession[];
        setSessions(parsed);
        if (parsed.length > 0) {
          setActiveSessionId(parsed[0].id);
          setMessages(parsed[0].messages || []);
        }
      } catch {
        // Ignore malformed cache
      }
    }
  }, [profile?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const persistSessions = (updated: KriticChatSession[]) => {
    setSessions(updated);
    if (profile?.id) {
      localStorage.setItem(
        `kampus_kritic_sessions_${profile.id}`,
        JSON.stringify(updated)
      );
    }
  };

  const handleLockInCourse = async () => {
    if (!selectedGateCourse || !profile) return;
    setSavingCourse(true);

    const { data, error } = await supabase
      .from('profiles')
      .update({
        course_code: selectedGateCourse,
        university: schoolInfo.fullName,
      })
      .eq('id', profile.id)
      .select()
      .maybeSingle();

    setSavingCourse(false);

    if (!error && data && onProfileUpdate) {
      onProfileUpdate(data as Profile);
    } else if (onProfileUpdate) {
      onProfileUpdate({
        ...profile,
        course_code: selectedGateCourse,
        university: schoolInfo.fullName,
      });
    }

    toast({
      title: 'Programme Linked',
      description: `${selectedGateCourse} saved to your ${schoolInfo.code} profile.`,
    });
  };

  const handleFilesSelected = async (files: File[]) => {
    if (!files.length) return;
    setUploadingImage(true);

    try {
      const base64Promises = files.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.readAsDataURL(file);
          })
      );
      const dataUrls = await Promise.all(base64Promises);
      setPendingImages((prev) => [...prev, ...dataUrls]);

      if (profile?.id) {
        uploadImages(files, profile.id).catch(() => {});
      }
    } catch {
      toast({
        title: 'Image attachment error',
        description: 'Could not read the selected image.',
        variant: 'destructive',
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const f = items[i].getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      handleFilesSelected(files);
      toast({
        title: 'Image Attached',
        description: `${files.length} image(s) attached to prompt.`,
      });
    }
  };

  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setShowHistory(false);
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = sessions.filter((s) => s.id !== id);
    persistSessions(filtered);
    if (activeSessionId === id) {
      setActiveSessionId(filtered[0]?.id || null);
      setMessages(filtered[0]?.messages || []);
    }
    try {
      await supabase.from('kritic_chats').delete().eq('id', id);
    } catch {
      // Ignore
    }
  };

  const handleSend = async () => {
    const textToSend = input.trim();
    if ((!textToSend && pendingImages.length === 0) || sending) return;

    if (isLockedByPaywall) {
      toast({
        title: 'Free Trial Completed',
        description:
          'Unlock Kampus Kritic Unlimited (P50/mo) to continue auditing.',
        variant: 'destructive',
      });
      return;
    }

    const attachedImages = [...pendingImages];
    setInput('');
    setPendingImages([]);
    setSending(true);

    const userMsg: KriticMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend || 'Attached image for review.',
      images: attachedImages,
      created_at: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    let currentSessionId = activeSessionId;
    const sessionTitle =
      textToSend.slice(0, 48) ||
      `${profile?.course_code || schoolInfo.code} Session`;

    if (!currentSessionId) {
      currentSessionId = crypto.randomUUID
        ? crypto.randomUUID()
        : `chat-${Date.now()}`;
      setActiveSessionId(currentSessionId);
    }

    try {
      const res = await fetch('/api/kritic-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptText: textToSend,
          images: attachedImages,
          history: updatedMessages,
          email: profile?.email,
          username: displayUsername,
          university: schoolInfo.fullName,
          courseCode: profile?.course_code || '',
        }),
      });

      const data = await res.json();
      const assistantMsg: KriticMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content:
          data.reply ||
          'Kampus Kritic is currently in development and does not yet source student coursework.',
        images: [],
        benchmark_used: data.benchmark_used,
        created_at: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      if (!data.is_preview) {
        const nextUsed = promptsUsed + 1;
        setPromptsUsed(nextUsed);
        if (profile?.id) {
          localStorage.setItem(
            `kampus_kritic_used_${profile.id}`,
            String(nextUsed)
          );
          await supabase
            .from('profiles')
            .update({ kritic_prompts_used: nextUsed })
            .eq('id', profile.id);
          if (onProfileUpdate && profile) {
            onProfileUpdate({ ...profile, kritic_prompts_used: nextUsed });
          }
        }
      }

      const existingIdx = sessions.findIndex((s) => s.id === currentSessionId);
      let nextSessions: KriticChatSession[];
      if (existingIdx >= 0) {
        nextSessions = sessions.map((s, idx) =>
          idx === existingIdx ? { ...s, messages: finalMessages } : s
        );
      } else {
        nextSessions = [
          {
            id: currentSessionId!,
            title: sessionTitle,
            course_code: profile?.course_code || schoolInfo.code,
            university: schoolInfo.code,
            created_at: new Date().toISOString(),
            messages: finalMessages,
          },
          ...sessions,
        ];
      }
      persistSessions(nextSessions);
    } catch {
      toast({
        title: 'Connection Error',
        description: 'Could not reach Kampus Kritic.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleUnlockUnlimited = async () => {
    if (!profile || paymentRefId.trim().length < 4) return;
    setSubmittingPayment(true);

    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    try {
      await supabase
        .from('profiles')
        .update({
          kritic_unlimited: true,
          is_premium: true,
          kritic_sub_until: nextMonth.toISOString(),
          subscribed_until: nextMonth.toISOString(),
          tier: 'kritic_unlimited',
          payment_ref_code: referenceCode,
          payment_ref_id: paymentRefId.trim(),
        })
        .eq('id', profile.id);

      await supabase.from('payments').insert({
        user_id: profile.id,
        amount: 50,
        reference_code: referenceCode,
        payment_ref_id: paymentRefId.trim(),
        feature: 'kritic_unlimited_p50',
        status: 'pending',
      });

      if (onProfileUpdate) {
        onProfileUpdate({
          ...profile,
          kritic_unlimited: true,
          is_premium: true,
          kritic_sub_until: nextMonth.toISOString(),
        });
      }

      toast({
        title: 'Kampus Kritic Unlimited Activated',
        description: `Ref ${referenceCode} logged.`,
      });
    } catch {
      toast({
        title: 'Verification Logged',
        description: 'Your reference has been submitted for activation.',
      });
    } finally {
      setSubmittingPayment(false);
    }
  };

  const copyText = (text: string, isCode: boolean) => {
    navigator.clipboard.writeText(text);
    if (isCode) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedNum(true);
      setTimeout(() => setCopiedNum(false), 2000);
    }
  };

  const filteredSchoolCourses = schoolInfo.courses.filter((c) =>
    c.toLowerCase().includes(courseSearch.trim().toLowerCase())
  );

  // MANDATORY COURSE GATE: Prompts any new or existing student to select from their school's official course list
  if (!hasValidCourse) {
    return (
      <div className="flex-1 bg-midnight flex flex-col overflow-y-auto px-4 py-6 pb-28">
        <div className="bg-surface border border-gray-800 rounded-2xl p-5 flex flex-col gap-4 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-ink border border-pine/40 flex items-center justify-center text-pine shrink-0">
              <GraduationCap className="w-5 h-5" strokeWidth={2} />
            </div>
            <div className="flex flex-col">
              <span className="text-pine text-[10px] font-black uppercase tracking-wider">
                Profile Setup Required
              </span>
              <h2 className="text-white font-black text-base">
                Hi, {displayUsername} — Select Your Course
              </h2>
            </div>
          </div>

          <p className="text-sage text-xs leading-relaxed">
            Your account is registered under{' '}
            <strong className="text-white">{schoolInfo.fullName}</strong>.
            Please select your official degree programme offered at{' '}
            <strong className="text-white">{schoolInfo.code}</strong> before
            using Kampus Kritic. You can change this anytime in your Profile
            tab.
          </p>

          <div className="relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-sage" />
            <input
              type="text"
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
              placeholder={`Search ${schoolInfo.code} courses (e.g. Law, Computer, Accounting)...`}
              className="w-full h-11 rounded-xl bg-ink border border-gray-800 pl-10 pr-4 text-white placeholder:text-sage/60 text-xs outline-none focus:border-pine"
            />
          </div>

          <div className="max-h-56 overflow-y-auto rounded-xl bg-ink border border-gray-800 divide-y divide-gray-800/70 no-scrollbar">
            {filteredSchoolCourses.length === 0 ? (
              <div className="p-4 text-center text-sage text-xs">
                No matching degree programme offered at {schoolInfo.code} for
                &quot;{courseSearch}&quot;.
              </div>
            ) : (
              filteredSchoolCourses.map((course) => {
                const isSelected = selectedGateCourse === course;
                return (
                  <button
                    key={course}
                    type="button"
                    onClick={() => setSelectedGateCourse(course)}
                    className={`w-full px-3.5 py-3 text-left text-xs flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-pine text-black font-black'
                        : 'text-white hover:bg-surface font-medium'
                    }`}
                  >
                    <span className="pr-2">{course}</span>
                    {isSelected && <Check className="w-4 h-4 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          <button
            type="button"
            onClick={handleLockInCourse}
            disabled={!selectedGateCourse || savingCourse}
            className="w-full h-11 rounded-xl bg-pine text-black font-black text-xs active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {savingCourse ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span>Save Programme &amp; Open Kampus Kritic</span>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-midnight flex flex-col h-full overflow-hidden relative">
      {/* Minimal, Clean Sub-Row: Shows School + Course on left, History & New on right */}
      <div className="px-4 py-2 bg-midnight border-b border-gray-800 flex items-center justify-between shrink-0">
        <button
          onClick={onOpenProfile}
          className="flex items-center gap-1.5 text-left min-w-0 pr-2 group"
        >
          <BookOpen className="w-3.5 h-3.5 text-pine shrink-0" />
          <span className="text-sage group-hover:text-white text-xs font-bold truncate transition-colors">
            {schoolInfo.code} · {profile?.course_code}
          </span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowHistory(true)}
            className="px-2.5 py-1 rounded-lg bg-surface border border-gray-800 text-sage hover:text-white text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-all"
          >
            <History className="w-3.5 h-3.5 text-pine" />
            <span>History ({sessions.length})</span>
          </button>
          <button
            onClick={startNewChat}
            className="px-2.5 py-1 rounded-lg bg-pine text-black text-[11px] font-black flex items-center gap-1 active:scale-95 transition-transform"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            <span>New</span>
          </button>
        </div>
      </div>

      {/* History Slide-Over Drawer */}
      {showHistory && (
        <div className="absolute inset-0 z-[2000] flex">
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setShowHistory(false)}
          />
          <div className="relative w-72 max-w-[82%] bg-surface border-r border-gray-800 h-full flex flex-col p-4 z-10 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <span className="text-white font-black text-sm">
                Saved Sessions
              </span>
              <button
                onClick={() => setShowHistory(false)}
                className="w-7 h-7 rounded-full bg-ink flex items-center justify-center text-sage hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={startNewChat}
              className="w-full mt-3 h-10 rounded-xl bg-pine text-black font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              <span>New Session</span>
            </button>

            <div className="flex-1 overflow-y-auto mt-3 flex flex-col gap-2 no-scrollbar">
              {sessions.length === 0 ? (
                <p className="text-sage text-xs text-center py-8">
                  No saved threads yet.
                </p>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      setActiveSessionId(s.id);
                      setMessages(s.messages || []);
                      setShowHistory(false);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                      activeSessionId === s.id
                        ? 'bg-ink border-pine/50 text-white'
                        : 'bg-ink/60 border-gray-800 text-sage hover:text-white'
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-white truncate">
                        {s.title}
                      </span>
                      <span className="text-[10px] text-sage mt-0.5 truncate">
                        {s.course_code} · {timeAgo(s.created_at)}
                      </span>
                    </div>
                    <button
                      onClick={(e) => deleteSession(s.id, e)}
                      className="p-1 text-sage hover:text-red-400 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 no-scrollbar">
        {/* Explicit Pre-Launch Disclaimer Banner */}
        <div className="bg-surface border border-pine/40 rounded-2xl p-3.5 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-pine shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="text-pine text-[11px] font-black uppercase tracking-wider">
              Still Being Built — Benchmark Archive Not Yet Active
            </span>
            <p className="text-sage text-xs leading-relaxed">
              Kampus Kritic is currently under construction and does not yet
              source past or current student coursework for{' '}
              <strong className="text-white">{profile?.course_code}</strong>.
              Responses during this build phase are general AI previews only.
            </p>
          </div>
        </div>

        {/* Clean Personalized Intro When Chat Is Empty */}
        {messages.length === 0 && (
          <div className="bg-surface border border-gray-800 rounded-2xl p-5 flex flex-col gap-4 animate-slide-up">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h1 className="text-white font-black text-xl tracking-tight">
                  Hi, {displayUsername}
                </h1>
                <p className="text-sage text-xs leading-relaxed">
                  {schoolInfo.code} ·{' '}
                  <strong className="text-pine">{profile?.course_code}</strong>
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-ink border border-pine/40 flex items-center justify-center text-pine shrink-0">
                <Sparkles className="w-4 h-4" strokeWidth={2} />
              </div>
            </div>

            <p className="text-sage text-xs leading-relaxed">
              Paste an assignment paragraph, calculation, or image below, or tap
              a prompt starter to populate your message box.
            </p>

            {!isLockedByPaywall && (
              <div className="flex flex-col gap-2 pt-1">
                <span className="text-sage text-[10px] font-bold uppercase tracking-wider">
                  Prompt Starters
                </span>
                <div className="flex flex-col gap-2">
                  {PROMPT_STARTERS.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => setInput(`${starter} `)}
                      className="w-full p-3 rounded-xl bg-ink border border-gray-800 hover:border-pine/50 text-left flex items-center justify-between group active:scale-[0.99] transition-all"
                    >
                      <span className="text-white text-xs font-medium group-hover:text-pine transition-colors">
                        {starter}
                      </span>
                      <ChevronRight className="w-4 h-4 text-sage group-hover:text-pine shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Conversation Messages */}
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex flex-col gap-1.5 animate-slide-up ${
                isUser ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[90%] rounded-2xl p-4 flex flex-col gap-2.5 ${
                  isUser
                    ? 'bg-pine text-black font-medium rounded-tr-sm'
                    : 'bg-surface border border-gray-800 text-white rounded-tl-sm'
                }`}
              >
                {!isUser && m.benchmark_used && (
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-800">
                    <span className="text-[10px] font-black uppercase tracking-wider text-pine">
                      {m.benchmark_used}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(m.content);
                        toast({ title: 'Response copied' });
                      }}
                      className="text-[10px] font-bold text-sage hover:text-white flex items-center gap-1 shrink-0"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                  </div>
                )}

                {m.images && m.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {m.images.map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        alt="Attached work"
                        className="w-full h-28 object-cover rounded-xl border border-black/20"
                      />
                    ))}
                  </div>
                )}

                <p
                  className={`text-xs leading-relaxed whitespace-pre-wrap ${
                    isUser ? 'text-black font-semibold' : 'text-white'
                  }`}
                >
                  {m.content}
                </p>
              </div>
              <span className="text-sage text-[10px] px-1">
                {isUser ? displayUsername : 'Kampus Kritic'} ·{' '}
                {timeAgo(m.created_at)}
              </span>
            </div>
          );
        })}

        {sending && (
          <div className="flex items-start gap-2.5 animate-slide-up">
            <div className="bg-surface border border-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2.5">
              <Loader2 className="w-4 h-4 text-pine animate-spin" />
              <span className="text-sage text-xs font-medium">
                Processing response for {schoolInfo.code}...
              </span>
            </div>
          </div>
        )}

        {/* P50 / Month Paywall Card (Enforced after 1 Free Prompt) */}
        {isLockedByPaywall && (
          <div className="bg-surface border border-pine/50 rounded-2xl p-5 flex flex-col gap-4 animate-slide-up">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-pine" />
                  <span className="text-pine text-xs font-black uppercase tracking-wider">
                    Free Trial Prompt Completed
                  </span>
                </div>
                <h3 className="text-white font-black text-lg">
                  Unlock Kampus Kritic Unlimited
                </h3>
                <p className="text-sage text-xs leading-relaxed">
                  Continue auditing assignments, pasting images, and recalling
                  chat history for{' '}
                  <strong className="text-white">{profile?.course_code}</strong>
                  .
                </p>
              </div>
              <div className="bg-ink border border-pine/40 px-3 py-2 rounded-xl text-right shrink-0">
                <span className="text-pine font-black text-lg block leading-none">
                  P 50
                </span>
                <span className="text-sage text-[10px] font-bold">/ month</span>
              </div>
            </div>

            <div className="bg-ink border border-gray-800 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-sage">
                  Your Reference Code
                </div>
                <div className="text-xl font-black text-pine tracking-wider mt-0.5">
                  {referenceCode}
                </div>
              </div>
              <button
                type="button"
                onClick={() => copyText(referenceCode, true)}
                className="px-3 py-2 rounded-lg bg-surface border border-pine/30 text-pine text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-transform"
              >
                {copiedCode ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copiedCode ? 'Copied' : 'Copy Code'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPayMethod('pay2cell')}
                className={`py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  payMethod === 'pay2cell'
                    ? 'bg-pine text-black border-pine'
                    : 'bg-ink border-gray-800 text-sage'
                }`}
              >
                <CreditCard className="w-4 h-4" /> FNB Pay2Cell
              </button>
              <button
                type="button"
                onClick={() => setPayMethod('ewallet')}
                className={`py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  payMethod === 'ewallet'
                    ? 'bg-pine text-black border-pine'
                    : 'bg-ink border-gray-800 text-sage'
                }`}
              >
                <Wallet className="w-4 h-4" /> eWallet
              </button>
            </div>

            <div className="bg-ink border border-gray-800 rounded-xl p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-sage block">
                    {payMethod === 'pay2cell'
                      ? 'FNB Pay2Cell Number'
                      : 'eWallet Number'}
                  </span>
                  <span className="text-white font-black text-base">
                    {payMethod === 'pay2cell' ? '77037168' : '71321163'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      payMethod === 'pay2cell' ? '77037168' : '71321163',
                      false
                    )
                  }
                  className="text-pine text-xs font-bold flex items-center gap-1"
                >
                  {copiedNum ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedNum ? 'Copied' : 'Copy Number'}
                </button>
              </div>
              <p className="text-sage text-xs leading-relaxed">
                Send <strong className="text-white">P 50</strong> to{' '}
                <strong className="text-white">
                  {payMethod === 'pay2cell' ? '77037168' : '71321163'}
                </strong>{' '}
                using reference{' '}
                <strong className="text-pine">{referenceCode}</strong>, then
                paste your SMS confirmation ID below.
              </p>
            </div>

            <input
              type="text"
              value={paymentRefId}
              onChange={(e) => setPaymentRefId(e.target.value)}
              placeholder="Paste FNB inContact or SMS Confirmation ID"
              className="h-11 rounded-xl bg-ink border border-gray-800 px-3.5 text-white placeholder:text-sage/60 text-xs outline-none focus:border-pine"
            />

            <button
              type="button"
              onClick={handleUnlockUnlimited}
              disabled={submittingPayment || paymentRefId.trim().length < 4}
              className="w-full h-12 rounded-xl bg-pine text-black font-black text-sm active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {submittingPayment ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" strokeWidth={2.5} />
              )}
              <span>
                {submittingPayment
                  ? 'Activating...'
                  : 'Confirm P50 Payment & Unlock Unlimited'}
              </span>
            </button>

            <p className="text-sage text-[10px] text-center">
              Subject to Fair Use Policy in the{' '}
              <button
                type="button"
                onClick={onOpenTerms}
                className="text-white underline hover:text-pine"
              >
                Terms of Service
              </button>
              .
            </p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Clean Bottom Chat & Image Paste Bar (Zero Scrollbar Clutter) */}
      <div className="p-3 bg-surface border-t border-gray-800 flex flex-col gap-2 shrink-0">
        {pendingImages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {pendingImages.map((img, idx) => (
              <div
                key={idx}
                className="relative w-14 h-14 rounded-xl overflow-hidden border border-pine/50 shrink-0"
              >
                <img
                  src={img}
                  alt="Upload preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    setPendingImages((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/80 text-white flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                handleFilesSelected(Array.from(e.target.files));
                e.target.value = '';
              }
            }}
          />
          <button
            type="button"
            disabled={isLockedByPaywall || uploadingImage}
            onClick={() => fileInputRef.current?.click()}
            title="Attach or paste image"
            className="w-11 h-11 rounded-xl bg-ink border border-gray-800 hover:border-pine/50 text-sage hover:text-pine flex items-center justify-center shrink-0 active:scale-95 transition-all disabled:opacity-40"
          >
            {uploadingImage ? (
              <Loader2 className="w-4 h-4 animate-spin text-pine" />
            ) : (
              <ImagePlus className="w-5 h-5" strokeWidth={1.75} />
            )}
          </button>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isLockedByPaywall}
            rows={1}
            placeholder={
              isLockedByPaywall
                ? 'Unlock P50/month Unlimited above to continue...'
                : 'Message Kampus Kritic or Ctrl+V paste images...'
            }
            className="flex-1 h-11 max-h-24 rounded-xl bg-ink border border-gray-800 px-3.5 py-3 text-white placeholder:text-sage/60 text-xs outline-none focus:border-pine transition-colors resize-none overflow-hidden no-scrollbar"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={
              isLockedByPaywall ||
              sending ||
              (!input.trim() && pendingImages.length === 0)
            }
            className="w-11 h-11 rounded-xl bg-pine text-black flex items-center justify-center shrink-0 active:scale-95 transition-transform disabled:opacity-40"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
            ) : (
              <Send className="w-4 h-4" strokeWidth={2.25} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
