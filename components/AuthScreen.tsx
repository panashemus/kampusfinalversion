'use client';

import { useState } from 'react';
import {
  ShieldCheck,
  Mail,
  Lock,
  Loader2,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { Profile } from '@/lib/types';

const WHITELIST_DOMAINS = [
  'ub.ac.bw',
  'thuto.bac.ac.bw',
  'bac.ac.bw',
  'botho.ac.bw',
  'student.botho.ac.bw',
  'buan.ac.bw',
  'student.buan.ac.bw',
  'biust.ac.bw',
  'student.biust.ac.bw',
];

const ADMIN_EMAILS = ['musungwa60@gmail.com', 'chrisvandium@gmail.com'];

const TEST_EMAILS = [
  'chrisvandium@gmail.com',
  'chris.karter1629@gmail.com',
  'yofather63@gmail.com',
  'makabongwekundai2000@gmail.com',
];

export default function AuthScreen({
  onVerified,
}: {
  onVerified: (profile: Profile) => void;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  const handleGuestLogin = () => {
    setGuestLoading(true);

    const guestId = `guest_${Math.random().toString(36).substring(2, 9)}`;
    const guestProfile: Profile = {
      id: guestId,
      email: 'guest@kampus.demo',
      email_verified: true,
      is_admin: false,
      ...({ username: 'Anonymous Guest', is_guest: true } as any),
    };

    setTimeout(() => {
      toast({
        title: 'Guest Mode Activated',
        description: 'Exploring Kampus in preview mode.',
      });
      onVerified(guestProfile);
      setGuestLoading(false);
    }, 600);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    let cleanEmail = email.trim().toLowerCase();

    if (cleanEmail.endsWith('@ac.ub.bw')) {
      cleanEmail = cleanEmail.replace('@ac.ub.bw', '@ub.ac.bw');
      setEmail(cleanEmail);
    }
    if (cleanEmail.endsWith('@ac.bac.bw')) {
      cleanEmail = cleanEmail.replace('@ac.bac.bw', '@bac.ac.bw');
      setEmail(cleanEmail);
    }

    if (!cleanEmail) return;

    const normalizedAdmins = ADMIN_EMAILS.map((a) => a.toLowerCase());
    const normalizedTests = TEST_EMAILS.map((t) => t.toLowerCase());

    const isWhitelisted =
      WHITELIST_DOMAINS.some((domain) => cleanEmail.endsWith(domain)) ||
      normalizedTests.includes(cleanEmail) ||
      normalizedAdmins.includes(cleanEmail);

    if (!isWhitelisted) {
      toast({
        title: 'Institutional email required',
        description:
          'Please use your university email (@ub.ac.bw, @bac.ac.bw, @botho.ac.bw, @biust.ac.bw, @buan.ac.bw).',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        if (error) throw error;

        if (data.user) {
          const isAdmin = normalizedAdmins.includes(cleanEmail);

          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              email: cleanEmail,
              is_admin: isAdmin,
              email_verified: true,
            })
            .select()
            .single();

          if (profileError) throw profileError;

          toast({
            title: 'Welcome to Kampus',
            description: 'Your verified student profile is ready.',
          });

          if (profileData) {
            onVerified(profileData as Profile);
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) throw error;

        if (data.user) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();

          if (profileError) throw profileError;

          if (profileData) {
            if (!profileData.email_verified) {
              const { data: updatedProfile } = await supabase
                .from('profiles')
                .update({ email_verified: true })
                .eq('id', data.user.id)
                .select()
                .single();

              if (updatedProfile) onVerified(updatedProfile as Profile);
            } else {
              onVerified(profileData as Profile);
            }
          } else {
            const isAdmin = normalizedAdmins.includes(cleanEmail);
            const { data: newProf } = await supabase
              .from('profiles')
              .insert({
                id: data.user.id,
                email: cleanEmail,
                is_admin: isAdmin,
                email_verified: true,
              })
              .select()
              .single();

            if (newProf) {
              onVerified(newProf as Profile);
            }
          }
        }
      }
    } catch (err: any) {
      if (
        err.message?.toLowerCase().includes('already registered') ||
        err.message?.toLowerCase().includes('already exists')
      ) {
        toast({
          title: 'Account already exists',
          description: 'Switching to Sign In for this email.',
          variant: 'destructive',
        });
        setIsSignUp(false);
      } else {
        toast({
          title: 'Authentication error',
          description: err.message || 'Check your credentials and try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-[#0B0F0E] flex flex-col items-center justify-center p-6 w-full h-[100dvh] relative">
      <div className="w-full max-w-[380px] bg-zinc-900/60 backdrop-blur-md ring-1 ring-white/[0.06] rounded-3xl p-7 flex flex-col gap-6 shadow-2xl">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <h1 className="text-white font-semibold text-2xl tracking-tight mt-1">
            Kampus
          </h1>
          <p className="text-zinc-400 text-xs">
            Verified student safety, marketplace & community
          </p>
        </div>

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-400 text-xs font-medium">
              Student Email
            </label>
            <div className="relative flex items-center">
              <Mail
                className="absolute left-3.5 w-4 h-4 text-zinc-500"
                strokeWidth={1.75}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@ub.ac.bw"
                required
                className="w-full h-11 rounded-xl bg-zinc-950/90 ring-1 ring-white/[0.07] pl-10 pr-4 text-white placeholder:text-zinc-500 text-sm outline-none focus:ring-emerald-700/50 transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-400 text-xs font-medium">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock
                className="absolute left-3.5 w-4 h-4 text-zinc-500"
                strokeWidth={1.75}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full h-11 rounded-xl bg-zinc-950/90 ring-1 ring-white/[0.07] pl-10 pr-4 text-white placeholder:text-zinc-500 text-sm outline-none focus:ring-emerald-700/50 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || guestLoading}
            className="w-full h-11 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-sm active:scale-[0.98] transition-all duration-150 ease-out disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm mt-1"
          >
            {loading && (
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
            )}
            <span>{isSignUp ? 'Create Student Account' : 'Sign In'}</span>
            {!loading && <ArrowRight className="w-4 h-4" strokeWidth={2} />}
          </button>
        </form>

        <div className="flex flex-col gap-3 pt-3 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-zinc-400 text-xs hover:text-white transition-colors font-medium text-center"
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Create one"}
          </button>

          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={loading || guestLoading}
            className="w-full h-10 rounded-xl bg-zinc-950/70 ring-1 ring-white/[0.07] hover:bg-zinc-900 text-zinc-300 hover:text-white text-xs font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            {guestLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : (
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>Explore in Guest Mode (Preview)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
