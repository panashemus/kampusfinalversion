'use client';

import {
  Sparkles,
  MapPin,
  Store,
  MessageSquare,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import type { View } from '@/lib/types';

const TABS: {
  id: Exclude<View, 'auth'>;
  label: string;
  icon: typeof MapPin;
}[] = [
  { id: 'kritic', label: 'Kritic', icon: Sparkles },
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
    <nav className="fixed bottom-0 left-0 right-0 z-[9999] w-full bg-midnight border-t border-gray-800 pb-[max(20px,env(safe-area-inset-bottom))] pt-2 px-2 flex justify-around items-center">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="relative flex flex-col items-center py-1 px-2 active:scale-95 transition-transform duration-150 ease-out"
          >
            {isActive && (
              <span className="absolute -top-2 w-5 h-0.5 rounded-full bg-pine transition-all duration-200" />
            )}
            <Icon
              className={`w-5 h-5 transition-colors duration-150 ${
                isActive ? 'text-pine' : 'text-sage hover:text-white'
              }`}
              strokeWidth={isActive ? 2 : 1.5}
            />
            <span
              className={`text-[10px] mt-1 transition-colors duration-150 ${
                isActive ? 'text-pine font-bold' : 'text-sage font-medium'
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
