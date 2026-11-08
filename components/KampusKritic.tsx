'use client';
import SecureImage from './SecureImage';

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
  FileText,
} from 'lucide-react';
import { supabase,authHeaders } from '@/lib/supabase';

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

function renderInlineBold(text: string, isUser: boolean) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong
          key={i}
          className={isUser ? 'font-black text-black' : 'font-bold text-pine'}
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function renderFormattedContent(content: string, isUser: boolean) {
  const lines = content.split('\n');
  return (
    <div className="flex flex-col gap-1.5">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trimEnd();
        if (!line.trim()) {
          return <div key={idx} className="h-1" />;
        }
        if (/^#{1,3}\s+/.test(line)) {
          const cleanHeading = line.replace(/^#{1,3}\s+/, '').replace(/\*\*/g, '');
          return (
            <h4
              key={idx}
              className={`text-xs font-black uppercase tracking-wider mt-1.5 ${
                isUser ? 'text-black' : 'text-pine'
              }`}
            >
              {cleanHeading}
            </h4>
          );
        }
        if (/^[-*]\s+/.test(line)) {
          const bulletBody = line.replace(/^[-*]\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span
                className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                  isUser ? 'bg-black' : 'bg-pine'
                }`}
              />
              <span
                className={`text-xs leading-relaxed ${
                  isUser ? 'text-black font-semibold' : 'text-white'
                }`}
              >
                {renderInlineBold(bulletBody, isUser)}
              </span>
            </div>
          );
        }
        return (
          <p
            key={idx}
            className={`text-xs leading-relaxed whitespace-pre-wrap ${
              isUser ? 'text-black font-semibold' : 'text-white'
            }`}
          >
            {renderInlineBold(line, isUser)}
          </p>
        );
      })}
    </div>
  );
}

export default function KampusKritic({
  profile, sourcePostId, onReturnToSource,
  onProfileUpdate,
  onOpenTerms,
  onOpenProfile,
}: {
  profile: Profile | null;
  sourcePostId?: string;
  onReturnToSource?: (id:string)=>void;
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

  // Course Gate Search State
  const [courseSearch, setCourseSearch] = useState('');
  const [selectedGateCourse, setSelectedGateCourse] = useState('');
  const [savingCourse, setSavingCourse] = useState(false);

  // Chat & History State
  const [sessions, setSessions] = useState<KriticChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<KriticMessage[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Composer State
  const [input,setInput]=useState('');
  const [sourceError,setSourceError]=useState('');
  useEffect(()=>{if(!sourcePostId)return;const controller=new AbortController();setSourceError('');
  (async()=>{try{const res=await fetch('/api/interconnect/source?post='+sourcePostId,{headers:await authHeaders(),signal:controller.signal});const body=await res.json();if(!res.ok)throw new Error(body.error);setInput(body.text);setActiveSessionId(null);setMessages([]);}catch(e){if(!controller.signal.aborted)setSourceError(e instanceof Error?e.message:'Source unavailable.');}})();return()=>controller.abort();},[sourcePostId]);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);

  // Free to use with server-enforced daily and platform-wide AI budgets.
  const [promptsUsed, setPromptsUsed] = useState<number>(profile?.kritic_prompts_used ?? 0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof profile?.kritic_prompts_used === 'number') {
      setPromptsUsed(profile.kritic_prompts_used);
    }
  }, [profile?.kritic_prompts_used]);

  // Load saved chat history from sessionStorage + Supabase
  useEffect(() => {
    if (!profile?.id) return;
    const storageKey = `kampus_kritic_sessions_${profile.id}`;
    const usedKey = `kampus_kritic_used_${profile.id}`;

    const localUsed = Number(sessionStorage.getItem(usedKey) || '0');
    if (localUsed > (profile.kritic_prompts_used || 0)) {
      setPromptsUsed(localUsed);
    }

    const savedRaw = sessionStorage.getItem(storageKey);
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

    // Background sync with Supabase kritic_chats & kritic_messages
    (async () => {
      try {
        const { data: chatRows } = await supabase
          .from('kritic_chats')
          .select('*')
          .eq('user_id', profile.id)
          .order('updated_at', { ascending: false })
          .limit(20);

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
            course_code: c.course_code || profile.course_code || schoolInfo.code,
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
          sessionStorage.setItem(storageKey, JSON.stringify(hydrated));
          if (!activeSessionId && hydrated.length > 0) {
            setActiveSessionId(hydrated[0].id);
            setMessages(hydrated[0].messages);
          }
        }
      } catch {
        // Fallback to sessionStorage
      }
    })();
  }, [profile?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const persistSessions = (updated: KriticChatSession[]) => {
    setSessions(updated);
    if (profile?.id) {
      sessionStorage.setItem(
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
    if(files.length+pendingImages.length>2 || files.some(f=>!['image/jpeg','image/png','image/webp','application/pdf'].includes(f.type)||f.size>10*1024*1024)){toast({title:'Attachment limit',description:'Attach up to two JPEG, PNG, WebP or PDF files, each 10 MB or smaller.',variant:'destructive'});return;}
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
    } catch {
      toast({
        title: 'Attachment error',
        description: 'Could not read the selected file.',
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
      if (
        items[i].type.startsWith('image/') ||
        items[i].type === 'application/pdf'
      ) {
        const f = items[i].getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      handleFilesSelected(files);
      toast({
        title: 'File Attached',
        description: `${files.length} file(s) attached to prompt.`,
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


    const attachedImages = [...pendingImages];
    setInput('');
    setPendingImages([]);
    setSending(true);

    const userMsg: KriticMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend || 'Attached file for academic review.',
      images: attachedImages.map(url => url.startsWith('data:application/pdf') ? 'kritic-file:PDF' : 'kritic-file:Image'),
      created_at: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    let currentSessionId = activeSessionId;
    const sessionTitle =
      textToSend.slice(0, 48) ||
      `${profile?.course_code || schoolInfo.code} Audit`;

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
            course_code: profile.course_code || schoolInfo.code,
            university: schoolInfo.code,
          });
        } catch {
          // Handled by sessionStorage
        }
      }
    }

    const uploadedPaths: string[] = [];
    try {
      if (attachedImages.length && !profile?.id) throw new Error('Sign in to attach coursework.');
      // Keep large documents out of function requests, chat history and persisted messages.
      for (const dataUrl of attachedImages) {
        const match = /^data:(image\/(?:png|jpeg|webp)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
        if (!match) throw new Error('Invalid attachment format.');
        const mimeType = match[1];
        const bytes = Uint8Array.from(atob(match[2]), char => char.charCodeAt(0));
        if (bytes.length > 10 * 1024 * 1024) throw new Error('Attachments must be 10 MB or smaller.');
        const extension = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1];
        const path = `${profile!.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('kritic_attachments')
          .upload(path, new Blob([bytes], { type: mimeType }), { contentType: mimeType, upsert: false });
        if (uploadError) throw new Error('Your attachment could not be uploaded privately. Please retry.');
        uploadedPaths.push(path);
      }
      const res = await fetch('/api/kritic-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',...await authHeaders() },
        body: JSON.stringify({
          promptText: textToSend,
          images: [],
          filePaths: uploadedPaths,
          history: updatedMessages,
          sourcePostId,
          courseCode: profile?.course_code || '',
        }),
      });

      const data = await res.json();
      if(!res.ok)throw new Error(data.error || "Kritic could not complete this request.");
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
          sessionStorage.setItem(
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

      if (profile?.id) {
        try {
          await supabase.from('kritic_messages').insert({
            chat_id: currentSessionId,
            user_id: profile.id,
            role: 'user',
            content: userMsg.content,
            images: userMsg.images,
          });
          await supabase.from('kritic_messages').insert({
            chat_id: currentSessionId,
            user_id: profile.id,
            role: 'assistant',
            content: assistantMsg.content,
            benchmark_used: assistantMsg.benchmark_used,
          });
        } catch {
          // Local storage updated
        }
      }
    } catch (error) {
      // Undo the optimistic message; the student's draft and files remain in the composer.
      setMessages(messages);
      setInput(textToSend);setPendingImages(attachedImages);
      toast({
        title: 'Kritic unavailable',
        description: error instanceof Error?error.message:'Please try again.',
        variant: 'destructive',
      });
    } finally {
      // Server-side cleanup handles completed requests; this also covers failed sends.
      if (uploadedPaths.length) void supabase.storage.from('kritic_attachments').remove(uploadedPaths);
      setSending(false);
    }
  };

  const filteredSchoolCourses = schoolInfo.courses.filter((c) =>
    c.toLowerCase().includes(courseSearch.trim().toLowerCase())
  );


  return (
    <div className="flex-1 bg-midnight flex flex-col h-full overflow-hidden relative">
      {sourcePostId&&<div className="p-4 border-b border-gray-800 text-sm"><button className="text-pine min-h-11" onClick={()=>onReturnToSource?.(sourcePostId)}>← Return to the original discussion</button><p className="text-sage">Review the question before sending. Your critique stays private.</p>{sourceError&&<p role="alert" className="text-red-300">{sourceError}</p>}</div>}
      <p className="px-4 py-2 text-xs text-sage">Service safety limit: up to 20 requests per account per UTC day, subject to the shared service budget and your current plan. Attachments: 2 files, 10 MB each.</p>
      {/* Minimal, Clean Sub-Row */}
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
              Botswana-Aligned Feedback — Benchmark Archive Coming Later
            </span>
            <p className="text-sage text-xs leading-relaxed">
              Kritic uses public BQA assessment principles to guide detailed feedback for{' '}
              <strong className="text-white">{profile?.course_code || 'your programme'}</strong>.
              Your lecturer&apos;s rubric takes priority. Contributed student exemplars are not yet integrated, and Kritic is not an official marker.
              {' '}<a href="https://www.bqa.org.bw/departments-divisions/national-credit-and-qualifications-framework-services-ncqfs" target="_blank" rel="noopener noreferrer" className="text-pine underline">Read BQA guidance</a>.
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
              Paste an assignment paragraph, calculation, PDF, or image below,
              or tap a prompt starter to populate your message box.
            </p>

            {(
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
                    {m.images.map((fileUrl, i) =>
                      (fileUrl.startsWith('data:application/pdf') || fileUrl.startsWith('kritic-file:')) ? (
                        <div
                          key={i}
                          className="col-span-2 p-2.5 rounded-xl bg-ink border border-gray-800 flex items-center gap-2 text-white text-xs font-bold"
                        >
                          <FileText className="w-4 h-4 text-pine shrink-0" />
                          <span>{fileUrl === 'kritic-file:Image' ? 'Attached image' : 'Attached PDF Document'}</span>
                        </div>
                      ) : (
                        <SecureImage
                          key={i}
                          src={fileUrl}
                          alt="Attached work"
                          className="w-full h-28 object-cover rounded-xl border border-black/20"
                        />
                      )
                    )}
                  </div>
                )}

                {renderFormattedContent(m.content, isUser)}
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

        <div ref={bottomRef} />
      </div>

      {/* Bottom Chat, Image & PDF Composer */}
      <div className="p-3 bg-surface border-t border-gray-800 flex flex-col gap-2 shrink-0">
        {pendingImages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {pendingImages.map((fileUrl, idx) => (
              <div
                key={idx}
                className="relative w-14 h-14 rounded-xl overflow-hidden border border-pine/50 bg-ink flex items-center justify-center shrink-0"
              >
                {fileUrl.startsWith('data:application/pdf') ? (
                  <div className="flex flex-col items-center gap-0.5 text-pine">
                    <FileText className="w-5 h-5" />
                    <span className="text-[9px] font-black">PDF</span>
                  </div>
                ) : (
                  <SecureImage
                    src={fileUrl}
                    alt="Upload preview"
                    className="w-full h-full object-cover"
                  />
                )}
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
            accept="image/*,application/pdf"
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
            disabled={uploadingImage}
            onClick={() => fileInputRef.current?.click()}
            title="Attach image or PDF"
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

            rows={1}
            placeholder={
              'Message Kampus Kritic or attach PDF / images...'
            }
            className="flex-1 h-11 max-h-24 rounded-xl bg-ink border border-gray-800 px-3.5 py-3 text-white placeholder:text-sage/60 text-xs outline-none focus:border-pine transition-colors resize-none overflow-hidden no-scrollbar"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={
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
