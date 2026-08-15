'use client';

import { useState } from 'react';
import { ShieldCheck, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { Profile } from '@/lib/types';
import OtpModal from '@/components/OtpModal';

const WHITELIST_DOMAINS = ['ub.ac.bw', 'thuto.bac.ac.bw', 'bac.ac.bw', 'botho.ac.bw', 'buan.ac.bw', 'biust.ac.bw'];
const ADMIN_EMAILS = ['musungwa60@gmail.com', 'chrisvandium@gmail.com'];
const TEST_EMAILS: string[] = ['chrisvandium@gmail.com', 'chris.karter1629@gmail.com', 'yofather63@gmail.com', 'Makabongwekundai2000@gmail.com'];

export default function AuthScreen({
  onVerified,
}: {
  onVerified: (profile: Profile) => void;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Default to Sign In (false) instead of Sign Up. 
  // Better UX for returning users on new devices.
  const [isSignUp, setIsSignUp] = useState(false); 
  const [loading, setLoading] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null);

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
        // NATIVE SIGN UP: This automatically sends the email if "Confirm Email" is ON in Supabase
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
            description: 'Check your email for the verification code.',
          });
          
          if (profileData) {
            setPendingProfile(profileData as Profile);
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
               setPendingProfile(profileData as Profile);
            } else {
               onVerified(profileData as Profile);
            }
          } else {
            const isAdmin = ADMIN_EMAILS.includes(cleanEmail);
            const { data: newProf } = await supabase
              .from('profiles')
              .insert({
                id: data.user.id,
                email: cleanEmail,
                is_admin: isAdmin,
                email_verified: false,
              })
              .select()
              .single();
              
            if (newProf) {
               setPendingProfile(newProf as Profile);
            }
          }
        }
      }
    } catch (err: any) {
      // FIX 1: Catch Native Auth "Email not confirmed" during sign in
      if (err.message?.toLowerCase().includes('email not confirmed')) {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', cleanEmail)
          .single();
          
        if (existingProfile) {
          setPendingProfile(existingProfile as Profile);
          toast({
            title: 'Verification required',
            description: 'Please enter your code to verify your account.',
          });
        }
      } 
      // Handle User Already Exists
      else if (err.message?.toLowerCase().includes('already registered') || err.message?.toLowerCase().includes('already exists')) {
        toast({
          title: 'Account exists',
          description: 'This email is already registered. Please switch to Sign In.',
          variant: 'destructive',
        });
        setIsSignUp(false);
      } else {
        toast({
          title: 'Authentication error',
          description: err.message || 'Something went wrong.',
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

      {pendingProfile && (
        <div className="absolute inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <OtpModal
            userId={pendingProfile.id}
            email={pendingProfile.email}
            onClose={() => {
              supabase.auth.signOut();
              setPendingProfile(null);
            }}
            onVerified={async () => {
              // FIX 2: Update the profiles table to verified so they don't get trapped next time
              const { data } = await supabase
                .from('profiles')
                .update({ email_verified: true })
                .eq('id', pendingProfile.id)
                .select('*')
                .single();
                
              if (data) onVerified(data as Profile);
            }}
          />
        </div>
      )}
    </div>
  );
}
