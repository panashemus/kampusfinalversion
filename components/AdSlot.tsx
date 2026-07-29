'use client';

import { Tag } from 'lucide-react';

export default function AdSlot() {
  return (
    <div className="bg-surface rounded-2xl p-4 border border-pine flex items-center gap-3">
      <div className="w-11 h-11 rounded-lg bg-pine/15 flex items-center justify-center shrink-0">
        <Tag className="w-5 h-5 text-pine" strokeWidth={1.5} />
      </div>
      <div className="flex-1 flex flex-col gap-0.5">
        <span className="text-pine text-[10px] font-extrabold uppercase tracking-wider">
          Sponsored
        </span>
        <span className="text-white text-sm font-bold leading-snug">
          Your ad could be here — reach UB & BAC students
        </span>
      </div>
    </div>
  );
}
