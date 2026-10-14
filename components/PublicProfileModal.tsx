'use client';

import { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  User as UserIcon,
  MessageSquarePlus,
  Activity,
  Award,
  Crown,
} from 'lucide-react';
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
  const displayName = username.startsWith('@')
    ? username.slice(1).replace(/_/g, ' ')
    : username;

  const [impactScore, setImpactScore] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserData() {
      if (!userId) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', userId)
        .maybeSingle();

      if (profileData?.avatar_url) {
        setAvatarUrl(profileData.avatar_url);
      }

      const { data: posts } = await supabase
        .from('feed_posts')
        .select('upvotes')
        .eq('user_id', userId);

      const postsCount = posts?.length || 0;
      const postUpvotes =
        posts?.reduce((sum, p) => sum + (p.upvotes || 0), 0) || 0;

      const { count: hustlesCount } = await supabase
        .from('hustles')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', userId);

      const { data: hazards } = await supabase
        .from('hazards')
        .select('upvotes')
        .eq('user_id', userId);

      const hazardsCount = hazards?.length || 0;
      const hazardUpvotes =
        hazards?.reduce((sum, h) => sum + (h.upvotes || 0), 0) || 0;

      const total =
        postsCount +
        postUpvotes +
        (hustlesCount || 0) +
        hazardsCount +
        hazardUpvotes;

      setImpactScore(total);
      setLoadingStats(false);
    }

    fetchUserData();
  }, [userId]);

  let tierName = 'Campus Member';
  let TierIcon = Activity;
  let tierColor = 'text-zinc-300';
  let tierBg = 'bg-zinc-950/70 ring-1 ring-white/[0.06]';

  if (impactScore >= 20) {
    tierName = 'Campus Sentinel';
    TierIcon = Crown;
    tierColor = 'text-amber-300';
    tierBg = 'bg-amber-400/10 ring-1 ring-amber-400/25';
  } else if (impactScore >= 5) {
    tierName = 'Verified Hustler';
    TierIcon = Award;
    tierColor = 'text-emerald-300';
    tierBg = 'bg-emerald-950/40 ring-1 ring-emerald-800/40';
  }

  return (
    <div className="absolute inset-0 z-[2000] flex items-end bg-black/70 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full bg-[#121816] ring-1 ring-white/[0.08] rounded-t-3xl p-6 flex flex-col gap-5 animate-slide-up max-h-[85%] overflow-y-auto no-scrollbar z-10">
        <div className="flex items-center justify-between">
          <span className="text-white font-semibold tracking-tight text-base">
            Student Profile
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-zinc-900 ring-1 ring-white/[0.06] flex items-center justify-center text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2.5">
          <div className="w-20 h-20 rounded-full bg-zinc-900 ring-2 ring-white/[0.08] p-1">
            <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserIcon
                  className="w-9 h-9 text-zinc-500"
                  strokeWidth={1.5}
                />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold text-base tracking-tight">
              {displayName}
            </span>
            <span className="text-zinc-500 text-xs">{username}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-950/60 border border-emerald-800/40 px-3 py-1">
            <ShieldCheck
              className="w-3.5 h-3.5 text-emerald-400"
              strokeWidth={1.75}
            />
            <span className="text-emerald-300 text-[11px] font-medium">
              Verified Student
            </span>
          </div>
        </div>

        {onMessageUser && (
          <button
            onClick={() => onMessageUser(userId, username)}
            className="w-full h-11 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-xs active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <MessageSquarePlus className="w-4 h-4" strokeWidth={2} />
            <span>Message {displayName.split(' ')[0]}</span>
          </button>
        )}

        {/* Campus Impact Score */}
        <div className="flex flex-col gap-2">
          <span className="text-zinc-400 text-xs font-medium">
            Campus Impact
          </span>
          <div
            className={`flex items-center justify-between p-4 rounded-2xl ${tierBg}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-black/30">
                <TierIcon className={`w-4 h-4 ${tierColor}`} strokeWidth={2} />
              </div>
              <div className="flex flex-col">
                <span className={`font-semibold text-xs ${tierColor}`}>
                  {tierName}
                </span>
                <span className="text-zinc-400 text-[11px]">
                  {!loadingStats
                    ? `${impactScore} Contributions`
                    : 'Calculating...'}
                </span>
              </div>
            </div>

            <div className="text-right flex flex-col items-end">
              <span className="text-[10px] text-zinc-500 font-medium">
                Impact
              </span>
              <span className="text-xl font-bold font-mono text-white">
                {!loadingStats ? impactScore : '-'}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-4">
          <ProfileReviews targetUserId={userId} />
        </div>
      </div>
    </div>
  );
}
