'use client';

import { useState } from 'react';
import { Check, Crown, X, Zap, Star, Copy, CreditCard, Wallet, Loader as Loader2 } from 'lucide-react';
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
  accent: string;
  badge?: string;
};

const TIERS: TierInfo[] = [
  {
    id: 'free',
    name: 'Free',
    price: 'P0',
    amount: 0,
    blurb: 'Basic Safety Radar access. (Includes 30-second full-screen ads).',
    features: ['Safety Radar', 'SOS alerts', '30-second full-screen ads'],
    icon: Zap,
    accent: 'border-gray-700',
  },
  {
    id: 'plus',
    name: 'Plus',
    price: 'P20/mo',
    amount: 20,
    blurb: 'Safety Radar, Hustle Hub, & Campus Feed. (Banner ads only).',
    features: ['Everything in Free', 'Hustle Hub access', 'Campus Feed', 'Banner ads only'],
    icon: Star,
    accent: 'border-pine text-pine',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'P30/mo',
    amount: 30,
    blurb: '100% Ad-Free. Unlimited Hustle listings. Highest Sentinel cashback point cap.',
    features: [
      'Everything in Plus',
      '100% ad-free',
      'Unlimited Hustle listings',
      'Highest Sentinel cashback cap',
    ],
    icon: Crown,
    accent: 'border-yellow-500 text-yellow-500',
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
  const { toast } = useToast();
  
  // Modal state
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<Tier>('pro');

  // Checkout state
  const [paymentMethod, setPaymentMethod] = useState<'pay2cell' | 'ewallet'>('pay2cell');
  const [referenceCode, setReferenceCode] = useState('');
  const [incontactId, setIncontactId] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedNum, setCopiedNum] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedTierInfo = TIERS.find(t => t.id === selected) || TIERS[2];
  const isPro = selected === 'pro';

  if (!open) return null;

  const handleContinue = () => {
    if (selected === 'free') {
      toast({ title: 'Plan Updated', description: 'You are currently on the Free plan.' });
      onClose();
      return;
    }
    // Generate code and go to payment step
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
      // 1. Grab the current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Not authenticated. Please sign in again.');

      // 2. Calculate exactly 1 month from right now
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      // 3. INSTANTLY grant premium access in the database (Trust but verify)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          is_premium: true, // Immediately unlocks the app features
          subscribed_until: nextMonth.toISOString(), // Sets the 1 month expiry
          tier: selected, 
          payment_ref_code: referenceCode, // Logs the KMP code for your manual audit
          payment_ref_id: incontactId || null // Optional SMS ID
        })
        .eq('id', user.id);

      if (updateError) throw updateError;
      
      // Instant gratification toast
      toast({
        title: 'Upgrade Successful! 🎉',
        description: `You are instantly unlocked on the ${selectedTierInfo.name} plan.`,
      });

      // 4. Force a hard reload so the entire React app recognizes the new premium status
      setTimeout(() => {
        window.location.reload();
      }, 1500);

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
      
      <div className="relative w-full max-w-[420px] max-h-[85dvh] bg-surface rounded-3xl border border-gray-800 flex flex-col shadow-2xl overflow-hidden animate-slide-up">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800 shrink-0 h-16">
          <h2 className="text-white font-black text-lg">
            {step === 1 ? 'Choose Your Plan' : 'Payment Checkout'}
          </h2>
          <button
            onClick={() => {
              setStep(1);
              onClose();
            }}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-ink flex items-center justify-center active:scale-95 transition-transform"
          >
            <X className="w-4 h-4 text-sage" strokeWidth={2} />
          </button>
        </div>

        {/* STEP 1: PLAN SELECTION */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 no-scrollbar">
            <p className="text-sage text-xs mb-1 text-center">
              Upgrade or cancel anytime. Payments powered by Kampus.
            </p>
            {TIERS.map((tier) => {
              const Icon = tier.icon;
              const isSelected = selected === tier.id;
              const isThisPro = tier.id === 'pro';
              const isThisPlus = tier.id === 'plus';
              
              let accentColorClass = 'text-white';
              if (isThisPro) accentColorClass = 'text-yellow-500';
              if (isThisPlus) accentColorClass = 'text-pine';

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
                    <span className="absolute -top-2.5 right-4 rounded-full bg-yellow-500 text-black text-[9px] font-black px-2 py-0.5 tracking-wider">
                      {tier.badge}
                    </span>
                  )}
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isThisPro
                          ? 'bg-yellow-500/15 border border-yellow-500/40'
                          : isThisPlus
                          ? 'bg-pine/15 border border-pine/30'
                          : 'bg-gray-800/50 border border-gray-700'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${accentColorClass}`} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-black text-base">{tier.name}</span>
                        <span className={`font-black text-sm ${accentColorClass}`}>
                          {tier.price}
                        </span>
                      </div>
                      <p className="text-sage text-[11px] leading-snug mt-1">
                        {tier.blurb}
                      </p>
                      <ul className="mt-2 flex flex-col gap-1">
                        {tier.features.map((f) => (
                          <li key={f} className="flex items-center gap-1.5 text-sage text-[11px]">
                            <Check className={`w-3 h-3 shrink-0 ${accentColorClass}`} strokeWidth={3} />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {/* Radio dot */}
                    <div
                      className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center mt-1 ${
                        isSelected
                          ? isThisPro
                            ? 'border-yellow-500 bg-yellow-500'
                            : isThisPlus
                            ? 'border-pine bg-pine'
                            : 'border-gray-400 bg-gray-400'
                          : 'border-gray-600'
                      }`}
                    >
                      {isSelected && (
                        <Check className="w-3 h-3 text-black" strokeWidth={4} />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {step === 1 && (
          <div className="p-4 border-t border-gray-800 shrink-0">
            <button
              onClick={handleContinue}
              className={`w-full h-12 rounded-xl text-black font-bold text-base active:scale-95 transition-transform flex items-center justify-center gap-2 ${
                selected === 'pro' ? 'bg-yellow-500' : selected === 'plus' ? 'bg-pine' : 'bg-gray-400'
              }`}
            >
              {selected === 'free' ? 'Confirm Free Plan' : 'Continue to Payment'}
            </button>
            <p className="text-center text-sage text-[10px] mt-2">
              By continuing you agree to the Kampus Terms of Service.
            </p>
          </div>
        )}

        {/* STEP 2: PAYMENT FLOW */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 no-scrollbar">
            {/* Reference Code Header */}
            <div className={`bg-ink border rounded-xl p-4 flex items-center justify-between ${isPro ? 'border-yellow-500/30' : 'border-pine/30'}`}>
              <div>
                <div className="text-xs uppercase tracking-wider text-sage font-bold">Your Reference Code</div>
                <div className={`text-2xl font-extrabold tracking-wider mt-1 ${isPro ? 'text-yellow-500' : 'text-pine'}`}>
                  {referenceCode}
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(referenceCode, true)}
                className={`flex items-center gap-1.5 border px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  isPro ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/20' : 'bg-pine/10 border-pine/30 text-pine hover:bg-pine/20'
                }`}
              >
                {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedCode ? 'Copied' : 'Copy Code'}
              </button>
            </div>

            {/* Subscription Fee Info */}
            <div className="bg-ink border border-gray-800 rounded-xl p-4 flex items-center justify-between">
              <span className="text-white font-semibold">{selectedTierInfo.name} Plan Fee</span>
              <span className={`text-xl font-bold ${isPro ? 'text-yellow-500' : 'text-pine'}`}>
                P{selectedTierInfo.amount}
              </span>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod('pay2cell')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition-colors ${
                  paymentMethod === 'pay2cell'
                    ? isPro ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-pine text-black border-pine'
                    : 'bg-ink text-sage border-gray-800'
                }`}
              >
                <CreditCard className="w-4 h-4" /> FNB Pay2Cell
              </button>
              <button
                onClick={() => setPaymentMethod('ewallet')}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition-colors ${
                  paymentMethod === 'ewallet'
                    ? isPro ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-pine text-black border-pine'
                    : 'bg-ink text-sage border-gray-800'
                }`}
              >
                <Wallet className="w-4 h-4" /> eWallet
              </button>
            </div>

            {/* Instructions Box */}
            {paymentMethod === 'pay2cell' ? (
              <div className="bg-ink border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-sage">FNB Pay2Cell Number</div>
                    <div className="text-lg font-extrabold text-white">77037168</div>
                  </div>
                  <button
                    onClick={() => copyToClipboard('77037168', false)}
                    className={`flex items-center gap-1 text-xs font-bold ${isPro ? 'text-yellow-500' : 'text-pine'}`}
                  >
                    {copiedNum ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedNum ? 'Copied' : 'Copy Number'}
                  </button>
                </div>
                <div className="bg-black/50 p-3 rounded-lg text-xs text-sage leading-relaxed">
                  Open FNB App &gt; Transact &gt; Pay2Cell (or dial *130*321#) &gt; Send payment to <strong className="text-white">77037168</strong> &gt; Set payment reference to <strong className={isPro ? 'text-yellow-500' : 'text-pine'}>{referenceCode}</strong>.
                </div>
              </div>
            ) : (
              <div className="bg-ink border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-sage">eWallet Number</div>
                    <div className="text-lg font-extrabold text-white">71321163</div>
                  </div>
                  <button
                    onClick={() => copyToClipboard('71321163', false)}
                    className={`flex items-center gap-1 text-xs font-bold ${isPro ? 'text-yellow-500' : 'text-pine'}`}
                  >
                    {copiedNum ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedNum ? 'Copied' : 'Copy Number'}
                  </button>
                </div>
                <div className="bg-black/50 p-3 rounded-lg text-xs text-sage leading-relaxed">
                  Send eWallet payment to <strong className="text-white">71321163</strong> &gt; Include <strong className={isPro ? 'text-yellow-500' : 'text-pine'}>{referenceCode}</strong> in the message or keep your reference ID handy.
                </div>
              </div>
            )}

            {/* Optional inContact ID Input */}
            <div className="flex flex-col gap-1.5 mt-auto">
              <label className="block text-[10px] uppercase font-bold text-sage">
                FNB inContact / SMS Confirmation ID (Optional)
              </label>
              <input
                type="text"
                placeholder="Paste your confirmation ID"
                value={incontactId}
                onChange={(e) => setIncontactId(e.target.value)}
                className={`bg-ink rounded-lg h-11 w-full px-3 border border-gray-800 text-white placeholder:text-sage text-sm outline-none transition-colors ${isPro ? 'focus:border-yellow-500' : 'focus:border-pine'}`}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-4 border-t border-gray-800 shrink-0 space-y-2">
            <button
              onClick={handleUpgrade}
              disabled={submitting}
              className={`w-full h-12 rounded-lg text-black font-bold text-base active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center ${isPro ? 'bg-yellow-500' : 'bg-pine'}`}
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Payment & Unlock'}
            </button>
            <button
              onClick={() => setStep(1)}
              className="w-full text-center text-xs text-sage hover:text-white py-2 transition-colors"
            >
              ← Back to Plans
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
