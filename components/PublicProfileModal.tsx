'use client';

import { useState, useEffect } from 'react';
import { X, ShieldCheck, User as UserIcon, MessageSquarePlus, Activity, Award, Crown } from 'lucide-react';
import ProfileReviews from './ProfileReviews';
import { supabase } from '@/lib/supabase';

export default function PublicProfileModal({
  userId,
  username,
  onClose,
  onMessageUser,
}: {
  userId: string;
  username: string;
  onClose: () => void;
  onMessageUser?: (peerId: string, peerUsername: string) => void;
}) {
  const displayName = username.startsWith('@') ? username.slice(1).replace(/_/g, ' ') : username;
  
  const [impactScore, setImpactScore] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Fetch user profile data and calculate TOTAL Campus Impact
  useEffect(() => {
    async function fetchUserData() {
      if (!userId) return;

      // 1. Fetch user profile for PFP avatar_url
      const { data: profileData } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', userId)
        .maybeSingle();

      if (profileData?.avatar_url) {
        setAvatarUrl(profileData.avatar_url);
      }

      // 2. Fetch community feed posts AND their upvotes
      const { data: posts } = await supabase
        .from('feed_posts')
        .select('upvotes')
        .eq('user_id', userId);
      
      const postsCount = posts?.length || 0;
      const postUpvotes = posts?.reduce((sum, p) => sum + (p.upvotes || 0), 0) || 0;

      // 3. Count their hustle listings
      const { count: hustlesCount } = await supabase
        .from('hustles')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', userId);

      // 4. Fetch their hazard pins AND upvotes they've received
      const { data: hazards } = await supabase
        .from('hazards')
        .select('upvotes')
        .eq('user_id', userId);

      const hazardsCount = hazards?.length || 0;
      const hazardUpvotes = hazards?.reduce((sum, h) => sum + (h.upvotes || 0), 0) || 0;

      // Master Calculation
      const total = postsCount + postUpvotes + (hustlesCount || 0) + hazardsCount + hazardUpvotes;
      
      setImpactScore(total);
      setLoadingStats(false);
    }
    
    fetchUserData();
  }, [userId]);

  let tierName = 'Campus Rookie';
  let TierIcon = Activity;
  let tierColor = 'text-sage';
  let tierBg = 'bg-ink border-gray-800';

  if (impactScore >= 20) {
    tierName = 'Campus Sentinel';
    TierIcon = Crown;
    tierColor = 'text-yellow-400';
    tierBg = 'bg-yellow-400/10 border-yellow-400/30';
  } else if (impactScore >= 5) {
    tierName = 'Verified Hustler';
    TierIcon = Award;
    tierColor = 'text-pine';
    tierBg = 'bg-pine/10 border-pine/30';
  }

  return (
    <div className="absolute inset-0 z-[2000] flex items-end bg-black/60 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-2xl p-6 flex flex-col gap-5 animate-slide-up max-h-[85%] overflow-y-auto no-scrollbar z-10">
        
        <div className="flex items-center justify-between">
          <span className="text-white font-black text-lg">Student Profile</span>
          <button onClick={onClose} aria-label="Close">
            <X className="w-5 h-5 text-sage" strokeWidth={1.5} />
          </button>
        </div>

        {onMessageUser && (
          <button
            onClick={() => onMessageUser(userId, username)}
            className="w-full h-12 rounded-lg bg-transparent border border-yellow-400 text-yellow-400 font-bold text-base active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <MessageSquarePlus className="w-5 h-5" strokeWidth={2} />
            Message {displayName.split(' ')[0]}
          </button>
        )}

        <div className="flex flex-col items-center gap-3">
          {/* UPDATED AVATAR CONTAINER */}
          <div className="w-20 h-20 rounded-full bg-ink border-2 border-pine/60 p-1">
            <div className="w-full h-full rounded-full bg-surface border border-pine/40 flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-10 h-10 text-sage" strokeWidth={1.5} />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white font-black text-lg">{displayName}</span>
            <span className="text-sage text-sm">{username}</span>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-pine/15 border border-pine/50 px-3 py-1">
            <ShieldCheck className="w-3.5 h-3.5 text-pine" strokeWidth={2} />
            <span className="text-pine text-[10px] font-bold">Verified Student</span>
          </div>
        </div>

        {/* --- CAMPUS IMPACT SCORE SECTION --- */}
        <div className="flex flex-col gap-3">
          <span className="text-sage text-xs font-bold uppercase tracking-wider">Campus Impact</span>
          
          <div className={`flex items-center justify-between p-4 rounded-xl border ${tierBg}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-black/30">
                <TierIcon className={`w-5 h-5 ${tierColor}`} strokeWidth={2} />
              </div>
              <div className="flex flex-col">
                <span className={`font-black text-sm ${tierColor}`}>{tierName}</span>
                <span className="text-white text-xs font-medium">
                  {!loadingStats ? `${impactScore} Contributions` : 'Calculating...'}
                </span>
              </div>
            </div>
            
            <div className="text-right flex flex-col items-end">
              <span className="text-[10px] text-sage font-bold uppercase">Impact Score</span>
              <span className="text-2xl font-black text-white">{!loadingStats ? impactScore : '-'}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-sage text-xs font-bold uppercase tracking-wider">About</span>
          <p className="text-sage text-sm leading-relaxed">
            This student is part of the Kampus verified network at UB or BAC.
          </p>
        </div>

        {/* --- LIVE ANONYMOUS REVIEWS COMPONENT --- */}
        <div className="border-t border-gray-800 pt-6 mt-2">
          <ProfileReviews targetUserId={userId} />
        </div>

      </div>
    </div>
  );
}
