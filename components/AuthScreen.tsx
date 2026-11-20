'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, MailCheck } from 'lucide-react';
import KampusLogo from '@/components/KampusLogo';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { loadMyProfile } from '@/lib/profile';
import type { Profile } from '@/lib/types';

const domains = ['ub.ac.bw', 'student.boitekanelo.ac.bw', 'mopipi.ub.bw', 'student.ub.ac.bw', 'bac.ac.bw', 'thuto.bac.ac.bw', 'bsbs.ac.bw', 'biust.ac.bw', 'student.biust.ac.bw', 'botho.ac.bw', 'student.botho.ac.bw', 'buan.ac.bw', 'student.buan.ac.bw'];

export default function AuthScreen({
  onVerified,
  onExplore,
}: {
  onVerified: (p: Profile) => void;
  onExplore?: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [course, setCourse] = useState('');
  const [signup, setSignup] = useState(false);
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [pendingEmail, setPendingEmail] = useState('');
  const [code, setCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timeout = window.setTimeout(() => setResendCooldown(n => Math.max(0, n - 1)), 1000);
    return () => window.clearTimeout(timeout);
  }, [resendCooldown]);

  const completeSignIn = async () => {
    const profile = await loadMyProfile();
    if (!profile?.email_verified || !profile?.verified) {
      throw new Error('Your student email is not yet confirmed or eligible. Check your university inbox.');
    }
    onVerified(profile);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const clean = email.trim().toLowerCase();
    try {
      if (!isSupabaseConfigured) throw new Error('Sign-in is temporarily unavailable. You can keep exploring the preview.');
      if (signup && !domains.includes(clean.split('@')[1])) {
        throw new Error('Use your university email to register as a student. Everyone can explore the public preview.');
      }
      if (signup) {
        const next = sessionStorage.getItem('kampus:return') || '#community';
        const redirect = new URL('/', location.origin);
        redirect.searchParams.set('returnTo', next);
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: clean,
          password,
          options: {
            emailRedirectTo: redirect.href,
            data: { course_code: course.trim().slice(0, 120) },
          },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setPendingEmail(clean);
          setCode('');
          setStep('verify');
          setResendCooldown(45);
          setNotice('Verification code requested. If it does not arrive, check spam, confirm the address and ask your university IT desk whether the mailbox accepts external mail.');
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: clean, password });
        if (signInError) throw signInError;
      }
      await completeSignIn();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      if (!signup && /email[\s_-]*not[\s_-]*confirmed/i.test(message)) {
        setPendingEmail(clean);
        setCode('');
        setStep('verify');
        setResendCooldown(0);
        setNotice('Your student email is still unconfirmed. Enter the code previously emailed to you, or request a new one.');
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (!/^\d{6}$/.test(code)) throw new Error('Enter the six-digit code from your email.');
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token: code,
        type: 'email',
      });
      if (verifyError) throw verifyError;
      if (!data.session) {
        setStep('form');
        setSignup(false);
        setEmail(pendingEmail);
        setNotice('Your email is verified. Sign in with your password to continue.');
        return;
      }
      await completeSignIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Request a new code and try again.');
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    if (resendCooldown > 0 || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: pendingEmail });
      if (resendError) throw resendError;
      setCode('');
      setResendCooldown(60);
      setNotice('New code requested. Check spam or junk and use the newest code. If it still does not arrive, your university mailbox may be rejecting delivery: verify its spelling and contact university IT.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend a code right now. Please try again later.');
    } finally {
      setBusy(false);
    }
  };

  const returnToForm = () => {
    setStep('form');
    setEmail(pendingEmail || email);
    setCode('');
    setError('');
    setNotice('');
  };

  // A university mailbox can reject a message *after* SMTP accepts it.
  // Let someone with an unverified account correct a typo or use another
  // active, approved student address. Do not bypass ownership verification.
  const correctUnreachableEmail = () => {
    setStep('form');
    setSignup(true);
    setEmail(pendingEmail || email);
    setPendingEmail('');
    setCode('');
    setResendCooldown(0);
    setError('');
    setNotice('Check the address carefully. If your university inbox is unavailable, use another active university-issued email. A new address must receive and confirm its own code.');
  };

  return (
    <main className="min-h-[100dvh] w-full bg-midnight text-white overflow-y-auto grid place-items-center p-5">
      <div className="w-full max-w-md rounded-3xl border border-gray-800 bg-surface p-7 space-y-6">
        <button type="button" onClick={step === 'verify' ? returnToForm : onExplore} className="min-h-11 flex items-center gap-2 text-sage text-sm">
          <ArrowLeft size={18} />{step === 'verify' ? 'Back to account details' : 'Back to exploring'}
        </button>
        <KampusLogo className="h-16 w-auto" />
        {step === 'verify' ? (
          <>
            <div className="space-y-2">
              <MailCheck className="text-pine" size={30} aria-hidden="true" />
              <h1 className="text-3xl font-black">Verify your student email</h1>
              <p className="text-sage text-sm">Enter the 6-digit code requested for <span className="font-semibold text-white break-all">{pendingEmail}</span>.</p>
              <p className="text-sage text-xs">Check spam or junk if you do not see it. Codes expire, so use the newest email.</p>
            </div>
            <form onSubmit={verify} className="space-y-4">
              <label className="block text-sm">
                Verification code
                <input
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="foundation-input mt-2 text-center tracking-[0.4em] text-xl"
                />
              </label>
              {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
              {notice && <p role="status" className="text-pine text-sm">{notice}</p>}
              <button className="foundation-primary w-full" disabled={busy || code.length !== 6}>
                {busy ? 'Checking…' : 'Confirm email and continue'}
              </button>
            </form>
            <button type="button" disabled={busy || resendCooldown > 0} onClick={resendCode} className="min-h-11 text-sage text-sm underline disabled:opacity-50">
              {resendCooldown > 0 ? 'Request another code in ' + resendCooldown + 's' : 'Didn’t receive it? Resend code'}
            </button>
            <div className="rounded-xl border border-sage/25 bg-midnight/40 p-3 space-y-2">
              <p className="text-xs text-sage">No email after checking spam? Student mailboxes sometimes reject external messages even when Kampus successfully requests delivery. Confirm you can access that mailbox and ask your university IT desk if needed.</p>
              <button type="button" onClick={correctUnreachableEmail} disabled={busy} className="min-h-11 text-left text-sm text-pine underline disabled:opacity-50">
                Wrong email or inbox not working? Use another student email
              </button>
            </div>
            <p className="text-xs text-sage">A new address must be verified before account access is granted. If your email is already confirmed, go back and sign in.</p>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-3xl font-black">Your campus. Connected.</h1>
              <p className="text-sage mt-2">{signup ? 'Join with your university email.' : 'Welcome back to Kampus.'}</p>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <label className="block text-sm">Email
                <input autoComplete="email" type="email" required value={email} onChange={event => setEmail(event.target.value)} className="foundation-input mt-2" />
              </label>
              {signup && <label className="block text-sm">Course or programme <span className="text-sage">(optional)</span>
                <input maxLength={120} value={course} onChange={event => setCourse(event.target.value)} className="foundation-input mt-2" />
              </label>}
              <label className="block text-sm">Password
                <input autoComplete={signup ? 'new-password' : 'current-password'} type="password" required minLength={signup ? 8 : 6} value={password} onChange={event => setPassword(event.target.value)} className="foundation-input mt-2" />
              </label>
              {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
              {notice && <p role="status" className="text-pine text-sm">{notice}</p>}
              <button disabled={busy} className="foundation-primary w-full">{busy ? 'Please wait…' : signup ? 'Create student account' : 'Sign in'}</button>
            </form>
            <button type="button" className="min-h-11 text-sage text-sm underline" onClick={() => { setSignup(!signup); setError(''); setNotice(''); }}>
              {signup ? 'Already registered? Sign in' : 'New to Kampus? Create an account'}
            </button>
            <p className="text-xs text-sage">New students receive a six-digit email confirmation code. Posting, messaging and private information require a verified student account.</p>
          </>
        )}
      </div>
    </main>
  );
}
