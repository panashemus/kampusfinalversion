'use client';

import { useState, useEffect } from 'react';
import {
  ReceiptText,
  BadgeCheck,
  Copy,
  Check,
  ShieldCheck,
  Loader as Loader2,
  PackageOpen,
  CreditCard,
  Wallet,
  Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

const STEPS = [
  { icon: ShieldCheck, label: 'Secure Deposit' },
  { icon: ReceiptText, label: 'Submit Ref ID' },
  { icon: BadgeCheck, label: 'Seller Notified' },
];

export default function EscrowVault({
  requireVerified,
}: {
  requireVerified: (action: () => void) => void;
}) {
  const { toast } = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [trades, setTrades] = useState<any[]>([]);

  const [verifying, setVerifying] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedNum, setCopiedNum] = useState(false);
  const [method, setMethod] = useState<'fnb' | 'ewallet'>('fnb');

  const [referenceCode, setReferenceCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [sellerEmail, setSellerEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [txRef, setTxRef] = useState('');

  useEffect(() => {
    setReferenceCode(`ESC-${Math.floor(1000 + Math.random() * 9000)}`);

    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email ?? '');
        fetchTrades(user.id);
      }
    };
    init();
  }, []);

  const fetchTrades = async (uid: string) => {
    const { data } = await supabase
      .from('escrow_transactions')
      .select('*')
      .eq('buyer_id', uid)
      .order('created_at', { ascending: false });
    if (data) setTrades(data);
  };

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('escrow_realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'escrow_transactions',
          filter: `buyer_id=eq.${userId}`,
        },
        (payload) => {
          fetchTrades(userId);
          if (payload.new.status === 'verified') {
            toast({
              title: 'Escrow Verified',
              description:
                'Your payment was confirmed by Admin. Funds are locked.',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, toast]);

  const canVerify =
    txRef.trim().length >= 6 &&
    itemName.trim().length > 0 &&
    sellerEmail.trim().length > 0 &&
    amount.trim().length > 0;

  const fnbNumber = '77037168';
  const ewalletNumber = '71321163';
  const currentNumber = method === 'fnb' ? fnbNumber : ewalletNumber;

  const handleVerify = () => {
    if (!canVerify) return;

    requireVerified(async () => {
      if (!userId || !userEmail) return;

      setVerifying(true);

      const { error } = await supabase.from('escrow_transactions').insert({
        buyer_id: userId,
        buyer_email: userEmail,
        seller_email: sellerEmail.trim().toLowerCase(),
        item_name: itemName.trim(),
        amount: Number(amount),
        payment_ref_id: txRef.trim(),
        escrow_ref_code: referenceCode,
        status: 'pending',
      });

      setVerifying(false);

      if (error) {
        toast({
          title: 'Error processing trade',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', sellerEmail.trim().toLowerCase())
        .single();

      if (sellerProfile) {
        await supabase.from('notifications').insert({
          user_id: sellerProfile.id,
          title: 'Escrow Funds Locked 🔒',
          body: `Buyer (${userEmail}) deposited P ${amount} into the Vault for '${itemName}'. Awaiting Admin verification.`,
          type: 'comment',
          read: false,
        });
      }

      try {
        await fetch('/api/notify-seller', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sellerEmail: sellerEmail.trim().toLowerCase(),
            buyerEmail: userEmail,
            itemName: itemName.trim(),
            amount: amount,
          }),
        });
      } catch {
        // Non-blocking fallback
      }

      toast({
        title: 'Escrow Deposit Logged',
        description: `Admin will verify Ref ${txRef}. Seller will be notified once confirmed.`,
      });

      setTxRef('');
      setItemName('');
      setSellerEmail('');
      setAmount('');
      fetchTrades(userId);
    });
  };

  const copyToClipboard = (text: string, isCode: boolean) => {
    navigator.clipboard?.writeText(text);
    if (isCode) {
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    } else {
      setCopiedNum(true);
      setTimeout(() => setCopiedNum(false), 2000);
    }
  };

  return (
    <div className="flex-1 bg-midnight flex flex-col overflow-y-auto px-4 pb-28 pt-3">
      {/* SECTION A — How Escrow Works */}
      <section className="bg-surface border border-gray-800 rounded-2xl p-4 shadow-md">
        <span className="text-sage text-xs font-bold uppercase tracking-wider">
          How Campus Escrow Works
        </span>
        <div className="mt-3.5 flex items-start justify-between">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="flex flex-col items-center gap-2 flex-1">
                <div className="w-10 h-10 rounded-xl bg-ink border border-pine/30 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-pine" strokeWidth={1.75} />
                </div>
                <span className="text-white text-[11px] font-bold text-center leading-tight">
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION B — Payment Activation Card */}
      <section className="mt-4 bg-surface border border-gray-800 shadow-lg rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-white font-black text-base">
              Secure a Trade
            </span>
            <span className="text-sage text-xs">
              Funds stay locked until you confirm delivery
            </span>
          </div>
          <div className="w-9 h-9 rounded-full bg-ink border border-pine/30 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-pine" strokeWidth={2} />
          </div>
        </div>

        {/* Reference Code Box */}
        <div className="bg-ink border border-pine/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-sage font-bold">
              Escrow Ref Code
            </div>
            <div className="text-2xl font-black text-pine tracking-wider mt-0.5">
              {referenceCode}
            </div>
          </div>
          <button
            onClick={() => copyToClipboard(referenceCode, true)}
            className="flex items-center gap-1.5 bg-pine/10 border border-pine/30 text-pine px-3 py-2 rounded-lg text-xs font-bold hover:bg-pine/20 active:scale-95 transition-all"
          >
            {copiedRef ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copiedRef ? 'Copied' : 'Copy Code'}
          </button>
        </div>

        {/* Payment Method Tabs */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMethod('fnb')}
            className={`flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold border transition-all active:scale-95 ${
              method === 'fnb'
                ? 'bg-pine text-black border-pine shadow-md'
                : 'bg-ink border-gray-800 text-sage hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" strokeWidth={2} />
            FNB Pay2Cell
          </button>
          <button
            onClick={() => setMethod('ewallet')}
            className={`flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold border transition-all active:scale-95 ${
              method === 'ewallet'
                ? 'bg-pine text-black border-pine shadow-md'
                : 'bg-ink border-gray-800 text-sage hover:text-white'
            }`}
          >
            <Wallet className="w-4 h-4" strokeWidth={2} />
            eWallet
          </button>
        </div>

        {/* Instructions */}
        <div className="bg-ink border border-gray-800 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-sage">
                {method === 'fnb' ? 'FNB Pay2Cell Number' : 'eWallet Number'}
              </div>
              <div className="text-lg font-black text-white mt-0.5">
                {currentNumber}
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(currentNumber, false)}
              className="flex items-center gap-1 text-pine text-xs font-bold active:scale-95 transition-transform"
            >
              {copiedNum ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copiedNum ? 'Copied' : 'Copy Number'}
            </button>
          </div>

          <p className="text-sage text-xs leading-relaxed bg-black/40 p-3 rounded-lg">
            {method === 'fnb' ? (
              <>
                Send the agreed amount to{' '}
                <strong className="text-white">77037168</strong> via FNB. Use{' '}
                <strong className="text-pine">{referenceCode}</strong> as the
                reference.
              </>
            ) : (
              <>
                Send the agreed eWallet to{' '}
                <strong className="text-white">71321163</strong>. Keep your
                transaction reference handy.
              </>
            )}
          </p>
        </div>

        {/* Verification Inputs */}
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-sage">
              Item or Service
            </label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Calculus Textbook / Graphic Design"
              disabled={verifying}
              required
              className="bg-ink rounded-xl h-11 w-full px-3.5 border border-gray-800 text-white placeholder:text-sage/60 outline-none focus:border-pine text-xs transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-sage">
                Amount (Pula)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={verifying}
                required
                className="bg-ink rounded-xl h-11 w-full px-3.5 border border-gray-800 text-white placeholder:text-sage/60 outline-none focus:border-pine text-xs transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-sage">
                Seller&apos;s Email
              </label>
              <input
                type="email"
                value={sellerEmail}
                onChange={(e) => setSellerEmail(e.target.value)}
                placeholder="seller@ub.ac.bw"
                disabled={verifying}
                required
                className="bg-ink rounded-xl h-11 w-full px-3.5 border border-gray-800 text-white placeholder:text-sage/60 outline-none focus:border-pine text-xs transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-800">
            <label className="text-xs font-bold uppercase tracking-wider text-sage">
              Transaction Reference ID
            </label>
            <input
              type="text"
              value={txRef}
              onChange={(e) => setTxRef(e.target.value)}
              placeholder="Paste FNB inContact or SMS Ref ID"
              disabled={verifying}
              required
              minLength={6}
              className="bg-ink rounded-xl h-11 w-full px-3.5 border border-gray-800 text-white placeholder:text-sage/60 outline-none focus:border-pine transition-colors disabled:opacity-50 text-xs"
            />
            {txRef.length > 0 && txRef.length < 6 && (
              <span className="text-red-400 text-[11px] font-bold">
                Transaction ID must be at least 6 characters
              </span>
            )}
          </div>
        </div>

        <button
          onClick={handleVerify}
          disabled={verifying || !canVerify}
          className="w-full h-12 rounded-xl bg-pine text-black font-black text-sm active:scale-[0.97] transition-all duration-150 ease-out disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg"
        >
          {verifying && (
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
          )}
          <span>{verifying ? 'Verifying...' : 'Lock Funds in Escrow'}</span>
        </button>
      </section>

      {/* SECTION C — Protected Trades History */}
      <section className="mt-6">
        <span className="text-sage text-xs font-bold uppercase tracking-wider px-1">
          Protected Trades History
        </span>

        {trades.length === 0 ? (
          <div className="mt-3 bg-surface border border-gray-800 rounded-2xl flex flex-col items-center justify-center gap-2.5 py-10 px-4">
            <div className="w-12 h-12 rounded-full bg-ink border border-gray-800 flex items-center justify-center">
              <PackageOpen className="w-5 h-5 text-sage" strokeWidth={1.5} />
            </div>
            <span className="text-white text-xs font-bold">
              No protected trades yet
            </span>
            <span className="text-sage text-[11px] text-center max-w-[230px]">
              Your escrow-protected transactions will appear here once you lock
              a deposit.
            </span>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {trades.map((trade) => (
              <div
                key={trade.id}
                className={`relative overflow-hidden rounded-2xl p-4 flex flex-col gap-3 bg-surface border ${
                  trade.status === 'verified'
                    ? 'border-pine/50'
                    : 'border-gray-800'
                }`}
              >
                <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
                  <span className="text-white font-bold text-sm">
                    {trade.item_name}
                  </span>
                  {trade.status === 'verified' ? (
                    <div className="flex items-center gap-1 bg-pine text-black px-2.5 py-0.5 rounded-full text-[10px] font-black">
                      <Check className="w-3 h-3" /> Verified
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 bg-ink border border-pine/40 text-pine px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                      <Clock className="w-3 h-3" /> Pending Audit
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-sage">Amount Secured</span>
                    <span className="font-black text-pine">
                      P {trade.amount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sage">Seller</span>
                    <span className="text-white font-bold">
                      {trade.seller_email}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
