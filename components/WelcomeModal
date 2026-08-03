'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, ShoppingBag, ShieldCheck, MessagesSquare, ArrowRight } from 'lucide-react';

export default function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if they've seen this before
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
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-[#0c100d] border border-gray-800 rounded-3xl w-full max-w-sm p-6 flex flex-col shadow-2xl relative overflow-hidden">
        
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-yellow-500/20 rounded-full blur-[50px] -z-10" />

        <div className="text-center mb-6">
          <h2 className="text-2xl font-black text-white tracking-tight mb-2">Welcome to KAMPUS</h2>
          <p className="text-sm text-gray-400 font-medium">The verified student network for UB & BAC.</p>
        </div>

        <div className="space-y-5 mb-8">
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm mb-0.5">Radar & SOS</h3>
              <p className="text-xs text-gray-400 leading-relaxed">Live campus map. Report hazards and trigger emergency broadcasts. Don't walk alone.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm mb-0.5">Hustle Hub</h3>
              <p className="text-xs text-gray-400 leading-relaxed">The student marketplace. Buy, sell, and list your services to campus.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-full bg-pine/10 border border-pine/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-pine" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm mb-0.5">Secure Escrow</h3>
              <p className="text-xs text-gray-400 leading-relaxed">Buy and sell safely. Funds are held securely until both students confirm the trade.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0">
              <MessagesSquare className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm mb-0.5">Community</h3>
              <p className="text-xs text-gray-400 leading-relaxed">The exclusive campus feed. Discussions and alerts from verified students only.</p>
            </div>
          </div>
        </div>

        <button 
          onClick={handleEnter}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black text-sm py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          Enter Kampus <ArrowRight className="w-4 h-4" strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}
