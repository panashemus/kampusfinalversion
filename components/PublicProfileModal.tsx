'use client';

import { X, ShieldCheck, User as UserIcon, MessageSquarePlus } from 'lucide-react';
import ProfileReviews from './ProfileReviews';

export default function PublicProfileModal({
  userId, // <-- Added this so the database knows who is being reviewed!
  username,
  onClose,
  onMessageUser,
}: {
  userId: string; // <-- Required prop for the reviews
  username: string;
  onClose: () => void;
  onMessageUser?: (peerId: string, peerUsername: string) => void;
}) {
  const displayName = username.startsWith('@') ? username.slice(1).replace(/_/g, ' ') : username;

  return (
    <div className="absolute inset-0 z-[2000] flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-2xl p-6 flex flex-col gap-5 animate-slide-up max-h-[85%] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between">
          <span className="text-white font-black text-lg">Student Profile</span>
          <button onClick={onClose} aria-label="Close">
            <X className="w-5 h-5 text-sage" strokeWidth={1.5} />
          </button>
        </div>

        {onMessageUser && (
          <button
            onClick={() => onMessageUser(username, username)}
            className="w-full h-12 rounded-lg bg-transparent border border-yellow-400 text-yellow-400 font-bold text-base active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <MessageSquarePlus className="w-5 h-5" strokeWidth={2} />
            Message {displayName.split(' ')[0]}
          </button>
        )}

        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full bg-ink border-2 border-pine/60 p-1">
            <div className="w-full h-full rounded-full bg-surface border border-pine/40 flex items-center justify-center">
              <UserIcon className="w-10 h-10 text-sage" strokeWidth={1.5} />
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
