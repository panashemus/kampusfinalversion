'use client';

import { useState } from 'react';
import { Store, ReceiptText, BadgeCheck, Copy, Check, ShieldCheck, Loader as Loader2, PackageOpen } from 'lucide-react';

const STEPS = [
  { icon: Store, label: 'Pay Merchant Till' },
  { icon: ReceiptText, label: 'Submit Ref ID' },
  { icon: BadgeCheck, label: 'Instant Seller Badge' },
];

export default function EscrowVault({
  requireVerified,
}: {
  requireVerified: (action: () => void) => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [txRef, setTxRef] = useState('');

  const canVerify = txRef.trim().length >= 6;

  const handleVerify = () => {
    if (!canVerify) return;
    requireVerified(() => {
      setVerifying(true);
      setTimeout(() => setVerifying(false), 2000);
    });
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText('12345');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 bg-midnight flex flex-col overflow-y-auto px-4 pb-24 pt-2">
      {/* SECTION A — How Escrow Works */}
      <section className="mt-2">
        <span className="text-sage text-xs font-bold uppercase tracking-wider">
          How Escrow Works
        </span>
        <div className="mt-3 flex items-start justify-between">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="flex flex-col items-center gap-2 flex-1">
                <div className="w-12 h-12 rounded-full bg-surface border border-gray-800 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-pine" strokeWidth={1.5} />
                </div>
                <span className="text-sage text-[10px] text-center leading-tight">
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION B — Payment Activation Card */}
      <section className="mt-6 bg-surface rounded-2xl p-5 flex flex-col gap-4">
        <span className="text-white font-bold text-sm">Payment Activation</span>

        {/* Merchant Till box */}
        <div className="flex items-center justify-between bg-ink rounded-lg h-12 px-4 border border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-sage text-xs">Merchant Till</span>
            <span className="text-white font-bold text-sm">#12345</span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-pine text-xs font-bold active:scale-95 transition-transform"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" strokeWidth={2} />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                Tap to Copy
              </>
            )}
          </button>
        </div>

        <p className="text-sage text-xs leading-relaxed">
          Send P20 to the till above via Orange Money, then paste your
          transaction reference below.
        </p>

        <input
          type="text"
          value={txRef}
          onChange={(e) => setTxRef(e.target.value)}
          placeholder="Enter Transaction Reference ID"
          disabled={verifying}
          required
          minLength={6}
          className="bg-ink rounded-lg h-12 w-full px-4 border border-gray-800 text-white placeholder:text-sage outline-none focus:border-sage transition-colors disabled:opacity-50"
        />
        {txRef.length > 0 && txRef.length < 6 && (
          <span className="text-red-400 text-[10px] font-bold">Transaction ID must be at least 6 characters</span>
        )}

        <button
          onClick={handleVerify}
          disabled={verifying || !canVerify}
          className="w-full h-12 rounded-lg bg-pine text-black font-bold text-base active:scale-95 transition-transform disabled:active:scale-100 disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {verifying && <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />}
          {verifying ? 'Verification Pending...' : 'Verify Payment'}
        </button>
      </section>

      {/* SECTION C — Protected Trades History */}
      <section className="mt-6">
        <span className="text-sage text-xs font-bold uppercase tracking-wider">
          Protected Trades History
        </span>
        <div className="mt-3 flex flex-col items-center justify-center gap-3 py-12">
          <div className="w-16 h-16 rounded-full bg-surface border border-gray-800 flex items-center justify-center">
            <PackageOpen className="w-7 h-7 text-sage" strokeWidth={1.5} />
          </div>
          <span className="text-white text-sm font-bold text-center">
            No protected trades yet
          </span>
          <span className="text-sage text-xs text-center max-w-[240px]">
            Your escrow-protected trades will appear here once you start trading on campus.
          </span>
        </div>
      </section>
    </div>
  );
}
