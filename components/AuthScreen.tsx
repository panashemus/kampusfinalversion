'use client';

import { useState } from 'react';
import { ShieldCheck, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { Profile } from '@/lib/types';

const WHITELIST_DOMAINS = ['ub.ac.bw', 'thuto.bac.ac.bw', 'bac.ac.bw', 'botho.ac.bw'];

// Only full admins get admin privileges
const ADMIN_EMAILS = ['musungwa60@gmail.com'];

// Test accounts allowed to bypass domain locks but do NOT get admin rights
const TEST_EMAILS: string[] = ['chrisvandium@gmail.com', 'chris.karter1629@gmail.com'];

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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    const isWhitelisted = WHITELIST_DOMAINS.some((domain) => cleanEmail.endsWith(domain)) || TEST_EMAILS.includes(cleanEmail);

    if (!isWhitelisted && !ADMIN_EMAILS.includes(cleanEmail)) {
      toast({
        title: 'Invalid institutional email',
        description: 'Please use your official university email (@ub.ac.bw, @bac.ac.bw, @botho.ac.bw).',
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
          const isAdmin = ADMIN_EMAILS.includes(cleanEmail);
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              email: cleanEmail,
              is_admin: isAdmin,
              email_verified: false,
            })
            .select()
            .single();

          if (profileError) throw profileError;
          toast({
            title: 'Account created',
            description: 'Please check your email or complete verification.',
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
            onVerified(profileData as Profile);
          } else {
            const isAdmin = ADMIN_EMAILS.includes(cleanEmail);
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
            if (newProf) onVerified(newProf as Profile);
          }
        }
      }
    } catch (err: any) {
      toast({
        title: 'Authentication error',
        description: err.message || 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-midnight flex flex-col items-center justify-center p-6 w-full h-[100dvh]">
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
            <label className="text-sage text-[10px] font-bold uppercase tracking-wider">Student Email</label>
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
            <label className="text-sage text-[10px] font-bold uppercase tracking-wider">Password</label>
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
            disabled={loading}
            className="w-full h-12 rounded-xl bg-pine text-black font-bold text-base active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg mt-2"
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />}
            {isSignUp ? 'Create Account' : 'Sign In'}
            {!loading && <ArrowRight className="w-4 h-4" strokeWidth={2} />}
          </button>
        </form>

        <div className="flex items-center justify-center pt-2 border-t border-gray-800">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sage text-xs hover:text-white transition-colors font-medium"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
          </button>
        </div>
      </div>
    </div>
  );
}
