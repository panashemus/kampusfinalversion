'use client';

import { useState } from 'react';
import {
  Check,
  Crown,
  X,
  Zap,
  Star,
  Copy,
  CreditCard,
  Wallet,
  Loader as Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

export type Tier = 'free' | 'plus' | 'pro';

type TierInfo = {
  id: Tier;
  name: string;
  price: string;
  amount: number;
  blurb: string;
  features: string[];
  icon: typeof Crown;
  badge?: string;
};

const TIERS: TierInfo[] = [
  {
    id: 'free',
    name: 'Free',
    price: 'P 0',
    amount: 0,
    blurb: 'Basic Safety Radar & emergency alerts.',
    features: ['Safety Radar', 'SOS emergency alerts'],
    icon: Zap,
  },
  {
    id: 'plus',
    name: 'Plus',
    price: 'P 20/mo',
    amount: 20,
    blurb: 'Full access to Hustle Hub & Campus Feed.',
    features: [
      'Everything in Free',
      'Hustle Hub marketplace',
      'Campus Feed & Confessions',
    ],
    icon: Star,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'P 30/mo',
    amount: 30,
    blurb: 'Ad-free experience & unlimited marketplace listings.',
    features: [
      'Everything in Plus',
      '100% ad-free feed',
      'Unlimited Hustle listings',
      'Priority campus badges',
    ],
    icon: Crown,
    badge: 'Recommended',
  },
];

export default function SubscriptionModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<Tier>('pro');

  const [paymentMethod, setPaymentMethod] = useState<'pay2cell' | 'ewallet'>(
    'pay2cell'
  );
  const [referenceCode, setReferenceCode] = useState('');
  const [incontactId, setIncontactId] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedNum, setCopiedNum] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedTierInfo = TIERS.find((t) => t.id === selected) || TIERS[2];

  if (!open) return null;

  const handleContinue = () => {
    if (selected === 'free') {
      toast({
        title: 'Plan Updated',
        description: 'You are on the Free plan.',
      });
      onClose();
      return;
    }
    const randomCode = `KMP-${Math.floor(1000 + Math.random() * 9000)}`;
    setReferenceCode(randomCode);
    setStep(2);
  };

  const copyToClipboard = (text: string, isCode: boolean) => {
    navigator.clipboard.writeText(text);
    if (isCode) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedNum(true);
      setTimeout(() => setCopiedNum(false), 2000);
    }
  };

  const handleUpgrade = async () => {
    setSubmitting(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user)
        throw new Error('Not authenticated. Please sign in again.');

      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          is_premium: true,
          subscribed_until: nextMonth.toISOString(),
          tier: selected,
          payment_ref_code: referenceCode,
          payment_ref_id: incontactId || null,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast({
        title: 'Membership Unlocked',
        description: `Your ${selectedTierInfo.name} plan is now active.`,
      });

      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (error: any) {
      toast({
        title: 'Upgrade Failed',
        description: error.message || 'Something went wrong.',
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-[420px] max-h-[85dvh] bg-[#121816] rounded-3xl ring-1 ring-white/[0.08] flex flex-col shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <h2 className="text-white font-semibold tracking-tight text-base">
            {step === 1 ? 'Kampus Membership' : 'Membership Checkout'}
          </h2>
          <button
            onClick={() => {
              setStep(1);
              onClose();
            }}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-zinc-900 ring-1 ring-white/[0.06] flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* STEP 1: PLAN SELECTION */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3.5 no-scrollbar">
            {TIERS.map((tier) => {
              const Icon = tier.icon;
              const isSelected = selected === tier.id;

              return (
                <button
                  key={tier.id}
                  onClick={() => setSelected(tier.id)}
                  className={`relative text-left rounded-2xl p-4 transition-all active:scale-[0.99] ${
                    isSelected
                      ? 'bg-emerald-950/30 ring-1 ring-emerald-600/50'
                      : 'bg-zinc-950/60 ring-1 ring-white/[0.06] hover:ring-white/[0.12]'
                  }`}
                >
                  {tier.badge && (
                    <span className="absolute -top-2.5 right-4 rounded-full bg-amber-400 text-zinc-950 text-[10px] font-semibold px-2.5 py-0.5">
                      {tier.badge}
                    </span>
                  )}
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-emerald-950/80 border border-emerald-700/50 text-emerald-400'
                          : 'bg-zinc-900 text-zinc-400'
                      }`}
                    >
                      <Icon className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-semibold text-sm">
                          {tier.name}
                        </span>
                        <span className="font-mono font-semibold text-xs text-amber-300">
                          {tier.price}
                        </span>
                      </div>
                      <p className="text-zinc-400 text-xs leading-snug mt-1">
                        {tier.blurb}
                      </p>
                      <ul className="mt-2.5 flex flex-col gap-1">
                        {tier.features.map((f) => (
                          <li
                            key={f}
                            className="flex items-center gap-1.5 text-zinc-300 text-[11px]"
                          >
                            <Check
                              className="w-3.5 h-3.5 shrink-0 text-emerald-400"
                              strokeWidth={2}
                            />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {step === 1 && (
          <div className="p-4 border-t border-white/[0.06] shrink-0">
            <button
              onClick={handleContinue}
              className="w-full h-11 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-xs active:scale-[0.98] transition-all flex items-center justify-center"
            >
              {selected === 'free'
                ? 'Continue with Free Plan'
                : 'Continue to Checkout'}
            </button>
          </div>
        )}

        {/* STEP 2: PAYMENT FLOW */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 no-scrollbar">
            <div className="bg-zinc-950/80 ring-1 ring-white/[0.07] rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-zinc-400 font-medium">
                  Reference Code
                </div>
                <div className="text-xl font-bold font-mono text-amber-300 tracking-wider mt-0.5">
                  {referenceCode}
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(referenceCode, true)}
                className="flex items-center gap-1.5 bg-zinc-900 ring-1 ring-white/[0.08] text-zinc-200 px-3 py-2 rounded-xl text-xs font-medium hover:bg-zinc-800 transition-colors"
              >
                {copiedCode ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copiedCode ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="bg-zinc-950/60 ring-1 ring-white/[0.06] rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-zinc-300 text-xs font-medium">
                {selectedTierInfo.name} Membership
              </span>
              <span className="text-base font-bold font-mono text-amber-300">
                P {selectedTierInfo.amount}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setPaymentMethod('pay2cell')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  paymentMethod === 'pay2cell'
                    ? 'bg-emerald-950/70 text-emerald-300 ring-1 ring-emerald-700/50'
                    : 'bg-zinc-900/70 text-zinc-400 ring-1 ring-white/[0.06]'
                }`}
              >
                <CreditCard className="w-4 h-4" /> FNB Pay2Cell
              </button>
              <button
                onClick={() => setPaymentMethod('ewallet')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  paymentMethod === 'ewallet'
                    ? 'bg-emerald-950/70 text-emerald-300 ring-1 ring-emerald-700/50'
                    : 'bg-zinc-900/70 text-zinc-400 ring-1 ring-white/[0.06]'
                }`}
              >
                <Wallet className="w-4 h-4" /> eWallet
              </button>
            </div>

            <div className="bg-zinc-950/80 ring-1 ring-white/[0.06] rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium text-zinc-400">
                    {paymentMethod === 'pay2cell'
                      ? 'FNB Pay2Cell Number'
                      : 'eWallet Number'}
                  </div>
                  <div className="text-base font-bold font-mono text-white">
                    {paymentMethod === 'pay2cell' ? '77037168' : '71321163'}
                  </div>
                </div>
                <button
                  onClick={() =>
                    copyToClipboard(
                      paymentMethod === 'pay2cell' ? '77037168' : '71321163',
                      false
                    )
                  }
                  className="flex items-center gap-1 text-emerald-400 text-xs font-medium"
                >
                  {copiedNum ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedNum ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="bg-black/40 p-3 rounded-xl text-xs text-zinc-400 leading-relaxed">
                Send <strong className="text-white">P {selectedTierInfo.amount}</strong>{' '}
                with reference{' '}
                <strong className="text-amber-300 font-mono">
                  {referenceCode}
                </strong>
                .
              </div>
            </div>

            <div className="flex flex-col gap-1.5 mt-auto">
              <label className="text-[11px] font-medium text-zinc-400">
                SMS / inContact Confirmation ID (Optional)
              </label>
              <input
                type="text"
                placeholder="Paste confirmation ID"
                value={incontactId}
                onChange={(e) => setIncontactId(e.target.value)}
                className="bg-zinc-950/90 rounded-xl h-10 w-full px-3.5 ring-1 ring-white/[0.07] text-white placeholder:text-zinc-500 text-xs outline-none focus:ring-emerald-700/50 transition-all"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-4 border-t border-white/[0.06] shrink-0 space-y-2">
            <button
              onClick={handleUpgrade}
              disabled={submitting}
              className="w-full h-11 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-xs active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Confirm Payment & Unlock'
              )}
            </button>
            <button
              onClick={() => setStep(1)}
              className="w-full text-center text-xs text-zinc-400 hover:text-white py-1 transition-colors"
            >
              ← Back to Plans
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
