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
  Info,
  Trash2,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { uploadImages } from '@/lib/payment';
import { classifyUniversity, timeAgo } from '@/lib/utils';
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

const QUICK_STARTERS = [
  'Audit my assignment draft against 85%+ course benchmarks',
  'Check my Harvard citations and Turnitin AI tone risk',
  'Verify my lab calculations, units, and methodology',
  'Convert my notes into presentation slides and a speaker script',
];

export default function KampusKritic({
  profile,
  onProfileUpdate,
  onOpenTerms,
}: {
  profile: Profile | null;
  onProfileUpdate?: (updated: Profile) => void;
  onOpenTerms?: () => void;
}) {
  const { toast } = useToast();

  const schoolInfo = classifyUniversity(profile?.email || profile?.university);
  const displayUsername =
    profile?.username?.replace(/^@/, '') ||
    profile?.email?.split('@')[0] ||
    'Student';

  // Course state synced with Profile
  const [courseInput, setCourseInput] = useState(profile?.course_code || '');
  const [isEditingCourse, setIsEditingCourse] = useState(!profile?.course_code);
  const [savingCourse, setSavingCourse] = useState(false);

  // Chat & History State
  const [sessions, setSessions] = useState<KriticChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<KriticMessage[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showIntroBanner, setShowIntroBanner] = useState(true);

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
    if (profile?.course_code) {
      setCourseInput(profile.course_code);
      setIsEditingCourse(false);
    }
    if (typeof profile?.kritic_prompts_used === 'number') {
      setPromptsUsed(profile.kritic_prompts_used);
    }
  }, [profile?.course_code, profile?.kritic_prompts_used]);

  // Load saved chat history from localStorage + Supabase
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

    // Sync with Supabase tables if migrated
    (async () => {
      try {
        const { data: chatRows } = await supabase
          .from('kritic_chats')
          .select('*')
          .eq('user_id', profile.id)
          .order('updated_at', { ascending: false })
          .limit(25);

        if (chatRows && chatRows.length > 0) {
          const chatIds = chatRows.map((c: any) => c.id);
          const { data: msgRows } = await supabase
            .from('kritic_messages')
            .select('*')
            .in('chat_id', chatIds)
            .order('created_at', { ascending: true });

          const hydrated: KriticChatSession[] = chatRows.map((c: any) => ({
            id: c.id,
            title: c.title,
            course_code: c.course_code || profile.course_code || 'GENERAL',
            university: c.university || schoolInfo.code,
            created_at: c.created_at,
            messages: (msgRows || [])
              .filter((m: any) => m.chat_id === c.id)
              .map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                images: m.images || [],
                benchmark_used: m.benchmark_used,
                created_at: m.created_at,
              })),
          }));

          setSessions(hydrated);
          localStorage.setItem(storageKey, JSON.stringify(hydrated));
          if (!activeSessionId && hydrated.length > 0) {
            setActiveSessionId(hydrated[0].id);
            setMessages(hydrated[0].messages);
          }
        }
      } catch {
        // Fallback to localStorage sessions
      }
    })();
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

  const handleSaveCourse = async () => {
    const clean = courseInput.trim().toUpperCase();
    if (!clean || !profile) return;
    setSavingCourse(true);

    const { data, error } = await supabase
      .from('profiles')
      .update({ course_code: clean, university: schoolInfo.fullName })
      .eq('id', profile.id)
      .select()
      .maybeSingle();

    setSavingCourse(false);
    setIsEditingCourse(false);

    if (!error && data && onProfileUpdate) {
      onProfileUpdate(data as Profile);
    } else if (onProfileUpdate) {
      onProfileUpdate({
        ...profile,
        course_code: clean,
        university: schoolInfo.fullName,
      });
    }

    toast({
      title: 'Course Configured',
      description: `Kampus Kritic is now calibrated for ${clean} at ${schoolInfo.code}.`,
    });
  };

  const handleFilesSelected = async (files: File[]) => {
    if (!files.length) return;
    setUploadingImage(true);

    try {
      // Convert to base64 data URLs for instant AI vision + upload to storage
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
        description: `${files.length} screenshot(s) ready for Kritic analysis.`,
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
      // Ignore if not in DB
    }
  };

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt ?? input).trim();
    if ((!textToSend && pendingImages.length === 0) || sending) return;

    if (isLockedByPaywall) {
      toast({
        title: 'Free Trial Completed',
        description: 'Unlock Kampus Kritic Unlimited (P50/mo) to continue auditing.',
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
      content: textToSend || 'Attached image for academic review.',
      images: attachedImages,
      created_at: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    let currentSessionId = activeSessionId;
    const sessionTitle =
      textToSend.slice(0, 48) ||
      `${courseInput || schoolInfo.code} Image Audit`;

    if (!currentSessionId) {
      currentSessionId = crypto.randomUUID
        ? crypto.randomUUID()
        : `chat-${Date.now()}`;
      setActiveSessionId(currentSessionId);

      if (profile?.id) {
        try {
          await supabase.from('kritic_chats').insert({
            id: currentSessionId,
            user_id: profile.id,
            title: sessionTitle,
            course_code: courseInput || 'GENERAL',
            university: schoolInfo.code,
          });
        } catch {
          // Handled by local sync
        }
      }
    }

    if (profile?.id) {
      try {
        await supabase.from('kritic_messages').insert({
          chat_id: currentSessionId,
          user_id: profile.id,
          role: 'user',
          content: userMsg.content,
          images: attachedImages,
        });
      } catch {
        // Handled by local sync
      }
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
          courseCode: courseInput || profile?.course_code || 'GENERAL',
        }),
      });

      const data = await res.json();
      const assistantMsg: KriticMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content:
          data.reply ||
          'Audit complete. Please review the structural deductions above.',
        images: [],
        benchmark_used: data.benchmark_used,
        created_at: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      // Increment prompt usage count (enforces the 1-free-prompt trial)
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

      // Persist session in history
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
            course_code: courseInput || 'GENERAL',
            university: schoolInfo.code,
            created_at: new Date().toISOString(),
            messages: finalMessages,
          },
          ...sessions,
        ];
      }
      persistSessions(nextSessions);

      if (profile?.id) {
        try {
          await supabase.from('kritic_messages').insert({
            chat_id: currentSessionId,
            user_id: profile.id,
            role: 'assistant',
            content: assistantMsg.content,
            benchmark_used: assistantMsg.benchmark_used,
          });
        } catch {
          // Local storage already updated
        }
      }
    } catch {
      toast({
        title: 'Connection Error',
        description: 'Failed to reach Kampus Kritic engine. Please try again.',
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
          Subscribed_until: nextMonth.toISOString(),
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
        description: `Ref ${referenceCode} logged. You now have full access.`,
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

  return (
    <div className="flex-1 bg-midnight flex flex-col h-full overflow-hidden relative">
      {/* Sub-Header: School, Course Badge & History Controls */}
      <div className="px-4 py-2.5 bg-surface border-b border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="px-2.5 py-1 rounded-lg bg-ink border border-gray-800 flex items-center gap-1.5 shrink-0">
            <GraduationCap className="w-3.5 h-3.5 text-pine" strokeWidth={2} />
            <span className="text-white text-[11px] font-bold">
              {schoolInfo.code}
            </span>
          </div>

          {isEditingCourse ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={courseInput}
                onChange={(e) => setCourseInput(e.target.value)}
                placeholder="Course (e.g. CSE311)"
                className="h-7 w-32 rounded-lg bg-ink border border-pine/50 px-2 text-white text-[11px] font-bold uppercase outline-none"
              />
              <button
                onClick={handleSaveCourse}
                disabled={savingCourse || !courseInput.trim()}
                className="h-7 px-2.5 rounded-lg bg-pine text-black text-[10px] font-black active:scale-95 transition-transform"
              >
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingCourse(true)}
              className="px-2.5 py-1 rounded-lg bg-ink border border-gray-800 hover:border-pine/50 flex items-center gap-1.5 text-left transition-colors truncate"
            >
              <BookOpen className="w-3 h-3 text-pine shrink-0" />
              <span className="text-sage text-[11px] font-bold truncate">
                {courseInput || 'Set Course'}
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setShowIntroBanner((v) => !v)}
            title="How Kampus Kritic Works"
            className={`p-1.5 rounded-lg border transition-colors ${
              showIntroBanner
                ? 'bg-ink border-pine/40 text-pine'
                : 'bg-ink border-gray-800 text-sage hover:text-white'
            }`}
          >
            <Info className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className="px-2.5 py-1.5 rounded-lg bg-ink border border-gray-800 hover:border-gray-700 text-sage hover:text-white text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-all"
          >
            <History className="w-3.5 h-3.5 text-pine" />
            <span>History ({sessions.length})</span>
          </button>
          <button
            onClick={startNewChat}
            title="New Audit Thread"
            className="p-1.5 rounded-lg bg-pine text-black active:scale-95 transition-transform"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
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
                Audit History
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
              <span>Start New Audit</span>
            </button>

            <div className="flex-1 overflow-y-auto mt-3 flex flex-col gap-2 no-scrollbar">
              {sessions.length === 0 ? (
                <p className="text-sage text-xs text-center py-8">
                  No saved audits yet. Your conversations and pasted images will
                  be stored here automatically.
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
                      <span className="text-[10px] text-sage mt-0.5">
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
        {/* Personalized Greeting & How Kampus Kritic Works */}
        {(messages.length === 0 || showIntroBanner) && (
          <div className="bg-surface border border-gray-800 rounded-2xl p-5 flex flex-col gap-3.5 animate-slide-up">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-pine text-[10px] font-black uppercase tracking-wider">
                  Kampus Kritic · Argon Academic Engine
                </span>
                <h1 className="text-white font-black text-xl tracking-tight">
                  Hi, {displayUsername}
                </h1>
                <p className="text-sage text-xs leading-relaxed">
                  Calibrated for{' '}
                  <strong className="text-white">{schoolInfo.fullName}</strong>
                  {courseInput ? (
                    <>
                      {' '}
                      · Course <strong className="text-pine">{courseInput}</strong>
                    </>
                  ) : (
                    ''
                  )}
                  .
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-ink border border-pine/40 flex items-center justify-center text-pine shrink-0">
                <Sparkles className="w-5 h-5" strokeWidth={2} />
              </div>
            </div>

            <div className="bg-ink border border-gray-800 rounded-xl p-3.5 flex flex-col gap-2">
              <span className="text-white text-xs font-bold">
                How Kampus Kritic Works
              </span>
              <p className="text-sage text-xs leading-relaxed">
                Generic AI tools do not know how lecturers at UB, BAC / BSBS, or
                BIUST grade. Kampus Kritic benchmarks your drafts, lab
                calculations, and pasted screenshots directly against anonymized
                80%+ distinction coursework from your exact institution and
                course.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div className="bg-surface border border-gray-800 rounded-lg p-2 text-white font-semibold">
                  1. Paste Drafts or Images
                </div>
                <div className="bg-surface border border-gray-800 rounded-lg p-2 text-white font-semibold">
                  2. Check Rubric &amp; Citations
                </div>
                <div className="bg-surface border border-gray-800 rounded-lg p-2 text-white font-semibold">
                  3. Strip Turnitin AI Flags
                </div>
                <div className="bg-surface border border-gray-800 rounded-lg p-2 text-white font-semibold">
                  4. Recall Full Chat History
                </div>
              </div>
            </div>

            {/* Trial Status Indicator */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-ink border border-gray-800 text-xs">
              <span className="text-sage font-medium">Access Status</span>
              {hasUnlimited ? (
                <span className="text-pine font-black">
                  Unlimited Plan Active
                </span>
              ) : promptsUsed === 0 ? (
                <span className="text-pine font-bold">
                  1 Free Assignment Audit Available
                </span>
              ) : (
                <span className="text-red-400 font-bold">
                  Free Trial Used · Upgrade Required
                </span>
              )}
            </div>

            {messages.length === 0 && !isLockedByPaywall && (
              <div className="flex flex-col gap-2 pt-1">
                <span className="text-sage text-[10px] font-bold uppercase tracking-wider">
                  Quick Audit Starters
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {QUICK_STARTERS.map((starter) => (
                    <button
                      key={starter}
                      onClick={() => handleSend(starter)}
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
                        toast({ title: 'Audit response copied' });
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
                        alt="Attached academic work"
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
                Auditing against {schoolInfo.code}{' '}
                {courseInput || 'institutional'} benchmarks...
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
                  Continue auditing assignments, pasting rubric images, checking
                  citations, and recalling full history calibrated for{' '}
                  <strong className="text-white">{schoolInfo.code}</strong>.
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
              Unlimited usage is subject to our standard Fair Use Policy in the{' '}
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

      {/* Sticky Chat & Image Paste Composer */}
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

        <div className="flex items-end gap-2">
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
                : 'Paste assignment text, questions, or Ctrl+V images...'
            }
            className="flex-1 max-h-28 min-h-[44px] rounded-xl bg-ink border border-gray-800 px-3.5 py-3 text-white placeholder:text-sage/60 text-xs outline-none focus:border-pine transition-colors resize-none"
          />

          <button
            type="button"
            onClick={() => handleSend()}
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
