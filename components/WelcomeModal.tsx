'use client';

import { useState, useEffect } from 'react';
import {
  Sparkles,
  ShieldAlert,
  ShoppingBag,
  ShieldCheck,
  MessagesSquare,
  ArrowRight,
} from 'lucide-react';

export default function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('kampus_onboarded');
    if (!hasSeenWelcome) {
      setIsOpen(true);
    }
  }, []);

  const handleEnter = () => {
    localStorage.setItem('kampus_onboarded', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-surface border border-gray-800 rounded-3xl w-full max-w-sm p-6 flex flex-col shadow-2xl relative overflow-hidden">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-black text-white tracking-tight mb-1.5">
            Welcome to KAMPUS
          </h2>
          <p className="text-xs text-sage font-medium">
            The verified student network for UB, BAC / BSBS &amp; BIUST.
          </p>
        </div>

        <div className="space-y-4 mb-7">
          <div className="flex gap-3.5 items-start">
            <div className="w-10 h-10 rounded-xl bg-ink border border-pine/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-pine" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm mb-0.5">
                Kampus Kritic
              </h3>
              <p className="text-xs text-sage leading-relaxed">
                Course-calibrated AI assistant for pre-submission assignment
                auditing, citations, and PDF/image review.
              </p>
            </div>
          </div>

          <div className="flex gap-3.5 items-start">
            <div className="w-10 h-10 rounded-xl bg-ink border border-red-500/30 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm mb-0.5">
                Radar &amp; SOS
              </h3>
              <p className="text-xs text-sage leading-relaxed">
                Live campus safety map. Report hazards and trigger emergency
                student broadcasts within 1km.
              </p>
            </div>
          </div>

          <div className="flex gap-3.5 items-start">
            <div className="w-10 h-10 rounded-xl bg-ink border border-gray-800 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5 text-pine" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm mb-0.5">
                Hustle Hub &amp; Escrow
              </h3>
              <p className="text-xs text-sage leading-relaxed">
                Buy, sell, and list student services safely with protected
                Kampus Escrow reference codes.
              </p>
            </div>
          </div>

          <div className="flex gap-3.5 items-start">
            <div className="w-10 h-10 rounded-xl bg-ink border border-gray-800 flex items-center justify-center shrink-0">
              <MessagesSquare className="w-5 h-5 text-pine" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm mb-0.5">
                Campus Feed
              </h3>
              <p className="text-xs text-sage leading-relaxed">
                Discussions, academic questions, and anonymous confessions from
                verified students only.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleEnter}
          className="w-full bg-pine text-black font-black text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <span>Enter Kampus</span>
          <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
