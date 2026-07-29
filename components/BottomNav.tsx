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
    <nav className="sticky bottom-0 z-[1000] h-20 bg-surface border-t border-gray-800 flex items-center justify-around px-1">
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
