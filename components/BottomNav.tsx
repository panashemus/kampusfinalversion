'use client';

import { MapPin, Store, MessageSquare, ShieldCheck, User as UserIcon } from 'lucide-react';
import type { View } from '@/lib/types';

const TABS: { id: Exclude<View, 'auth'>; label: string; icon: typeof MapPin }[] = [
  { id: 'radar', label: 'Radar', icon: MapPin },
  { id: 'hustle', label: 'Hustle', icon: Store },
  { id: 'community', label: 'Community', icon: MessageSquare },
  { id: 'escrow', label: 'Escrow', icon: ShieldCheck },
  { id: 'profile', label: 'Profile', icon: UserIcon },
];

export default function BottomNav({
  active,
  onChange,
}: {
  active: View;
  onChange: (v: View) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[9999] w-full bg-midnight/95 backdrop-blur-xl border-t border-gray-800 pb-[max(24px,env(safe-area-inset-bottom))] pt-2 px-4 flex justify-around items-center shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="flex flex-col items-center"
          >
            <Icon
              className={`w-5 h-5 ${isActive ? 'text-pine' : 'text-sage'}`}
              strokeWidth={1.5}
            />
            <span
              className={`text-[10px] mt-1 ${isActive ? 'text-pine' : 'text-sage'}`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
