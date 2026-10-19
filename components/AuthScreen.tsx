'use client';

import { useState } from 'react';
import {
  ShieldCheck,
  Mail,
  Lock,
  Loader2,
  ArrowRight,
  GraduationCap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { classifyUniversity } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Profile } from '@/lib/types';

const WHITELIST_DOMAINS = [
  'ub.ac.bw',
  'mopipi.ub.bw',
  'student.ub.ac.bw',
  'thuto.bac.ac.bw',
  'bac.ac.bw',
  'bsbs.ac.bw',
  'biust.ac.bw',
  'student.biust.ac.bw',
  'botho.ac.bw',
  'student.botho.ac.bw',
  'buan.ac.bw',
  'student.buan.ac.bw',
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
  const [courseCode, setCourseCode] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const detectedSchool = classifyUniversity(email);

  const hydrateOrCreateProfile = async (
    userId: string,
    cleanEmail: string,
    isAdmin: boolean
  ): Promise<Profile> => {
    const school = classifyUniversity(cleanEmail);
    const defaultUsername = cleanEmail.split('@')[0];

    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (existing) {
      const updates: Record<string, any> = {
        email_verified: true,
        verified: true,
        university: existing.university || school.fullName,
      };
      if (courseCode.trim() && !existing.course_code) {
        updates.course_code = courseCode.trim().toUpperCase();
      }
      if (!existing.username) {
        updates.username = defaultUsername;
      }

      const { data: updated } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .maybeSingle();

      return (updated || { ...existing, ...updates }) as Profile;
    }

    const newProfilePayload = {
      id: userId,
      email: cleanEmail,
      username: defaultUsername,
      university: school.fullName,
      course_code: courseCode.trim()
        ? courseCode.trim().toUpperCase()
        : null,
      is_admin: isAdmin,
      verified: true,
      email_verified: true,
    };

    const { data: inserted } = await supabase
      .from('profiles')
      .upsert(newProfilePayload)
      .select()
      .maybeSingle();

    return (inserted || {
      ...newProfilePayload,
      avatar_url: null,
      is_premium: isAdmin,
      subscribed_until: null,
      sentinel_points: 0,
      ewallet_number: '',
    }) as Profile;
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
      WHITELIST_DOMAINS.some(
        (domain) =>
          cleanEmail.endsWith(`@${domain}`) || cleanEmail.endsWith(`.${domain}`)
      ) ||
      normalizedTests.includes(cleanEmail) ||
      normalizedAdmins.includes(cleanEmail);

    if (!isWhitelisted) {
      toast({
        title: 'Verified Student Email Required',
        description:
          'Sign in with your institutional email (@ub.ac.bw, @bac.ac.bw, @biust.ac.bw, @botho.ac.bw, or @buan.ac.bw).',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const isAdmin = normalizedAdmins.includes(cleanEmail);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        // If student already registered previously, seamlessly sign them in
        if (
          error &&
          (error.message?.toLowerCase().includes('already registered') ||
            error.message?.toLowerCase().includes('already exists'))
        ) {
          const { data: signInData, error: signInErr } =
            await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password,
            });
          if (signInErr) throw signInErr;
          if (signInData.user) {
            const prof = await hydrateOrCreateProfile(
              signInData.user.id,
              cleanEmail,
              isAdmin
            );
            onVerified(prof);
            return;
          }
        }

        if (error) throw error;

        if (data.user) {
          const prof = await hydrateOrCreateProfile(
            data.user.id,
            cleanEmail,
            isAdmin
          );
          toast({
            title: 'Student Account Verified',
            description: `Welcome to Kampus (${detectedSchool.code}).`,
          });
          onVerified(prof);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) throw error;

        if (data.user) {
          const prof = await hydrateOrCreateProfile(
            data.user.id,
            cleanEmail,
            isAdmin
          );
          onVerified(prof);
        }
      }
    } catch (err: any) {
      toast({
        title: 'Authentication Failed',
        description:
          err.message ||
          'Please verify your institutional email and password.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-midnight flex flex-col items-center justify-center p-6 w-full h-[100dvh] relative">
      <div className="w-full max-w-[390px] bg-surface border border-gray-800 rounded-3xl p-7 flex flex-col gap-6 shadow-2xl animate-slide-up">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-14 h-14 rounded-2xl bg-ink border border-pine/40 flex items-center justify-center text-pine">
            <ShieldCheck className="w-7 h-7" strokeWidth={2} />
          </div>
          <h1 className="text-white font-black text-2xl tracking-tight mt-1">
            Kampus
          </h1>
          <p className="text-sage text-xs font-medium">
            Verified Student Network · UB, BAC / BSBS &amp; BIUST
          </p>
        </div>

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sage text-xs font-bold uppercase tracking-wider">
              Institutional Student Email
            </label>
            <div className="relative flex items-center">
              <Mail
                className="absolute left-3.5 w-4 h-4 text-sage"
                strokeWidth={1.75}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@ub.ac.bw / @bac.ac.bw / @biust.ac.bw"
                required
                className="w-full h-12 rounded-xl bg-ink border border-gray-800 pl-10 pr-4 text-white placeholder:text-sage/60 text-sm outline-none focus:border-pine transition-colors"
              />
            </div>
            {email.includes('@') && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ink border border-gray-800 mt-0.5">
                <GraduationCap className="w-3.5 h-3.5 text-pine shrink-0" />
                <span className="text-sage text-[11px] font-medium truncate">
                  Institution:{' '}
                  <strong className="text-white">
                    {detectedSchool.fullName}
                  </strong>
                </span>
              </div>
            )}
          </div>

          {isSignUp && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sage text-xs font-bold uppercase tracking-wider">
                Course / Programme Code
              </label>
              <input
                type="text"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="e.g. BSc Computer Systems / CSE311"
                className="w-full h-12 rounded-xl bg-ink border border-gray-800 px-4 text-white placeholder:text-sage/60 text-sm outline-none focus:border-pine transition-colors"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sage text-xs font-bold uppercase tracking-wider">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock
                className="absolute left-3.5 w-4 h-4 text-sage"
                strokeWidth={1.75}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password (min. 6 characters)"
                required
                minLength={6}
                className="w-full h-12 rounded-xl bg-ink border border-gray-800 pl-10 pr-4 text-white placeholder:text-sage/60 text-sm outline-none focus:border-pine transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-pine text-black font-black text-sm active:scale-[0.98] transition-all duration-150 ease-out disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
          >
            {loading && (
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
            )}
            <span>
              {isSignUp ? 'Create Verified Student Account' : 'Sign In'}
            </span>
            {!loading && <ArrowRight className="w-4 h-4" strokeWidth={2.5} />}
          </button>
        </form>

        <div className="flex flex-col gap-2 pt-3 border-t border-gray-800">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sage text-xs hover:text-pine transition-colors font-bold text-center"
          >
            {isSignUp
              ? 'Already have a student account? Sign in'
              : 'New student? Create your verified account'}
          </button>
        </div>
      </div>
    </div>
  );
}
