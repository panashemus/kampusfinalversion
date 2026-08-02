'use client';

import { useState } from 'react';
import { Lock, Shield, Medal, Loader as Loader2, CircleAlert as AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import OtpModal from '@/components/OtpModal';

const WHITELIST_DOMAINS = ['@ub.ac.bw', '@bac.ac.bw'];
const ADMIN_EMAILS = [
  'musungwa60@gmail.com',
  'chrisvandium@gmail.com',
  'chris.karter1629@gmail.com',
];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isWhitelisted(email: string) {
  const lower = email.toLowerCase().trim();
  return (
    ADMIN_EMAILS.includes(lower) ||
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
  
  // Pending OTP state
  const [pendingOtp, setPendingOtp] = useState<{ userId: string; email: string } | null>(null);
  
  // Username state
  const [username, setUsername] = useState('');
  const [usernameStep, setUsernameStep] = useState(false);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Enter your email and password.');
      return;
    }
    if (!isWhitelisted(email)) {
      setError(
        'Registration is currently restricted to verified UB and BAC student emails.'
      );
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
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
              setError(
                'An account with this email already exists. Please sign in or use the correct password.'
              );
              setMode('signin');
              return;
            }
            const existingUserId = signInData.user?.id;
            if (!existingUserId) {
              setError('Account exists. Please sign in.');
              setMode('signin');
              return;
            }
            
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', existingUserId)
              .maybeSingle();
              
            if (existingProfile && (existingProfile as Profile).email_verified) {
              onVerified(existingProfile as Profile);
              return;
            }
            
            await supabase.auth.signOut();
            setPendingOtp({ userId: existingUserId, email: email.trim() });
            return;
          }
          throw signUpErr;
        }

        const userId = data.user?.id;
        if (!userId) throw new Error('Account creation failed — no user returned.');

        await supabase.auth.signOut();

        // 1. STEP ONE: TRIGGER OTP FIRST IMMEDIATELY AFTER SIGNUP
        setPendingOtp({ userId, email: email.trim() });
      } else {
        // Sign-in flow
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInErr) {
          if (signInErr.message.toLowerCase().includes('invalid login')) {
            setError('No account found with these credentials. Please create an account.');
            setMode('signup');
            return;
          }
          throw signInErr;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('No session returned.');
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        if (profileErr) throw profileErr;
        if (!profile) throw new Error('Profile not found.');

        if (!(profile as Profile).email_verified) {
          await supabase.auth.signOut();
          setPendingOtp({ userId: user.id, email: email.trim() });
        } else {
          onVerified(profile as Profile);
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Called after OTP is entered successfully
  const handleOtpVerified = async () => {
    if (!pendingOtp) return;
    const currentUserId = pendingOtp.userId;
    setPendingOtp(null);

    // Sign in to check if username is already configured
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: email.trim() || pendingOtp.email,
      password,
    });

    if (signInErr) {
      setError(signInErr.message);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUserId)
      .maybeSingle();

    // 2. STEP TWO: IF NO USERNAME IS SET YET, PROMPT FOR USERNAME
    if (!profile?.username) {
      setActiveUserId(currentUserId);
      setUsernameStep(true);
    } else {
      if (profile) onVerified(profile as Profile);
    }
  };

  const checkUsername = async (): Promise<boolean> => {
    if (!username.trim()) return false;
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.trim().toLowerCase())
      .maybeSingle();
    return !data;
  };

  const handleUsernameConfirm = async () => {
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9._]/g, '');
    if (clean.length < 3) {
      setError('Username must be at least 3 characters (letters, numbers, dots, underscores).');
      return;
    }
    setUsernameChecking(true);
    const available = await checkUsername();
    if (!available) {
      setError('That username is already taken. Try another one.');
      setUsernameChecking(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id || activeUserId;

    if (!uid) {
      setError('Could not set username. Session lost, please log in.');
      setUsernameChecking(false);
      return;
    }

    // Save username directly to profile
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ username: clean })
      .eq('id', uid);

    if (updateErr) {
      setError('Could not set username: ' + updateErr.message);
      setUsernameChecking(false);
      return;
    }

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

  // --- 1. OTP SCREEN (SHOWS FIRST) ---
  if (pendingOtp) {
    return (
      <div className="min-h-screen bg-midnight flex justify-center">
        <div className="w-full max-w-[430px] min-h-screen flex flex-col">
          <header className="p-6 flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-surface flex items-center justify-center overflow-hidden">
              <img
                src="/images/ClipSnap_20260723201232.png"
                alt="Kampus logo"
                className="h-7 w-7 object-contain"
              />
            </div>
            <span className="text-white font-black tracking-tight uppercase text-2xl">
              KAMPUS
            </span>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
            <div className="w-full max-w-sm">
              <h2 className="text-white text-2xl font-extrabold text-center mb-2">
                Verify Your Student Email
              </h2>
              <p className="text-sage text-sm text-center mb-6 leading-relaxed">
                We sent a 6-digit code to{' '}
                <span className="text-white font-bold">{pendingOtp.email}</span>.
                Enter it below to activate your Kampus account.
              </p>
              <OtpModal
                userId={pendingOtp.userId}
                email={pendingOtp.email}
                onClose={() => setPendingOtp(null)}
                onVerified={handleOtpVerified}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- 2. USERNAME SCREEN (SHOWS SECOND) ---
  if (usernameStep) {
    return (
      <div className="min-h-screen bg-midnight flex justify-center">
        <div className="w-full max-w-[430px] min-h-screen flex flex-col">
          <header className="p-6 flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-surface flex items-center justify-center overflow-hidden">
              <img
                src="/images/ClipSnap_20260723201232.png"
                alt="Kampus logo"
                className="h-7 w-7 object-contain"
              />
            </div>
            <span className="text-white font-black tracking-tight uppercase text-2xl">
              KAMPUS
            </span>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
            <div className="w-full max-w-sm">
              <h2 className="text-white text-2xl font-extrabold text-center mb-2">
                Choose Your @username
              </h2>
              <p className="text-sage text-sm text-center mb-6 leading-relaxed">
                This is how other students will see you across posts, comments, and marketplace listings.
              </p>
              <div className="flex flex-col gap-4">
                <div className="flex items-center bg-ink rounded-lg h-12 px-4 border border-gray-800 focus-within:border-pine transition-colors">
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
                    className="flex-1 bg-transparent text-white text-sm outline-none ml-1 placeholder:text-sage/60"
                  />
                </div>
                {error && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-900/30 border border-red-700/50 px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" strokeWidth={2} />
                    <span className="text-red-400 text-xs font-bold leading-snug">{error}</span>
                  </div>
                )}
                <button
                  onClick={handleUsernameConfirm}
                  disabled={usernameChecking || username.trim().length < 3}
                  className="w-full h-12 rounded-lg bg-pine text-black font-bold text-base active:scale-95 transition-transform disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2"
                >
                  {usernameChecking && <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />}
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
        {/* Top Header */}
        <header className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-surface flex items-center justify-center overflow-hidden">
              <img
                src="/images/ClipSnap_20260723201232.png"
                alt="Kampus logo"
                className="h-7 w-7 object-contain"
              />
            </div>
            <span className="text-white font-black tracking-tight uppercase text-2xl">
              KAMPUS
            </span>
          </div>
          <div className="rounded-full border border-sage px-2 py-1">
            <span className="text-sage uppercase text-[10px] font-bold">
              BOTSWANA BETA
            </span>
          </div>
        </header>

        {/* Hero Section */}
        <section className="px-6 pb-8">
          <h1 className="text-white text-5xl font-extrabold leading-tight">
            Don&apos;t Walk
            <br />
            <span className="relative inline-block">
              Alone.
              <span className="absolute left-0 right-0 -bottom-1 h-1 bg-pine" />
            </span>
          </h1>
          <p className="mt-4 text-sage text-base leading-relaxed">
            Your verified student safety network for UB and BAC — campus radar,
            secure escrow trades, and peer-to-peer community support.
          </p>
        </section>

        {/* Verification Card */}
        <section className="mx-6">
          <div className="bg-surface rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setMode('signup')}
                className={`flex-1 h-10 rounded-lg text-xs font-bold transition-colors ${
                  mode === 'signup'
                    ? 'bg-pine text-black'
                    : 'bg-ink text-sage border border-gray-800'
                }`}
              >
                Create Account
              </button>
              <button
                onClick={() => setMode('signin')}
                className={`flex-1 h-10 rounded-lg text-xs font-bold transition-colors ${
                  mode === 'signin'
                    ? 'bg-pine text-black'
                    : 'bg-ink text-sage border border-gray-800'
                }`}
              >
                Sign In
              </button>
            </div>

            <span className="uppercase text-xs font-bold tracking-wider text-sage">
              STUDENT VERIFICATION
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.name@ub.ac.bw or @bac.ac.bw"
              required
              className="bg-ink rounded-lg h-12 w-full px-4 border border-gray-800 text-white placeholder:text-sage outline-none focus:border-sage transition-colors"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 characters)"
              required
              minLength={6}
              className="bg-ink rounded-lg h-12 w-full px-4 border border-gray-800 text-white placeholder:text-sage outline-none focus:border-sage transition-colors"
            />

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-900/30 border border-red-700/50 px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" strokeWidth={2} />
                <span className="text-red-400 text-xs font-bold leading-snug">{error}</span>
              </div>
            )}

            <p className="text-[10px] text-sage">
              Registration is restricted to verified UB and BAC student emails.
              You will receive a 6-digit verification code by email after
              signing up.
            </p>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-12 rounded-lg bg-pine text-black font-bold text-base active:scale-95 transition-transform disabled:opacity-60 disabled:active:scale-100 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />}
              {submitting
                ? 'Please wait…'
                : mode === 'signup'
                ? 'Create Account & Verify'
                : 'Sign In'}
            </button>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="mx-6 mt-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface rounded-xl p-4 flex flex-col items-center justify-center text-center">
              <Lock className="w-6 h-6 text-pine" strokeWidth={1.5} />
              <p className="text-sage text-xs mt-2 leading-tight">
                Student-only
                <br />
                access
              </p>
            </div>
            <div className="bg-surface rounded-xl p-4 flex flex-col items-center justify-center text-center">
              <Shield className="w-6 h-6 text-pine" strokeWidth={1.5} />
              <p className="text-sage text-xs mt-2 leading-tight">
                P2P escrow
                <br />
                trades
              </p>
            </div>
            <div className="bg-surface rounded-xl p-4 flex flex-col items-center justify-center text-center">
              <Medal className="w-6 h-6" strokeWidth={1.5} style={{ color: '#E8A33D' }} />
              <p className="text-sage text-xs mt-2 leading-tight">
                Monthly cash
                <br />
                rewards
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
