'use client';

import { useState, useEffect } from 'react';
import { X, Copy, Check, CreditCard, Wallet } from 'lucide-react';
import { generateReferenceCode } from '@/lib/payment';

type PaymentMethod = 'fnb' | 'ewallet';

export default function PaymentModal({
  open,
  onClose,
  onConfirm,
  amount = 10,
  ctaLabel = 'Publish Gig',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (referenceCode: string, paymentRefId: string) => void;
  amount?: number;
  ctaLabel?: string;
}) {
  const [referenceCode, setReferenceCode] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('fnb');
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedNum, setCopiedNum] = useState(false);
  const [paymentRefId, setPaymentRefId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setReferenceCode(generateReferenceCode());
      setPaymentRefId('');
      setMethod('fnb');
    }
  }, [open]);

  if (!open) return null;

  const fnbNumber = '77037168';
  const ewalletNumber = '71321163';
  const currentNumber = method === 'fnb' ? fnbNumber : ewalletNumber;

  const copyToClipboard = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard?.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const handleConfirm = () => {
    setSubmitting(true);
    onConfirm(referenceCode, paymentRefId.trim());
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[2100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-[430px] max-h-[90vh] overflow-y-auto bg-midnight rounded-t-3xl sm:rounded-3xl border border-gray-800 p-5 pb-8 animate-in slide-in-from-bottom duration-300">
        <div className="mx-auto w-10 h-1 rounded-full bg-gray-700 mb-4" />

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-black text-lg">Payment Checkout</h2>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-surface flex items-center justify-center active:scale-95 transition-transform">
            <X className="w-4 h-4 text-sage" strokeWidth={2} />
          </button>
        </div>

        {/* Reference code */}
        <div className="bg-surface rounded-xl border border-pine/40 p-4 mb-4">
          <span className="text-sage text-[10px] font-bold uppercase tracking-wider">Your Reference Code</span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-white font-black text-2xl tracking-wider">{referenceCode}</span>
            <button
              onClick={() => copyToClipboard(referenceCode, setCopiedRef)}
              className="flex items-center gap-1.5 rounded-lg bg-pine/15 border border-pine/40 px-3 py-2 text-pine text-xs font-bold active:scale-95 transition-transform"
            >
              {copiedRef ? <><Check className="w-3.5 h-3.5" strokeWidth={2} /> Copied</> : <><Copy className="w-3.5 h-3.5" strokeWidth={1.5} /> Copy Code</>}
            </button>
          </div>
        </div>

        {/* Amount */}
        <div className="flex items-center justify-between bg-surface rounded-xl p-3 mb-4 border border-gray-800">
          <span className="text-sage text-sm font-bold">Listing Fee</span>
          <span className="text-pine font-black text-lg">P{amount}</span>
        </div>

        {/* Payment method tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMethod('fnb')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all ${
              method === 'fnb' ? 'bg-pine text-black' : 'bg-surface border border-gray-800 text-sage'
            }`}
          >
            <CreditCard className="w-4 h-4" strokeWidth={2} />
            FNB Pay2Cell
          </button>
          <button
            onClick={() => setMethod('ewallet')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all ${
              method === 'ewallet' ? 'bg-pine text-black' : 'bg-surface border border-gray-800 text-sage'
            }`}
          >
            <Wallet className="w-4 h-4" strokeWidth={2} />
            eWallet
          </button>
        </div>

        {/* Payment details */}
        <div className="bg-surface rounded-xl border border-gray-800 p-4 mb-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sage text-[10px] font-bold uppercase tracking-wider">
                {method === 'fnb' ? 'FNB Pay2Cell Number' : 'eWallet Number'}
              </span>
              <span className="text-white font-black text-lg">{currentNumber}</span>
            </div>
            <button
              onClick={() => copyToClipboard(currentNumber, setCopiedNum)}
              className="flex items-center gap-1 text-pine text-xs font-bold active:scale-95 transition-transform"
            >
              {copiedNum ? <><Check className="w-3.5 h-3.5" strokeWidth={2} /> Copied</> : <><Copy className="w-3.5 h-3.5" strokeWidth={1.5} /> Copy Number</>}
            </button>
          </div>

          <div className="bg-midnight rounded-lg p-3 border border-gray-800">
            {method === 'fnb' ? (
              <p className="text-sage text-[11px] leading-relaxed">
                Open FNB App &gt; Transact &gt; Pay2Cell (or dial *130*321#) &gt; Send payment to <span className="text-white font-bold">{fnbNumber}</span> &gt; Set payment reference to your code: <span className="text-pine font-bold">{referenceCode}</span>.
              </p>
            ) : (
              <p className="text-sage text-[11px] leading-relaxed">
                Send eWallet payment to <span className="text-white font-bold">{ewalletNumber}</span> &gt; Include <span className="text-pine font-bold">{referenceCode}</span> in the message or keep your reference ID handy.
              </p>
            )}
          </div>
        </div>

        {/* Payment ref input */}
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="text-sage text-xs font-bold uppercase tracking-wider">FNB inContact / SMS Confirmation ID (optional)</label>
          <input
            type="text"
            value={paymentRefId}
            onChange={(e) => setPaymentRefId(e.target.value)}
            placeholder="Paste your confirmation ID"
            className="bg-surface rounded-lg h-12 w-full px-4 border border-gray-800 text-white placeholder:text-sage/60 outline-none focus:border-pine transition-colors text-sm"
          />
        </div>

        <button
          onClick={handleConfirm}
          disabled={submitting}
          className="w-full h-12 rounded-xl bg-pine text-black font-bold text-base active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? 'Processing...' : ctaLabel}
        </button>
        <p className="text-center text-sage text-[10px] mt-3">
          Your listing goes live instantly. Admin will verify payment shortly.
        </p>
      </div>
    </div>
  );
}
