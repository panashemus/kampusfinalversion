'use client';

import { useState, useEffect } from 'react';
import { ReceiptText, BadgeCheck, Copy, Check, ShieldCheck, Loader as Loader2, PackageOpen, CreditCard, Wallet, Clock } from 'lucide-react';
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
  
  // User & DB State
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [trades, setTrades] = useState<any[]>([]);
  
  // UI State
  const [verifying, setVerifying] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedNum, setCopiedNum] = useState(false);
  const [method, setMethod] = useState<'fnb' | 'ewallet'>('fnb');
  
  // Form State
  const [referenceCode, setReferenceCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [sellerEmail, setSellerEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [txRef, setTxRef] = useState('');

  useEffect(() => {
    // Generate a unique Escrow code on mount
    setReferenceCode(`ESC-${Math.floor(1000 + Math.random() * 9000)}`);

    // Fetch user and load their past trades
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
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

  // Listen for Admin Approvals in Real-Time
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('escrow_realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'escrow_transactions', filter: `buyer_id=eq.${userId}` },
        (payload) => {
          fetchTrades(userId);
          if (payload.new.status === 'verified') {
            toast({
              title: 'Escrow Verified! 💰',
              description: 'Your payment was confirmed by Admin. Receipt is ready!',
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, toast]);

  // Validation
  const canVerify = txRef.trim().length >= 6 && itemName.trim().length > 0 && sellerEmail.trim().length > 0 && amount.trim().length > 0;

  const fnbNumber = '77037168';
  const ewalletNumber = '71321163';
  const currentNumber = method === 'fnb' ? fnbNumber : ewalletNumber;

  const handleVerify = () => {
    if (!canVerify) return;
    
    requireVerified(async () => {
      if (!userId || !userEmail) return;
      
      setVerifying(true);

      // INSERT INTO SUPABASE
      const { error } = await supabase.from('escrow_transactions').insert({
        buyer_id: userId,
        buyer_email: userEmail,
        seller_email: sellerEmail.trim().toLowerCase(),
        item_name: itemName.trim(),
        amount: Number(amount),
        payment_ref_id: txRef.trim(),
        status: 'pending',
      });

      setVerifying(false);

      if (error) {
        toast({ title: 'Error processing trade', description: error.message, variant: 'destructive' });
        return;
      }

      toast({
        title: 'Escrow Deposit Pending',
        description: `Admin will verify Ref ${txRef}. The seller will be notified once funds are secured!`,
      });
      
      // Clear form and refresh history
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
      <section className="mt-6 bg-surface rounded-2xl p-5 flex flex-col gap-4 border border-gray-800">
        <div className="flex items-center justify-between">
          <span className="text-white font-bold text-sm">Secure a Trade</span>
          <ShieldCheck className="w-5 h-5 text-pine" strokeWidth={2} />
        </div>

        {/* Reference Code Box */}
        <div className="bg-ink border border-pine/30 rounded-xl p-4 flex items-center justify-between mt-1">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-sage font-bold">Escrow Ref Code</div>
            <div className="text-xl font-extrabold text-pine tracking-wider mt-1">{referenceCode}</div>
          </div>
          <button
            onClick={() => copyToClipboard(referenceCode, true)}
            className="flex items-center gap-1.5 bg-pine/10 border border-pine/30 text-pine px-3 py-2 rounded-lg text-xs font-semibold hover:bg-pine/20 transition-colors"
          >
            {copiedRef ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedRef ? 'Copied' : 'Copy Code'}
          </button>
        </div>

        {/* Payment Method Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setMethod('fnb')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all ${
              method === 'fnb' ? 'bg-pine text-black border-pine' : 'bg-ink border border-gray-800 text-sage'
            }`}
          >
            <CreditCard className="w-4 h-4" strokeWidth={2} />
            FNB Pay2Cell
          </button>
          <button
            onClick={() => setMethod('ewallet')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold transition-all ${
              method === 'ewallet' ? 'bg-pine text-black border-pine' : 'bg-ink border border-gray-800 text-sage'
            }`}
          >
            <Wallet className="w-4 h-4" strokeWidth={2} />
            eWallet
          </button>
        </div>

        {/* Instructions */}
        <div className="bg-ink border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-sage">
                {method === 'fnb' ? 'FNB Pay2Cell Number' : 'eWallet Number'}
              </div>
              <div className="text-lg font-extrabold text-white">{currentNumber}</div>
            </div>
            <button
              onClick={() => copyToClipboard(currentNumber, false)}
              className="flex items-center gap-1 text-pine text-xs font-bold active:scale-95 transition-transform"
            >
              {copiedNum ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedNum ? 'Copied' : 'Copy'}
            </button>
          </div>
          
          <p className="text-sage text-[11px] leading-relaxed bg-black/50 p-3 rounded-lg">
            {method === 'fnb' ? (
              <>Send the agreed amount to <strong className="text-white">77037168</strong> via FNB. Use your code <strong className="text-pine">{referenceCode}</strong> as the reference. We will notify the seller once funds are locked.</>
            ) : (
              <>Send the agreed eWallet to <strong className="text-white">71321163</strong>. Keep your transaction reference handy. We will notify the seller once funds are locked.</>
            )}
          </p>
        </div>

        {/* Verification Inputs */}
        <div className="flex flex-col gap-3 mt-2">
          
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-sage">Item / Service</label>
            <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Graphic Design Logo" disabled={verifying} required className="bg-ink rounded-lg h-10 w-full px-4 border border-gray-800 text-white placeholder:text-sage/60 outline-none focus:border-pine text-sm" />
          </div>

          <div className="flex gap-2">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[10px] uppercase font-bold text-sage">Amount (Pula)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" disabled={verifying} required className="bg-ink rounded-lg h-10 w-full px-4 border border-gray-800 text-white placeholder:text-sage/60 outline-none focus:border-pine text-sm" />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[10px] uppercase font-bold text-sage">Seller's Email</label>
              <input type="email" value={sellerEmail} onChange={(e) => setSellerEmail(e.target.value)} placeholder="@ub.ac.bw" disabled={verifying} required className="bg-ink rounded-lg h-10 w-full px-4 border border-gray-800 text-white placeholder:text-sage/60 outline-none focus:border-pine text-sm" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-800">
            <label className="text-[10px] uppercase font-bold text-sage">Enter Transaction Reference ID</label>
            <input
              type="text"
              value={txRef}
              onChange={(e) => setTxRef(e.target.value)}
              placeholder="e.g. FNB InContact ID"
              disabled={verifying}
              required
              minLength={6}
              className="bg-ink rounded-lg h-12 w-full px-4 border border-gray-800 text-white placeholder:text-sage/60 outline-none focus:border-pine transition-colors disabled:opacity-50 text-sm"
            />
            {txRef.length > 0 && txRef.length < 6 && (
              <span className="text-red-400 text-[10px] font-bold">Transaction ID must be at least 6 characters</span>
            )}
          </div>

        </div>

        <button
          onClick={handleVerify}
          disabled={verifying || !canVerify}
          className="w-full h-12 rounded-xl bg-pine text-black font-bold text-base active:scale-95 transition-transform disabled:active:scale-100 disabled:opacity-70 flex items-center justify-center gap-2 mt-1"
        >
          {verifying && <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />}
          {verifying ? 'Verifying...' : 'Lock Funds in Escrow'}
        </button>
      </section>

      {/* SECTION C — Protected Trades History */}
      <section className="mt-6">
        <span className="text-sage text-xs font-bold uppercase tracking-wider">
          Protected Trades History
        </span>
        
        {trades.length === 0 ? (
          <div className="mt-3 flex flex-col items-center justify-center gap-3 py-12">
            <div className="w-16 h-16 rounded-full bg-surface border border-gray-800 flex items-center justify-center">
              <PackageOpen className="w-7 h-7 text-sage" strokeWidth={1.5} />
            </div>
            <span className="text-white text-sm font-bold text-center">
              No protected trades yet
            </span>
            <span className="text-sage text-xs text-center max-w-[240px]">
              Your escrow-protected trades will appear here once you secure a deposit.
            </span>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {trades.map((trade) => (
              <div key={trade.id} className={`relative overflow-hidden rounded-2xl border p-5 flex flex-col gap-3 shadow-xl ${trade.status === 'verified' ? 'bg-pine/10 border-pine shadow-pine/20' : 'bg-surface border-gray-800'}`}>
                
                <div className="flex items-center justify-between border-b border-gray-800/50 pb-3">
                  <span className="text-white font-black text-lg">{trade.item_name}</span>
                  {trade.status === 'verified' ? (
                    <div className="flex items-center gap-1.5 bg-pine text-black px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider">
                      <Check className="w-3.5 h-3.5" /> Verified
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider animate-pulse">
                      <Clock className="w-3.5 h-3.5" /> Pending Admin
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-sage">Amount Secured:</span>
                    <strong className={`font-black text-base ${trade.status === 'verified' ? 'text-pine' : 'text-white'}`}>P {trade.amount}</strong>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-sage">Seller:</span>
                    <strong className="text-white">{trade.seller_email}</strong>
                  </div>
                </div>

                {trade.status === 'verified' && (
                  <div className="absolute -bottom-6 -right-6 opacity-5 pointer-events-none">
                    <ShieldCheck className="w-32 h-32 text-pine" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
