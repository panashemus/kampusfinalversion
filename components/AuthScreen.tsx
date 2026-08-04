'use client';

import { useState } from 'react';
import { Lock, Shield, Medal, Loader as Loader2, CircleAlert as AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

const WHITELIST_DOMAINS = ['@ub.ac.bw', '@thuto.bac.ac.bw', '@bac.ac.bw', '@botho.ac.bw];

// Only full admins get admin privileges
const ADMIN_EMAILS = ['musungwa60@gmail.com'];

// Test accounts allowed to bypass domain locks but do NOT get admin rights
const TEST_EMAILS = [
  'chrisvandium@gmail.com',
  'chris.karter1629@gmail.com',
  'jasonkramer411@gmail.com',
  'tlhakanelolethabo@gmail.com',
];

function isWhitelisted(email: string) {
  const lower = email.toLowerCase().trim();
  return (
    ADMIN_EMAILS.includes(lower) ||
    TEST_EMAILS.includes(lower) ||
    WHITELIST_DOMAINS.some((d) => lower.endsWith(d))
  );
}

export default function AuthScreen({
  onVerified,
}: {
  onVerified: (profile: Profile) => void;
}) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Custom OTP State
  const [pendingOtp, setPendingOtp] = useState<{ userId: string; email: string } | null>(null);
  const [expectedCode, setExpectedCode] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  
  // Username State
  const [username, setUsername] = useState('');
  const [usernameStep, setUsernameStep] = useState(false);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);

  // Helper to trigger our custom Resend API
  const sendKampusCode = async (userEmail: string) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setExpectedCode(code);
    
    await fetch('/api/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, code }),
    });
  };

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Enter your email and password.');
      return;
    }
    if (!isWhitelisted(email)) {
      setError('Registration is currently restricted to verified UB and BAC student emails.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const isTestUser = ADMIN_EMAILS.includes(cleanEmail) || TEST_EMAILS.includes(cleanEmail);
      const isTrustedDevice = typeof window !== 'undefined' ? localStorage.getItem(`kampus_trusted_${cleanEmail}`) === 'true' : false;

      if (mode === 'signup') {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (signUpErr) {
          if (
            signUpErr.message.toLowerCase().includes('already') ||
            signUpErr.message.toLowerCase().includes('registered')
          ) {
            const { data: signInData, error: signInErr } =
              await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
              });
            
            if (signInErr) {
              setError('An account with this email already exists. Please sign in or use the correct password.');
              setMode('signin');
              return;
            }
            
            const existingUserId = signInData.user?.id;
            if (!existingUserId) return;
            
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', existingUserId)
              .maybeSingle();
              
            // Bypass OTP if already verified, on a trusted device, or using a test account
            if (existingProfile && ((existingProfile as Profile).email_verified || isTrustedDevice || isTestUser)) {
              // Ensure DB is updated just in case it was out of sync
              if (!(existingProfile as Profile).email_verified) {
                await supabase.from('profiles').update({ email_verified: true }).eq('id', existingUserId);
              }
              if (typeof window !== 'undefined') localStorage.setItem(`kampus_trusted_${cleanEmail}`, 'true');
              onVerified(existingProfile as Profile);
              return;
            }
            
            await supabase.auth.signOut();
            await sendKampusCode(email.trim()); // SEND THE CODE
            setPendingOtp({ userId: existingUserId, email: email.trim() });
            return;
          }
          throw signUpErr;
        }

        const userId = data.user?.id;
        if (!userId) throw new Error('Account creation failed.');

        // For brand new signups using test accounts, auto-verify immediately
        if (isTestUser) {
          await supabase.from('profiles').update({ email_verified: true }).eq('id', userId);
          if (typeof window !== 'undefined') localStorage.setItem(`kampus_trusted_${cleanEmail}`, 'true');
          
          const { data: newProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
            
          onVerified(newProfile as Profile);
          return;
        }

        await supabase.auth.signOut();
        
        await sendKampusCode(email.trim()); // SEND THE CODE
        setPendingOtp({ userId, email: email.trim() });
        
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInErr) throw signInErr;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No session returned.');
        
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
          
        if (profileErr) throw profileErr;

        // Same bypass logic for signing in
        if (!(profile as Profile).email_verified && !isTrustedDevice && !isTestUser) {
          await supabase.auth.signOut();
          await sendKampusCode(email.trim()); 
          setPendingOtp({ userId: user.id, email: email.trim() });
        } else {
          // Sync DB to true if they got past the gate
          if (!(profile as Profile).email_verified) {
            await supabase.from('profiles').update({ email_verified: true }).eq('id', user.id);
          }
          if (typeof window !== 'undefined') localStorage.setItem(`kampus_trusted_${cleanEmail}`, 'true');
          onVerified(profile as Profile);
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpVerified = async () => {
    if (!pendingOtp) return;
    const currentUserId = pendingOtp.userId;
    const currentEmail = pendingOtp.email;
    setPendingOtp(null);

    // 1. SIGN THE USER IN FIRST! (This ensures RLS allows the profile update below)
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: email.trim() || currentEmail,
      password,
    });

    if (signInErr) {
      setError(signInErr.message);
      return;
    }

    // 2. NOW update the database to officially mark them as verified
    await supabase
      .from('profiles')
      .update({ email_verified: true })
      .eq('id', currentUserId);

    // 3. Save trusted device token so they never get asked for this email again
    if (typeof window !== 'undefined') {
      localStorage.setItem(`kampus_trusted_${(email.trim() || currentEmail).toLowerCase()}`, 'true');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUserId)
      .maybeSingle();

    if (!profile?.username) {
      setActiveUserId(currentUserId);
      setUsernameStep(true);
    } else {
      onVerified(profile as Profile);
    }
  };

  const handleUsernameConfirm = async () => {
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9._]/g, '');
    if (clean.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    setUsernameChecking(true);
    
    const { data } = await supabase.from('profiles').select('id').eq('username', clean).maybeSingle();
    if (data) {
      setError('That username is already taken. Try another one.');
      setUsernameChecking(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id || activeUserId;

    if (!uid) {
      setError('Session lost, please log in.');
      setUsernameChecking(false);
      return;
    }

    await supabase.from('profiles').update({ username: clean }).eq('id', uid);

    const { data: updatedProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    setUsernameChecking(false);
    setUsernameStep(false);

    if (updatedProfile) {
      onVerified(updatedProfile as Profile);
    }
  };

  // --- 1. CUSTOM OTP SCREEN ---
  if (pendingOtp) {
    return (
      <div className="min-h-screen bg-midnight flex justify-center">
        <div className="w-full max-w-[430px] min-h-screen flex flex-col">
          <header className="p-6 flex items-center gap-2.5">
            <span className="text-white font-black tracking-tight uppercase text-2xl">KAMPUS</span>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
            <div className="w-full max-w-sm">
              <h2 className="text-white text-2xl font-extrabold text-center mb-2">Verify Your Student Email</h2>
              <p className="text-sage text-sm text-center mb-6">
                We sent a 6-digit code to <span className="text-white font-bold">{pendingOtp.email}</span>.
              </p>
              
              <div className="flex flex-col gap-4">
                <input
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => {
                    setOtpInput(e.target.value.replace(/\D/g, ''));
                    setError(null);
                  }}
                  placeholder="••••••"
                  className="bg-ink rounded-lg h-14 w-full border border-gray-800 text-white text-center tracking-[1em] text-2xl font-bold outline-none focus:border-pine transition-colors"
                />
                
                {error && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-900/30 border border-red-700/50 px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" strokeWidth={2} />
                    <span className="text-red-400 text-xs font-bold">{error}</span>
                  </div>
                )}

                <button
                  onClick={() => {
                    if (otpInput === expectedCode) {
                      handleOtpVerified();
                    } else {
                      setError('Invalid verification code. Please try again.');
                    }
                  }}
                  disabled={otpInput.length !== 6}
                  className="w-full h-12 rounded-lg bg-pine text-black font-bold text-base active:scale-95 transition-transform disabled:opacity-60"
                >
                  Verify Email
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- 2. USERNAME SCREEN ---
  if (usernameStep) {
    return (
      <div className="min-h-screen bg-midnight flex justify-center">
        <div className="w-full max-w-[430px] min-h-screen flex flex-col">
          <header className="p-6 flex items-center gap-2.5">
            <span className="text-white font-black tracking-tight uppercase text-2xl">KAMPUS</span>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
            <div className="w-full max-w-sm">
              <h2 className="text-white text-2xl font-extrabold text-center mb-2">Choose Your @username</h2>
              <div className="flex flex-col gap-4">
                <div className="flex items-center bg-ink rounded-lg h-12 px-4 border border-gray-800 focus-within:border-pine">
                  <span className="text-sage text-sm font-bold">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setError(null);
                    }}
                    placeholder="yourname"
                    maxLength={20}
                    className="flex-1 bg-transparent text-white text-sm outline-none ml-1"
                  />
                </div>
                {error && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-900/30 border border-red-700/50 px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" strokeWidth={2} />
                    <span className="text-red-400 text-xs font-bold">{error}</span>
                  </div>
                )}
                <button
                  onClick={handleUsernameConfirm}
                  disabled={usernameChecking || username.trim().length < 3}
                  className="w-full h-12 rounded-lg bg-pine text-black font-bold text-base active:scale-95 transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {usernameChecking && <Loader2 className="w-5 h-5 animate-spin" />}
                  {usernameChecking ? 'Checking...' : 'Continue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- DEFAULT LANDING / FORM ---
  return (
    <div className="min-h-screen bg-midnight flex justify-center">
      <div className="w-full max-w-[430px] min-h-screen flex flex-col">
        <header className="p-6 flex items-center justify-between">
          <span className="text-white font-black tracking-tight uppercase text-2xl">KAMPUS</span>
          <div className="rounded-full border border-sage px-2 py-1">
            <span className="text-sage uppercase text-[10px] font-bold">BOTSWANA BETA</span>
          </div>
        </header>

        <section className="px-6 pb-8">
          <h1 className="text-white text-5xl font-extrabold leading-tight">
            Don&apos;t Walk <br />
            <span className="relative inline-block">
              Alone. <span className="absolute left-0 right-0 -bottom-1 h-1 bg-pine" />
            </span>
          </h1>
          <p className="mt-4 text-sage text-base">
            Your verified student safety network for UB and BAC — campus radar, secure escrow trades, and peer-to-peer community support.
          </p>
        </section>

        <section className="mx-6">
          <div className="bg-surface rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setMode('signup')}
                className={`flex-1 h-10 rounded-lg text-xs font-bold transition-colors ${mode === 'signup' ? 'bg-pine text-black' : 'bg-ink text-sage border border-gray-800'}`}
              >
                Create Account
              </button>
              <button
                onClick={() => setMode('signin')}
                className={`flex-1 h-10 rounded-lg text-xs font-bold transition-colors ${mode === 'signin' ? 'bg-pine text-black' : 'bg-ink text-sage border border-gray-800'}`}
              >
                Sign In
              </button>
            </div>

            <span className="uppercase text-xs font-bold tracking-wider text-sage">STUDENT VERIFICATION</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.name@ub.ac.bw or @bac.ac.bw"
              className="bg-ink rounded-lg h-12 w-full px-4 border border-gray-800 text-white outline-none focus:border-sage"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 characters)"
              className="bg-ink rounded-lg h-12 w-full px-4 border border-gray-800 text-white outline-none focus:border-sage"
            />

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-900/30 border border-red-700/50 px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" strokeWidth={2} />
                <span className="text-red-400 text-xs font-bold">{error}</span>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-12 rounded-lg bg-pine text-black font-bold text-base active:scale-95 transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-5 h-5 animate-spin" />}
              {submitting ? 'Please wait…' : mode === 'signup' ? 'Create Account & Verify' : 'Sign In'}
            </button>
          </div>
        </section>

        <section className="mx-6 mt-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface rounded-xl p-4 flex flex-col items-center justify-center text-center">
              <Lock className="w-6 h-6 text-pine" />
              <p className="text-sage text-xs mt-2">Student-only<br />access</p>
            </div>
            <div className="bg-surface rounded-xl p-4 flex flex-col items-center justify-center text-center">
              <Shield className="w-6 h-6 text-pine" />
              <p className="text-sage text-xs mt-2">P2P escrow<br />trades</p>
            </div>
            <div className="bg-surface rounded-xl p-4 flex flex-col items-center justify-center text-center">
              <Medal className="w-6 h-6 text-[#E8A33D]" />
              <p className="text-sage text-xs mt-2">Monthly cash<br />rewards</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
