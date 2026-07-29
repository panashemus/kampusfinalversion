'use client';

import { useState } from 'react';
import { Check, Crown, X, Zap, Star } from 'lucide-react';

export type Tier = 'free' | 'plus' | 'pro';

type TierInfo = {
  id: Tier;
  name: string;
  price: string;
  blurb: string;
  features: string[];
  icon: typeof Crown;
  accent: string;
  badge?: string;
};

const TIERS: TierInfo[] = [
  {
    id: 'free',
    name: 'Free',
    price: 'P0',
    blurb: 'Basic Safety Radar access. (Includes 30-second full-screen ads).',
    features: ['Safety Radar', 'SOS alerts', '30-second full-screen ads'],
    icon: Zap,
    accent: 'border-gray-700',
  },
  {
    id: 'plus',
    name: 'Plus',
    price: 'P20/mo',
    blurb: 'Safety Radar, Hustle Hub, & Campus Feed. (Banner ads only).',
    features: ['Everything in Free', 'Hustle Hub access', 'Campus Feed', 'Banner ads only'],
    icon: Star,
    accent: 'border-pine',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'P30/mo',
    blurb: '100% Ad-Free. Unlimited Hustle listings. Highest Sentinel cashback point cap.',
    features: [
      'Everything in Plus',
      '100% ad-free',
      'Unlimited Hustle listings',
      'Highest Sentinel cashback cap',
    ],
    icon: Crown,
    accent: 'border-yellow-500',
    badge: 'BEST VALUE',
  },
];

export default function SubscriptionModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Tier>('pro');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-[430px] max-h-[90vh] overflow-y-auto bg-midnight rounded-t-3xl sm:rounded-3xl border border-gray-800 p-5 pb-8 animate-in slide-in-from-bottom duration-300">
        {/* Handle */}
        <div className="mx-auto w-10 h-1 rounded-full bg-gray-700 mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-white font-black text-xl">Choose Your Plan</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-surface flex items-center justify-center active:scale-95 transition-transform"
          >
            <X className="w-4 h-4 text-sage" strokeWidth={2} />
          </button>
        </div>
        <p className="text-sage text-xs mb-5">
          Upgrade or cancel anytime. Payments powered by DPO Botswana.
        </p>

        {/* Tiers */}
        <div className="flex flex-col gap-3">
          {TIERS.map((tier) => {
            const Icon = tier.icon;
            const isSelected = selected === tier.id;
            const isPro = tier.id === 'pro';
            return (
              <button
                key={tier.id}
                onClick={() => setSelected(tier.id)}
                className={`relative text-left rounded-2xl p-4 border-2 transition-all active:scale-[0.98] ${
                  isSelected
                    ? `${tier.accent} bg-surface`
                    : 'border-gray-800 bg-surface/50'
                }`}
              >
                {tier.badge && (
                  <span
                    className="absolute -top-2.5 right-4 rounded-full bg-yellow-500 text-black text-[9px] font-black px-2 py-0.5 tracking-wider"
                  >
                    {tier.badge}
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isPro
                        ? 'bg-yellow-500/15 border border-yellow-500/40'
                        : 'bg-pine/15 border border-pine/30'
                    }`}
                  >
                    <Icon
                      className={isPro ? 'w-5 h-5 text-yellow-500' : 'w-5 h-5 text-pine'}
                      strokeWidth={2}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-black text-base">{tier.name}</span>
                      <span
                        className={`font-black text-sm ${
                          isPro ? 'text-yellow-500' : 'text-pine'
                        }`}
                      >
                        {tier.price}
                      </span>
                    </div>
                    <p className="text-sage text-[11px] leading-snug mt-1">
                      {tier.blurb}
                    </p>
                    <ul className="mt-2 flex flex-col gap-1">
                      {tier.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-center gap-1.5 text-sage text-[11px]"
                        >
                          <Check
                            className={`w-3 h-3 shrink-0 ${
                              isPro ? 'text-yellow-500' : 'text-pine'
                            }`}
                            strokeWidth={3}
                          />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Radio dot */}
                  <div
                    className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center mt-1 ${
                      isSelected
                        ? isPro
                          ? 'border-yellow-500 bg-yellow-500'
                          : 'border-pine bg-pine'
                        : 'border-gray-600'
                    }`}
                  >
                    {isSelected && (
                      <Check
                        className="w-3 h-3 text-black"
                        strokeWidth={4}
                      />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Continue to payment */}
        <button
          className="w-full mt-5 h-12 rounded-xl bg-pine text-black font-bold text-base active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          Continue to Payment
        </button>
        <p className="text-center text-sage text-[10px] mt-3">
          By continuing you agree to the Kampus Terms of Service.
        </p>
      </div>
    </div>
  );
}
