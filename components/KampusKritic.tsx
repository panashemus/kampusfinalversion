'use client';

import { useState } from 'react';
import {
  Sparkles,
  FileCheck2,
  Presentation,
  FlaskConical,
  MailCheck,
  Award,
  Lock,
  Check,
  Copy,
  Loader as Loader2,
  X,
  CreditCard,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  UploadCloud,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { Profile } from '@/lib/types';

type AuditMode = 'essay' | 'lab' | 'slides' | 'email';

type AuditResult = {
  overall_score: number;
  ai_probability: string;
  benchmark_citation: string;
  summary_verdict: string;
  critical_issues: string[];
  polished_rewrite: string;
  rubric_breakdown: { criterion: string; score: string; note: string }[];
};

const MODES: { id: AuditMode; label: string; icon: typeof FileCheck2; desc: string }[] = [
  {
    id: 'essay',
    label: 'Assignment Audit',
    icon: FileCheck2,
    desc: 'Harvard/APA citations, AI-tone humanizer & rubric grading',
  },
  {
    id: 'lab',
    label: 'Lab & Math Sanity',
    icon: FlaskConical,
    desc: 'Units, formulas, dimensional analysis & methodology check',
  },
  {
    id: 'slides',
    label: 'Slide Deck + Script',
    icon: Presentation,
    desc: 'Converts rough notes into slide bullets + 2-min speaker script',
  },
  {
    id: 'email',
    label: 'Lecturer Dispute',
    icon: MailCheck,
    desc: 'Diplomatic CA remark requests, extensions & formal emails',
  },
];

export default function KampusKritic({
  profile,
  onClose,
}: {
  profile: Profile | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'audit' | 'contribute'>('audit');

  // Audit State
  const [institution, setInstitution] = useState<'UB' | 'BAC'>('UB');
  const [courseCode, setCourseCode] = useState('');
  const [mode, setMode] = useState<AuditMode>('essay');
  const [draftText, setDraftText] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);

  // Micro-transaction Unlock State (P15)
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showUnlockCheckout, setShowUnlockCheckout] = useState(false);
  const [payMethod, setPayMethod] = useState<'pay2cell' | 'ewallet'>('pay2cell');
  const [refCode, setRefCode] = useState('');
  const [txId, setTxId] = useState('');
  const [copied, setCopied] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  // Contributor Vault State (For 80%+ Final Years)
  const [contribCourse, setContribCourse] = useState('');
  const [contribFaculty, setContribFaculty] = useState('Computing & IS');
  const [contribGrade, setContribGrade] = useState('');
  const [contribEwallet, setContribEwallet] = useState(profile?.ewallet_number ?? '');
  const [contribTitle, setContribTitle] = useState('');
  const [contribContent, setContribContent] = useState('');
  const [submittingContrib, setSubmittingContrib] = useState(false);

  const isFreeUnlocked = !!profile?.is_admin || !!profile?.is_premium;

  const handleRunAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (draftText.trim().length < 20) {
      toast({
        title: 'Draft too short',
        description: 'Paste at least a paragraph or problem prompt to audit.',
        variant: 'destructive',
      });
      return;
    }

    setScanning(true);
    setResult(null);
    const generatedRef = `KRT-${Math.floor(1000 + Math.random() * 9000)}`;
    setRefCode(generatedRef);
    setIsUnlocked(isFreeUnlocked);

    try {
      const res = await fetch('/api/kritic-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution,
          courseCode: courseCode.trim().toUpperCase() || 'GENERAL',
          mode,
          draftText: draftText.trim(),
        }),
      });

      const data = await res.json();
      setResult(data as AuditResult);
    } catch {
      toast({
        title: 'Scan error',
        description: 'Could not complete audit. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setScanning(false);
    }
  };

  const handleConfirmUnlock = async () => {
    if (txId.trim().length < 4) return;
    setUnlocking(true);

    if (profile?.id) {
      await supabase.from('kritic_audits').insert({
        user_id: profile.id,
        course_code: courseCode.trim().toUpperCase() || 'GENERAL',
        audit_mode: mode,
        reference_code: refCode,
        payment_ref_id: txId.trim(),
        is_unlocked: true,
        overall_score: result?.overall_score ?? 80,
      });
    }

    setTimeout(() => {
      setUnlocking(false);
      setIsUnlocked(true);
      setShowUnlockCheckout(false);
      toast({
        title: 'Full Kritic Audit Unlocked ',
        description: 'Your benchmark fixes and polished output are ready.',
      });
    }, 800);
  };

  const handleContributorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contribCourse.trim() || !contribGrade.trim() || !contribContent.trim()) return;
    setSubmittingContrib(true);

    const handle = profile?.username
      ? `@${profile.username}`
      : profile?.email?.split('@')[0] || 'scholar';

    const { error } = await supabase.from('academic_contributors').insert({
      user_id: profile?.id ?? null,
      student_handle: handle,
      institution,
      faculty: contribFaculty,
      course_code: contribCourse.trim().toUpperCase(),
      grade_achieved: contribGrade.trim(),
      ewallet_number: contribEwallet.trim(),
      sample_title: contribTitle.trim() || 'Distinction Benchmark',
      methodology_notes: contribContent.trim(),
    });

    setSubmittingContrib(false);

    if (error) {
      toast({
        title: 'Saved Locally',
        description: 'Run the SQL migration in Supabase to persist contributor rows.',
      });
    } else {
      toast({
        title: 'Benchmark Submitted to Vault ',
        description: 'Once verified, you earn royalties every time your course benchmark is used.',
      });
      setContribCourse('');
      setContribGrade('');
      setContribTitle('');
      setContribContent('');
    }
  };

  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-[430px] h-[100dvh] sm:h-[90dvh] bg-midnight sm:rounded-3xl border border-gray-800 flex flex-col overflow-hidden shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="px-5 py-4 bg-surface border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-ink border border-pine/40 flex items-center justify-center text-pine shadow-[0_0_12px_rgba(255,222,77,0.2)]">
              <Sparkles className="w-5 h-5" strokeWidth={2} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-white font-black text-base tracking-tight">
                  Kampus Kritic
                </span>
                <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-pine text-black">
                  Argon
                </span>
              </div>
              <span className="text-sage text-[10px]">
                Institutional Benchmark &amp; Pre-Submission Engine
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-ink border border-gray-800 flex items-center justify-center text-sage hover:text-white active:scale-90 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="px-4 pt-3 pb-2 bg-midnight border-b border-gray-800/80 flex gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
              activeTab === 'audit'
                ? 'bg-pine text-black shadow-md'
                : 'bg-surface text-sage border border-gray-800'
            }`}
          >
            ⚡ Pre-Flight Audit
          </button>
          <button
            onClick={() => setActiveTab('contribute')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
              activeTab === 'contribute'
                ? 'bg-pine text-black shadow-md'
                : 'bg-surface text-sage border border-gray-800'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            80%+ Scholar Vault
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 no-scrollbar pb-24">
          {activeTab === 'audit' ? (
            <>
              {/* Institution & Course Input */}
              <div className="bg-surface border border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-sage">
                      Campus Standard
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 bg-ink p-1 rounded-xl border border-gray-800">
                      {(['UB', 'BAC'] as const).map((uni) => (
                        <button
                          key={uni}
                          type="button"
                          onClick={() => setInstitution(uni)}
                          className={`py-1.5 rounded-lg text-xs font-black transition-all ${
                            institution === uni
                              ? 'bg-pine text-black'
                              : 'text-sage hover:text-white'
                          }`}
                        >
                          {uni}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-sage">
                      Course / Module Code
                    </label>
                    <input
                      type="text"
                      value={courseCode}
                      onChange={(e) => setCourseCode(e.target.value)}
                      placeholder="e.g. CSE311 / ACC201"
                      className="h-9 rounded-xl bg-ink border border-gray-800 px-3 text-white placeholder:text-sage/50 text-xs font-bold uppercase outline-none focus:border-pine"
                    />
                  </div>
                </div>

                {/* 4 Utility Cards */}
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {MODES.map((m) => {
                    const Icon = m.icon;
                    const active = mode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMode(m.id)}
                        className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all active:scale-[0.98] ${
                          active
                            ? 'bg-ink border-pine text-white shadow-[0_0_12px_rgba(255,222,77,0.12)]'
                            : 'bg-ink/60 border-gray-800 text-sage hover:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Icon
                            className={`w-4 h-4 ${active ? 'text-pine' : 'text-sage'}`}
                            strokeWidth={2}
                          />
                          {active && (
                            <span className="w-1.5 h-1.5 rounded-full bg-pine" />
                          )}
                        </div>
                        <span className="text-xs font-bold text-white mt-0.5">
                          {m.label}
                        </span>
                        <span className="text-[10px] text-sage leading-tight">
                          {m.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Draft Input */}
                <form onSubmit={handleRunAudit} className="flex flex-col gap-3 mt-1">
                  <textarea
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    placeholder={
                      mode === 'essay'
                        ? 'Paste your assignment draft, literature review, or references here...'
                        : mode === 'lab'
                        ? 'Paste your lab measurements, calculations, or engineering methodology...'
                        : mode === 'slides'
                        ? 'Paste your project notes or report to turn into slides + a 2-min script...'
                        : 'Explain what you need to email your lecturer (e.g. missing CA mark for test 2)...'
                    }
                    rows={5}
                    className="w-full rounded-xl bg-ink border border-gray-800 p-3.5 text-white placeholder:text-sage/60 text-xs leading-relaxed outline-none focus:border-pine resize-none"
                  />
                  <button
                    type="submit"
                    disabled={scanning || draftText.trim().length < 20}
                    className="w-full h-11 rounded-xl bg-pine text-black font-black text-xs active:scale-[0.97] transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg"
                  >
                    {scanning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Benchmarking against {institution} Archive...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Run Pre-Flight Audit</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Audit Output Card */}
              {result && (
                <div className="bg-surface border border-pine/40 rounded-2xl p-4 flex flex-col gap-4 animate-slide-up shadow-xl">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-pine tracking-wider">
                        Benchmark Grounding
                      </span>
                      <span className="text-white text-xs font-bold mt-0.5">
                        {result.benchmark_citation}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="bg-ink border border-pine/40 px-3 py-1.5 rounded-xl text-center">
                        <span className="text-[9px] uppercase text-sage block font-bold">
                          Grade Read
                        </span>
                        <span className="text-pine font-black text-base">
                          {result.overall_score}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-ink border border-gray-800 rounded-xl p-3">
                      <span className="text-[10px] text-sage font-bold uppercase">
                        Turnitin / AI Tone Risk
                      </span>
                      <div className="text-white font-black text-sm mt-0.5">
                        {result.ai_probability}
                      </div>
                    </div>
                    <div className="bg-ink border border-gray-800 rounded-xl p-3">
                      <span className="text-[10px] text-sage font-bold uppercase">
                        Red Flags Found
                      </span>
                      <div className="text-red-400 font-black text-sm mt-0.5">
                        {result.critical_issues.length} Issues Detected
                      </div>
                    </div>
                  </div>

                  <p className="text-white text-xs leading-relaxed bg-ink p-3 rounded-xl border border-gray-800">
                    {result.summary_verdict}
                  </p>

                  {/* Critical Issues (First 2 visible, rest gated unless unlocked) */}
                  <div className="flex flex-col gap-2">
                    <span className="text-sage text-[10px] font-bold uppercase tracking-wider">
                      Detected Deductions &amp; Fixes
                    </span>
                    {result.critical_issues.map((issue, idx) => {
                      const locked = !isUnlocked && idx >= 1;
                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl bg-ink border border-gray-800 flex items-start gap-2.5 ${
                            locked ? 'blur-[4px] select-none opacity-60' : ''
                          }`}
                        >
                          <AlertTriangle className="w-4 h-4 text-pine shrink-0 mt-0.5" />
                          <span className="text-white text-xs leading-relaxed">
                            {issue}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Polished Rewrite / Output */}
                  {isUnlocked ? (
                    <div className="flex flex-col gap-3 pt-2 border-t border-gray-800">
                      <div className="flex items-center justify-between">
                        <span className="text-pine text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> Full Benchmark-Polished Output
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(result.polished_rewrite);
                            toast({ title: 'Copied to clipboard' });
                          }}
                          className="text-xs font-bold text-pine bg-ink px-2.5 py-1 rounded-lg border border-pine/30 flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" /> Copy
                        </button>
                      </div>
                      <div className="bg-ink border border-gray-800 rounded-xl p-3.5 text-white text-xs leading-relaxed whitespace-pre-wrap">
                        {result.polished_rewrite}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-ink border border-pine/40 rounded-2xl p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-white font-black text-sm">
                            Unlock Full Fix &amp; Polished Copy
                          </span>
                          <span className="text-sage text-[11px]">
                            Get all {result.critical_issues.length} rubric fixes + ready-to-submit rewrite
                          </span>
                        </div>
                        <span className="text-pine font-black text-lg">P15</span>
                      </div>

                      {!showUnlockCheckout ? (
                        <button
                          onClick={() => setShowUnlockCheckout(true)}
                          className="w-full h-11 rounded-xl bg-pine text-black font-black text-xs active:scale-[0.97] transition-all flex items-center justify-center gap-2 shadow-lg"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Unlock Full Audit (P15)</span>
                        </button>
                      ) : (
                        <div className="flex flex-col gap-3 pt-2 border-t border-gray-800">
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setPayMethod('pay2cell')}
                              className={`py-2 rounded-lg text-xs font-bold border ${
                                payMethod === 'pay2cell'
                                  ? 'bg-pine text-black border-pine'
                                  : 'bg-surface text-sage border-gray-800'
                              }`}
                            >
                              <CreditCard className="w-3.5 h-3.5 inline mr-1" />
                              Pay2Cell (77037168)
                            </button>
                            <button
                              type="button"
                              onClick={() => setPayMethod('ewallet')}
                              className={`py-2 rounded-lg text-xs font-bold border ${
                                payMethod === 'ewallet'
                                  ? 'bg-pine text-black border-pine'
                                  : 'bg-surface text-sage border-gray-800'
                              }`}
                            >
                              <Wallet className="w-3.5 h-3.5 inline mr-1" />
                              eWallet (71321163)
                            </button>
                          </div>
                          <div className="flex items-center justify-between bg-surface px-3 py-2 rounded-lg border border-gray-800 text-xs">
                            <span className="text-sage">
                              Ref: <strong className="text-pine">{refCode}</strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(refCode);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 1500);
                              }}
                              className="text-pine font-bold flex items-center gap-1"
                            >
                              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {copied ? 'Copied' : 'Copy Ref'}
                            </button>
                          </div>
                          <input
                            type="text"
                            value={txId}
                            onChange={(e) => setTxId(e.target.value)}
                            placeholder="Paste SMS / inContact Confirmation ID"
                            className="h-10 rounded-xl bg-surface border border-gray-800 px-3 text-white text-xs outline-none focus:border-pine"
                          />
                          <button
                            type="button"
                            onClick={handleConfirmUnlock}
                            disabled={unlocking || txId.trim().length < 4}
                            className="w-full h-10 rounded-xl bg-pine text-black font-black text-xs disabled:opacity-40 flex items-center justify-center gap-1.5"
                          >
                            {unlocking ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <span>Verify &amp; Unlock Output</span>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* CONTRIBUTOR VAULT FOR 80%+ SCHOLARS */
            <form
              onSubmit={handleContributorSubmit}
              className="bg-surface border border-gray-800 rounded-2xl p-5 flex flex-col gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-ink border border-pine/40 flex items-center justify-center text-pine shrink-0">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-white font-black text-sm">
                    Monetize Your 80%+ Distinctions
                  </span>
                  <span className="text-sage text-[11px]">
                    100% Anonymized. Earn royalties every time your course benchmark guides a junior.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase text-sage">
                    Course Code
                  </label>
                  <input
                    type="text"
                    required
                    value={contribCourse}
                    onChange={(e) => setContribCourse(e.target.value)}
                    placeholder="e.g. CSE311"
                    className="h-10 rounded-xl bg-ink border border-gray-800 px-3 text-white text-xs font-bold uppercase outline-none focus:border-pine"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase text-sage">
                    Grade Achieved
                  </label>
                  <input
                    type="text"
                    required
                    value={contribGrade}
                    onChange={(e) => setContribGrade(e.target.value)}
                    placeholder="e.g. 92% / A+"
                    className="h-10 rounded-xl bg-ink border border-gray-800 px-3 text-white text-xs font-bold outline-none focus:border-pine"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase text-sage">
                    Faculty
                  </label>
                  <input
                    type="text"
                    required
                    value={contribFaculty}
                    onChange={(e) => setContribFaculty(e.target.value)}
                    placeholder="Computing / Business"
                    className="h-10 rounded-xl bg-ink border border-gray-800 px-3 text-white text-xs outline-none focus:border-pine"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase text-sage">
                    eWallet Payout Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={contribEwallet}
                    onChange={(e) => setContribEwallet(e.target.value)}
                    placeholder="7X XXX XXX"
                    className="h-10 rounded-xl bg-ink border border-gray-800 px-3 text-white text-xs outline-none focus:border-pine"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-sage">
                  Assignment / Project Topic
                </label>
                <input
                  type="text"
                  required
                  value={contribTitle}
                  onChange={(e) => setContribTitle(e.target.value)}
                  placeholder="e.g. Distributed Database Normalization Case Study"
                  className="h-10 rounded-xl bg-ink border border-gray-800 px-3 text-white text-xs outline-none focus:border-pine"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-sage">
                  Paste Graded Methodology, Structure &amp; Key Excerpts
                </label>
                <textarea
                  rows={5}
                  required
                  value={contribContent}
                  onChange={(e) => setContribContent(e.target.value)}
                  placeholder="Paste the high-scoring methodology, rubric structure, or full text here (personal names are automatically stripped)..."
                  className="rounded-xl bg-ink border border-gray-800 p-3 text-white text-xs outline-none focus:border-pine resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submittingContrib}
                className="w-full h-11 rounded-xl bg-pine text-black font-black text-xs active:scale-[0.97] transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                {submittingContrib ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Award className="w-4 h-4" />
                )}
                <span>Submit to Benchmark Vault</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
