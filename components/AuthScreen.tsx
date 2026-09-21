'use client';

import { useState } from 'react';
import { ShieldCheck, Mail, Lock, Loader2, ArrowRight, Eye } from 'lucide-react';
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

const ADMIN_EMAILS = [
  'musungwa60@gmail.com',
  'chrisvandium@gmail.com'
];

const TEST_EMAILS = [
  'chrisvandium@gmail.com',
  'chris.karter1629@gmail.com',
  'yofather63@gmail.com',
  'makabongwekundai2000@gmail.com'
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

  // 🔥 GUEST MODE HANDLER (Bypasses verification & domain restrictions)
  const handleGuestLogin = () => {
    setGuestLoading(true);

    const guestId = `guest_${Math.random().toString(36).substring(2, 9)}`;
    const guestProfile: Profile = {
      id: guestId,
      email: 'guest@kampus.demo',
      email_verified: true,
      is_admin: false,
      // Fallbacks if your Profile type requires these fields:
      ...( { username: 'Anonymous Guest', is_guest: true } as any ),
    };

    setTimeout(() => {
      toast({
        title: 'Guest Mode Activated 👁️',
        description: 'You are exploring in read-only demo mode.',
      });
      onVerified(guestProfile);
      setGuestLoading(false);
    }, 600);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    let cleanEmail = email.trim().toLowerCase();

    // SILENT AUTO-CORRECT FOR COMMON STUDENT TYPOS
    if (cleanEmail.endsWith('@ac.ub.bw')) {
      cleanEmail = cleanEmail.replace('@ac.ub.bw', '@ub.ac.bw');
      setEmail(cleanEmail);
    }
    if (cleanEmail.endsWith('@ac.bac.bw')) {
      cleanEmail = cleanEmail.replace('@ac.bac.bw', '@bac.ac.bw');
      setEmail(cleanEmail);
    }

    if (!cleanEmail) return;

    // SECURITY GATE: Only allow university emails
    const normalizedAdmins = ADMIN_EMAILS.map((a) => a.toLowerCase());
    const normalizedTests = TEST_EMAILS.map((t) => t.toLowerCase());

    const isWhitelisted =
      WHITELIST_DOMAINS.some((domain) => cleanEmail.endsWith(domain)) ||
      normalizedTests.includes(cleanEmail) ||
      normalizedAdmins.includes(cleanEmail);

    if (!isWhitelisted) {
      toast({
        title: 'Invalid institutional email',
        description: 'Please use your official university email (@ub.ac.bw, @bac.ac.bw, @biust.ac.bw, @buan.ac.bw).',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        // Instant Sign Up (No OTP Required)
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });

        if (error) throw error;
        
        if (data.user) {
          const isAdmin = normalizedAdmins.includes(cleanEmail);
          
          // Instantly create their profile and forcefully verify them
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              email: cleanEmail,
              is_admin: isAdmin,
              email_verified: true, // Bypasses all app locks
            })
            .select()
            .single();

          if (profileError) throw profileError;
          
          toast({
            title: 'Welcome to Kampus! 🚀',
            description: 'You are officially on the radar.',
          });
          
          if (profileData) {
            onVerified(profileData as Profile);
          }
        }
      } else {
        // Instant Sign In
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
          title: 'Account exists',
          description: 'This email is already registered. Please switch to Sign In.',
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
    <div className="flex-1 bg-midnight flex flex-col items-center justify-center p-6 w-full h-[100dvh] relative">
      <div className="w-full max-w-[380px] bg-surface rounded-3xl border border-gray-800 p-8 flex flex-col gap-6 shadow-2xl">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-14 h-14 rounded-2xl bg-pine/15 border border-pine/40 flex items-center justify-center text-pine">
            <ShieldCheck className="w-7 h-7" strokeWidth={1.5} />
          </div>
          <h1 className="text-white font-black text-2xl tracking-tight">KAMPUS</h1>
          <p className="text-sage text-xs">Secure student safety & campus community</p>
        </div>

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sage text-[10px] font-bold uppercase tracking-wider">
              Student Email
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 w-4 h-4 text-sage" strokeWidth={1.5} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@ub.ac.bw"
                required
                className="w-full h-12 rounded-xl bg-ink border border-gray-800 pl-11 pr-4 text-white placeholder:text-sage text-sm outline-none focus:border-pine transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sage text-[10px] font-bold uppercase tracking-wider">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 w-4 h-4 text-sage" strokeWidth={1.5} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full h-12 rounded-xl bg-ink border border-gray-800 pl-11 pr-4 text-white placeholder:text-sage text-sm outline-none focus:border-pine transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || guestLoading}
            className="w-full h-12 rounded-xl bg-pine text-black font-bold text-base active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg mt-2"
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />}
            {isSignUp ? 'Enter Kampus' : 'Sign In'}
            {!loading && <ArrowRight className="w-4 h-4" strokeWidth={2} />}
          </button>
        </form>

        <div className="flex flex-col gap-3 pt-2 border-t border-gray-800">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sage text-xs hover:text-white transition-colors font-medium text-center"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
          </button>

          {/* 🔥 GUEST MODE DEMO BUTTON */}
          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={loading || guestLoading}
            className="w-full h-11 rounded-xl bg-gray-900 border border-gray-700 hover:border-pine/50 text-sage hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 mt-1"
          >
            {guestLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-pine" />
            ) : (
              <Eye className="w-4 h-4 text-pine" />
            )}
            Explore in Guest Mode (Recruiter Preview)
          </button>
        </div>
      </div>
    </div>
  );
}
