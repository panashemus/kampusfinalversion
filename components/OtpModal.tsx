'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Loader as Loader2, MailCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function OtpModal({
  userId,
  email,
  onClose,
  onVerified,
}: {
  userId: string;
  email: string;
  onClose: () => void;
  onVerified: () => void;
}) {
  const { toast } = useToast();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const callEdge = async (payload: Record<string, unknown>) => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Request failed');
    return json;
  };

  const sendCode = async () => {
    setSending(true);
    try {
      await callEdge({ action: 'send-code', userId, email });
      setSent(true);
      toast({
        title: 'Code sent',
        description: `A 6-digit code was emailed to ${email}.`,
      });
    } catch (err) {
      toast({
        title: 'Could not send code',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleChange = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 5) inputsRef.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    pasted.split('').forEach((d, idx) => (next[idx] = d));
    setDigits(next);
    inputsRef.current[Math.min(pasted.length, 5)]?.focus();
  };

  const verify = async () => {
    const code = digits.join('');
    if (code.length !== 6) return;
    setVerifying(true);
    try {
      await callEdge({ action: 'verify-code', userId, code });
      
      // Tell the database they are officially verified
      await supabase
        .from('profiles')
        .update({ email_verified: true })
        .eq('id', userId);

      toast({
        title: 'Email verified',
        description: 'Your student email is now verified.',
      });
      onVerified();
    } catch (err) {
      toast({
        title: 'Verification failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  const codeComplete = digits.every((d) => d !== '');

  return (
    <div className="absolute inset-0 z-[3000] flex items-end">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-2xl p-6 flex flex-col gap-5 animate-slide-up max-h-[85%] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between">
          <span className="text-white font-black text-lg">Verify Your Email</span>
          <button onClick={onClose} aria-label="Close">
            <X className="w-5 h-5 text-sage" strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-pine/15 border border-pine/40 flex items-center justify-center">
            <MailCheck className="w-7 h-7 text-pine" strokeWidth={1.5} />
          </div>
          <p className="text-sage text-sm text-center leading-relaxed max-w-[280px]">
            We sent a 6-digit code to <span className="text-white font-bold">{email}</span>.
            Enter it below to verify your student email.
          </p>
        </div>

        <div className="flex justify-center gap-2" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputsRef.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-11 h-14 rounded-lg bg-ink border border-gray-800 text-center text-white text-2xl font-black outline-none focus:border-pine transition-colors"
            />
          ))}
        </div>

        <button
          onClick={verify}
          disabled={!codeComplete || verifying}
          className="w-full h-12 rounded-lg bg-pine text-black font-bold text-base active:scale-95 transition-transform disabled:opacity-40 disabled:active:scale-100 flex items-center justify-center gap-2"
        >
          {verifying && <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />}
          {verifying ? 'Verifying…' : 'Verify Email'}
        </button>

        <div className="flex items-center justify-between">
          <button
            onClick={sendCode}
            disabled={sending}
            className="text-sage text-xs font-bold hover:text-pine transition-colors disabled:opacity-50"
          >
            {sending ? 'Resending…' : 'Resend code'}
          </button>
          <button onClick={onClose} className="text-sage text-xs font-bold hover:text-red-400 transition-colors">
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
