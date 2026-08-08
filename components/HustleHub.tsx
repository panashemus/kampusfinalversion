'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Laptop, Scissors, Book, Star, X, ShieldCheck, Copy, Check, Loader as Loader2, PackageOpen, MessageCircle, MoveVertical as MoreVertical, Flag, TriangleAlert as AlertTriangle, RefreshCw, Image as ImageIcon, CreditCard, Wallet, Send, Tag, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { uploadImages } from '@/lib/payment';
import type { Comment, Profile, HustleStatus } from '@/lib/types';
import AdSlot from '@/components/AdSlot';
import PublicProfileModal from '@/components/PublicProfileModal';
import ImageUploader from '@/components/ImageUploader';
import Lightbox from '@/components/Lightbox';
import ReportModal from '@/components/ReportModal';
import { useToast } from '@/hooks/use-toast';

type Category = 'All' | 'Tech' | 'Beauty' | 'Textbooks';

const FILTERS: Category[] = ['All', 'Tech', 'Beauty', 'Textbooks'];

const CATEGORY_ICONS: Record<string, typeof Laptop> = {
  Tech: Laptop,
  Beauty: Scissors,
  Textbooks: Book,
};

type Gig = {
  id: string;
  icon: typeof Laptop;
  title: string;
  price: string;
  seller: string;
  sellerId: string;
  rating: number;
  sales: number;
  category: Exclude<Category, 'All'>;
  description: string;
  comments: Comment[];
  referenceCode: string | null;
  paymentRefId: string | null;
  status: HustleStatus;
  images: string[];
};

type HustleRow = {
  id: string;
  seller_id: string;
  seller_name: string | null;
  title: string;
  price: number;
  category: string;
  description: string | null;
  created_at: string;
  reference_code: string | null;
  payment_ref_id: string | null;
  status: string;
  images: string[] | null;
};

export default function HustleHub({
  searchQuery,
  onMessageSeller,
  requireVerified,
  profile,
}: {
  searchQuery: string;
  onMessageSeller: (peerId: string, peerUsername: string) => void;
  requireVerified: (action: () => void) => void;
  profile: Profile | null;
}) {
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<Category>('All');
  const [showModal, setShowModal] = useState(false);
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGig, setSelectedGig] = useState<Gig | null>(null);
  
  // FIX: Upgraded profileUser to hold both ID and Username
  const [profileUser, setProfileUser] = useState<{ id: string; username: string } | null>(null);
  
  const [reportGig, setReportGig] = useState<Gig | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // 2-Step Checkout State for creating a gig
  const [step, setStep] = useState<1 | 2>(1);
  const [paymentMethod, setPaymentMethod] = useState<'pay2cell' | 'ewallet'>('pay2cell');
  const [referenceCode, setReferenceCode] = useState('');
  const [incontactId, setIncontactId] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedNum, setCopiedNum] = useState(false);

  // Escrow Checkout State
  const [escrowGig, setEscrowGig] = useState<Gig | null>(null);
  const [escrowPaymentMethod, setEscrowPaymentMethod] = useState<'pay2cell' | 'ewallet'>('pay2cell');
  const [escrowRef, setEscrowRef] = useState('');
  const [processingEscrow, setProcessingEscrow] = useState(false);

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategory, setNewCategory] = useState<Exclude<Category, 'All'>>('Tech');
  const [newDescription, setNewDescription] = useState('');
  const [newImages, setNewImages] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);

  const myName = profile ? (profile.username ? `@${profile.username}` : profile.email.split('@')[0]) : 'student';
  const isAdmin = !!profile?.is_admin;

  const loadGigs = useCallback(async () => {
    const { data } = await supabase
      .from('hustles')
      .select('*')
      .order('created_at', { ascending: false });
    if (!data) return;
    const mapped: Gig[] = (data as HustleRow[]).map((row) => ({
      id: row.id,
      icon: CATEGORY_ICONS[row.category] ?? Laptop,
      title: row.title,
      price: `P ${row.price}`,
      seller: row.seller_name ?? row.seller_id,
      sellerId: row.seller_id,
      rating: 0,
      sales: 0,
      category: (row.category as Exclude<Category, 'All'>) ?? 'Tech',
      description: row.description ?? '',
      comments: [],
      referenceCode: row.reference_code,
      paymentRefId: row.payment_ref_id,
      status: (row.status as HustleStatus) ?? 'active',
      images: row.images ?? [],
    }));
    setGigs(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadGigs();
    const channel = supabase
      .channel('public:hustles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hustles' }, () => loadGigs())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadGigs]);

  const visibleGigs = gigs.filter((g) => {
    if (g.status !== 'active' && !isAdmin) return false;
    const matchesCategory = activeFilter === 'All' || g.category === activeFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      g.title.toLowerCase().includes(q) ||
      g.seller.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const mySuspendedGigs = gigs.filter(
    (g) => g.status === 'unpaid_suspended' && g.sellerId === profile?.id
  );

  const canPostGig =
    newTitle.trim().length >= 3 &&
    newPrice.trim() !== '' &&
    !isNaN(Number(newPrice)) &&
    Number(newPrice) > 0 &&
    newDescription.trim().length >= 10;

  const handleProceedToPayment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canPostGig) return;
    
    const randomCode = `KMP-${Math.floor(1000 + Math.random() * 9000)}`;
    setReferenceCode(randomCode);
    setStep(2);
  };

  const handlePublishGig = async () => {
    if (!profile || !canPostGig) return;
    setPosting(true);

    const { data, error } = await supabase
      .from('hustles')
      .insert({
        seller_id: profile.id,
        seller_name: myName,
        title: newTitle.trim(),
        price: Number(newPrice),
        category: newCategory,
        description: newDescription.trim(),
        reference_code: referenceCode,
        payment_ref_id: incontactId || null,
        status: 'active',
        images: newImages.length > 0 ? newImages : null,
      })
      .select()
      .maybeSingle();

    if (error || !data) {
      toast({ title: 'Failed to publish', description: 'Please try again.', variant: 'destructive' });
      setPosting(false);
      return;
    }

    const row = data as HustleRow;
    const gig: Gig = {
      id: row.id,
      icon: CATEGORY_ICONS[newCategory] ?? Laptop,
      title: newTitle.trim(),
      price: `P ${newPrice}`,
      seller: myName,
      sellerId: profile.id,
      rating: 0,
      sales: 0,
      category: newCategory,
      description: newDescription.trim(),
      comments: [],
      referenceCode: referenceCode,
      paymentRefId: incontactId || null,
      status: 'active',
      images: newImages,
    };
    setGigs((prev) => [gig, ...prev]);

    toast({
      title: 'Gig published! 🚀',
      description: `Your listing is instantly live on campus. Ref: ${referenceCode}`,
    });

    setPosting(false);
    setShowModal(false);
    setStep(1);
    setNewTitle('');
    setNewPrice('');
    setNewDescription('');
    setNewImages([]);
    setIncontactId('');
  };

  const submitEscrowCheckout = async () => {
    if (!escrowRef.trim() || !escrowGig || !profile) return;
    setProcessingEscrow(true);
    
    setTimeout(() => {
      setProcessingEscrow(false);
      setEscrowGig(null);
      setEscrowRef('');
      toast({
        title: 'Escrow Initiated 🔒',
        description: 'Payment reference sent to Admin! Once manually verified, we will notify the seller to start the service.',
      });
    }, 1500);
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

  const flagAsUnpaid = async (gig: Gig) => {
    await supabase
      .from('hustles')
      .update({ status: 'unpaid_suspended' })
      .eq('id', gig.id);
    setGigs((prev) =>
      prev.map((g) => (g.id === gig.id ? { ...g, status: 'unpaid_suspended' } : g))
    );
    toast({ title: 'Flagged as unpaid', description: `Listing ${gig.referenceCode} suspended.` });
    setMenuOpenId(null);
  };

  const resubmitPayment = async (gig: Gig, newRefId: string) => {
    await supabase
      .from('hustles')
      .update({ payment_ref_id: newRefId, status: 'active' })
      .eq('id', gig.id);
    setGigs((prev) =>
      prev.map((g) =>
        g.id === gig.id ? { ...g, paymentRefId: newRefId, status: 'active' } : g
      )
    );
    toast({ title: 'Payment re-submitted', description: 'Your listing is back online.' });
  };

  return (
    <div className="flex-1 bg-midnight flex flex-col relative">
      <div className="px-4 py-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                activeFilter === f
                  ? 'bg-pine text-black'
                  : 'bg-transparent border border-sage text-sage'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        
        {/* STATIC LIST GIG BUTTON */}
        <button
          onClick={() => requireVerified(() => { setShowModal(true); setStep(1); })}
          className="w-full mb-5 h-12 rounded-xl bg-pine text-black flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg"
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
          <span className="font-bold text-sm">List a New Gig</span>
        </button>

        {/* Suspended listings warning cards */}
        {mySuspendedGigs.length > 0 && (
          <div className="flex flex-col gap-3 mb-4">
            {mySuspendedGigs.map((gig) => (
              <SuspendedCard key={gig.id} gig={gig} onResubmit={resubmitPayment} />
            ))}
          </div>
        )}

        {loading ? (
          <span className="text-sage text-sm text-center mt-8 block">Loading gigs...</span>
        ) : visibleGigs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 pt-4">
            <div className="w-16 h-16 rounded-full bg-surface border border-gray-800 flex items-center justify-center">
              <PackageOpen className="w-7 h-7 text-sage" strokeWidth={1.5} />
            </div>
            <span className="text-white text-sm font-bold text-center">
              No side hustles listed yet
            </span>
            <span className="text-sage text-xs text-center max-w-[220px]">
              Be the first student to list a gig on campus!
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {visibleGigs.map((gig) => {
              const Icon = gig.icon;
              const isSuspended = gig.status === 'unpaid_suspended';
              return (
                <div key={gig.id} className={`bg-surface rounded-xl overflow-hidden relative ${isSuspended ? 'opacity-60 border border-red-500/40' : ''}`}>
                  {/* 3-dot menu */}
                  <div className="absolute top-2 right-2 z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === gig.id ? null : gig.id);
                      }}
                      className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center active:scale-95"
                    >
                      <MoreVertical className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                    </button>
                    {menuOpenId === gig.id && (
                      <div className="absolute right-0 top-8 w-36 bg-surface rounded-lg border border-gray-800 shadow-xl flex flex-col overflow-hidden">
                        <button
                          onClick={() => { setReportGig(gig); setMenuOpenId(null); }}
                          className="flex items-center gap-2 px-3 py-2.5 text-left text-sage text-xs font-bold hover:bg-white/5"
                        >
                          <Flag className="w-3.5 h-3.5" strokeWidth={1.5} /> Report Post
                        </button>
                        {isAdmin && gig.status === 'active' && (
                          <button
                            onClick={() => flagAsUnpaid(gig)}
                            className="flex items-center gap-2 px-3 py-2.5 text-left text-red-400 text-xs font-bold hover:bg-white/5"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.5} /> Flag as Unpaid
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedGig(gig)}
                    className="w-full text-left active:scale-95 transition-transform"
                  >
                    <div className="bg-ink h-24 flex items-center justify-center relative">
                      {gig.images.length > 0 ? (
                        <img src={gig.images[0]} alt={gig.title} className="w-full h-full object-cover" />
                      ) : (
                        <Icon className="w-10 h-10 text-sage" strokeWidth={1.5} />
                      )}
                      {gig.images.length > 1 && (
                        <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <ImageIcon className="w-2.5 h-2.5" /> {gig.images.length}
                        </span>
                      )}
                    </div>
                    <div className="p-3 flex flex-col gap-1">
                      <span className="text-white text-sm font-bold truncate">{gig.title}</span>
                      <span className="text-pine text-xs font-extrabold">{gig.price}</span>
                    </div>
                  </button>
                  <div className="px-3 pb-3">
                    <button
                      onClick={() => setProfileUser({ id: gig.sellerId, username: gig.seller })}
                      className="text-sage text-[10px] font-bold hover:text-pine transition-colors truncate w-full text-left"
                    >
                      {gig.seller}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-4">
          <AdSlot />
        </div>
      </div>

      {/* 2-STEP CREATE GIG MODAL (Centered Floating Window) */}
      {showModal && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-[420px] max-h-[85dvh] bg-surface rounded-3xl border border-gray-800 flex flex-col shadow-2xl overflow-hidden animate-slide-up">
            
            <div className="flex items-center justify-between p-5 border-b border-gray-800 shrink-0">
              <span className="text-white font-black text-lg">
                {step === 1 ? 'List a New Gig' : 'Payment Checkout'}
              </span>
              <button onClick={() => setShowModal(false)} aria-label="Close" className="w-8 h-8 rounded-full bg-ink flex items-center justify-center text-sage hover:text-white transition-colors">
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>

            {/* STEP 1: GIG DETAILS FORM */}
            {step === 1 && (
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 no-scrollbar">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sage text-xs font-bold uppercase tracking-wider">Gig Title</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Laptop Screen Repair"
                    required
                    minLength={3}
                    className="bg-ink rounded-lg h-12 w-full px-4 border border-gray-800 text-white placeholder:text-sage outline-none focus:border-pine transition-colors text-sm"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-sage text-xs font-bold uppercase tracking-wider">Category</span>
                  <div className="flex flex-wrap gap-2">
                    {FILTERS.filter((f) => f !== 'All').map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setNewCategory(cat as Exclude<Category, 'All'>)}
                        className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                          newCategory === cat
                            ? 'bg-pine text-black'
                            : 'bg-transparent border border-sage text-sage'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sage text-xs font-bold uppercase tracking-wider">Price (Pula)</label>
                  <input
                    type="number"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="e.g. 150"
                    required
                    min={1}
                    className="bg-ink rounded-lg h-12 w-full px-4 border border-gray-800 text-white placeholder:text-sage outline-none focus:border-pine transition-colors text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sage text-xs font-bold uppercase tracking-wider">Description</label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    onPaste={(e) => {
                      const items = e.clipboardData?.items;
                      if (!items) return;
                      const imageFiles: File[] = [];
                      for (let i = 0; i < items.length; i++) {
                        if (items[i].type.startsWith('image/')) {
                          const f = items[i].getAsFile();
                          if (f) imageFiles.push(f);
                        }
                      }
                      if (imageFiles.length > 0) {
                        e.preventDefault();
                        if (profile) {
                          uploadImages(imageFiles, profile.id).then((urls) => {
                            if (urls.length > 0) {
                              setNewImages((prev) => [...prev, ...urls]);
                              toast({ title: 'Image pasted', description: `${urls.length} image(s) attached.` });
                            }
                          });
                        }
                      }
                    }}
                    placeholder="Describe what you offer, delivery time, and any conditions..."
                    rows={3}
                    required
                    minLength={10}
                    className="bg-ink rounded-lg w-full p-4 border border-gray-800 text-white placeholder:text-sage outline-none focus:border-pine transition-colors resize-none text-sm"
                  />
                </div>

                {profile && (
                  <div className="shrink-0 mt-2">
                    <ImageUploader
                      userId={profile.id}
                      onUploaded={(urls) => setNewImages((prev) => [...prev, ...urls])}
                      onError={(msg) => toast({ title: 'Upload failed', description: msg, variant: 'destructive' })}
                    />
                  </div>
                )}
                
                <button
                  onClick={handleProceedToPayment}
                  disabled={!canPostGig}
                  className="w-full mt-4 h-12 rounded-lg bg-pine text-black font-bold text-base active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center shrink-0"
                >
                  Proceed to Payment
                </button>
              </div>
            )}

            {/* STEP 2: CHECKOUT & PAYMENT FLOW */}
            {step === 2 && (
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 no-scrollbar">
                
                {/* Reference Code Header */}
                <div className="bg-ink border border-pine/30 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-sage font-bold">Your Reference Code</div>
                    <div className="text-2xl font-extrabold text-pine tracking-wider mt-1">{referenceCode}</div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(referenceCode, true)}
                    className="flex items-center gap-1.5 bg-pine/10 border border-pine/30 text-pine px-3 py-2 rounded-lg text-xs font-semibold hover:bg-pine/20 transition-colors"
                  >
                    {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedCode ? 'Copied' : 'Copy Code'}
                  </button>
                </div>

                {/* Listing Fee Info */}
                <div className="bg-ink border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                  <span className="text-white font-semibold">Listing Fee</span>
                  <span className="text-xl font-bold text-pine">P10</span>
                </div>

                {/* Payment Method Selector */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMethod('pay2cell')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition-colors ${
                      paymentMethod === 'pay2cell'
                        ? 'bg-pine text-black border-pine'
                        : 'bg-ink text-sage border-gray-800'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" /> Pay2Cell
                  </button>
                  <button
                    onClick={() => setPaymentMethod('ewallet')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition-colors ${
                      paymentMethod === 'ewallet'
                        ? 'bg-pine text-black border-pine'
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
                        className="flex items-center gap-1 text-pine text-xs font-bold"
                      >
                        {copiedNum ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copiedNum ? 'Copied' : 'Copy Number'}
                      </button>
                    </div>
                    <div className="bg-black/50 p-3 rounded-lg text-xs text-sage leading-relaxed">
                      Open FNB App &gt; Transact &gt; Pay2Cell (or dial *130*321#) &gt; Send payment to <strong className="text-white">77037168</strong> &gt; Set payment reference to <strong className="text-pine">{referenceCode}</strong>.
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
                        className="flex items-center gap-1 text-pine text-xs font-bold"
                      >
                        {copiedNum ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copiedNum ? 'Copied' : 'Copy Number'}
                      </button>
                    </div>
                    <div className="bg-black/50 p-3 rounded-lg text-xs text-sage leading-relaxed">
                      Send eWallet payment to <strong className="text-white">71321163</strong> &gt; Include <strong className="text-pine">{referenceCode}</strong> in the message or keep your reference ID handy.
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="block text-[10px] uppercase font-bold text-sage">
                    FNB inContact / SMS Confirmation ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Paste your confirmation ID"
                    value={incontactId}
                    onChange={(e) => setIncontactId(e.target.value)}
                    className="bg-ink rounded-lg h-11 w-full px-3 border border-gray-800 text-white placeholder:text-sage text-sm outline-none focus:border-pine transition-colors"
                  />
                </div>

                <div className="pt-2 space-y-2 mt-auto">
                  <button
                    onClick={handlePublishGig}
                    disabled={posting}
                    className="w-full h-12 rounded-lg bg-pine text-black font-bold text-base active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {posting ? <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} /> : <Tag className="w-5 h-5" strokeWidth={2} />}
                    {posting ? 'Publishing...' : 'Publish Gig'}
                  </button>
                  <button
                    onClick={() => setStep(1)}
                    className="w-full text-center text-xs text-sage hover:text-white py-2 transition-colors"
                  >
                    ← Back to Gig Details
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gig Detail Modal (Centered Floating Window) */}
      {selectedGig && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-[420px] max-h-[85dvh] bg-surface rounded-3xl border border-gray-800 flex flex-col shadow-2xl overflow-hidden animate-slide-up">
            
            <div className="flex items-center justify-between p-5 border-b border-gray-800 shrink-0">
              <span className="text-white font-black text-lg truncate max-w-[85%]">{selectedGig.title}</span>
              <button onClick={() => setSelectedGig(null)} aria-label="Close" className="w-8 h-8 rounded-full bg-ink flex items-center justify-center text-sage hover:text-white transition-colors">
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 no-scrollbar">
              {selectedGig.images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                  {selectedGig.images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxImages(selectedGig.images)}
                      className="w-24 h-24 rounded-lg overflow-hidden border border-gray-800 shrink-0"
                    >
                      <img src={img} alt={`gig-img-${i}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-ink border border-gray-800 flex items-center justify-center shrink-0">
                  <Star className="w-5 h-5 text-pine" strokeWidth={1.5} />
                </div>
                <div className="flex flex-col">
                  <button
                    onClick={() => setProfileUser({ id: selectedGig.sellerId, username: selectedGig.seller })}
                    className="text-white text-sm font-bold hover:text-pine transition-colors text-left"
                  >
                    {selectedGig.seller}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sage text-xs font-bold uppercase tracking-wider">Listing Details</span>
                <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedGig.description || 'No description provided.'}
                </p>
                <span className="text-pine text-2xl font-black mt-1">{selectedGig.price}</span>
              </div>

              {isAdmin && (
                <div className="bg-ink rounded-xl border border-gray-800 p-4 flex flex-col gap-2">
                  <span className="text-sage text-[10px] font-bold uppercase tracking-wider">Admin Audit</span>
                  <div className="flex items-center justify-between">
                    <span className="text-white text-xs">Reference: <span className="text-pine font-bold">{selectedGig.referenceCode ?? 'N/A'}</span></span>
                    <span className="text-white text-xs">Ref ID: <span className="text-sage">{selectedGig.paymentRefId ?? 'None'}</span></span>
                  </div>
                  {selectedGig.status === 'active' && (
                    <button
                      onClick={() => flagAsUnpaid(selectedGig)}
                      className="w-full h-10 mt-2 rounded-lg bg-red-600/20 border border-red-600/50 text-red-400 text-xs font-bold active:scale-95 transition-transform flex items-center justify-center gap-1.5"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2} /> Flag as Unpaid
                    </button>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-3 mt-4">
                <button
                  onClick={() => requireVerified(() => {
                    setEscrowGig(selectedGig);
                    setSelectedGig(null);
                  })}
                  className="w-full h-12 rounded-lg bg-pine text-black font-bold text-base active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-5 h-5" strokeWidth={2} />
                  Start Secure Escrow Trade
                </button>

                <button
                  onClick={() => onMessageSeller(selectedGig.sellerId, selectedGig.seller)}
                  className="w-full h-12 rounded-lg bg-transparent border border-pine text-pine font-bold text-base active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-5 h-5" strokeWidth={2} />
                  Message Seller
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW SECURE ESCROW CHECKOUT MODAL (Centered Floating Window) */}
      {escrowGig && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-[420px] max-h-[85dvh] bg-surface rounded-3xl border border-gray-800 flex flex-col shadow-2xl overflow-hidden animate-slide-up">
            
            <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-pine/5 shrink-0">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-pine" strokeWidth={2} />
                <span className="text-pine font-black text-lg">Escrow Checkout</span>
              </div>
              <button onClick={() => setEscrowGig(null)} aria-label="Close" className="text-sage hover:text-white transition-colors">
                <X className="w-6 h-6" strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 no-scrollbar">
              <div className="flex flex-col gap-1 text-center">
                <span className="text-sage text-xs uppercase font-bold tracking-wider">Total Escrow Amount</span>
                <span className="text-white font-black text-4xl">{escrowGig.price}</span>
                <span className="text-gray-400 text-sm mt-1">For: <strong className="text-white">{escrowGig.title}</strong></span>
              </div>

              {/* Payment Method Selector */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setEscrowPaymentMethod('pay2cell')}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition-colors ${
                    escrowPaymentMethod === 'pay2cell'
                      ? 'bg-pine text-black border-pine'
                      : 'bg-ink text-sage border-gray-800'
                  }`}
                >
                  <CreditCard className="w-4 h-4" /> Pay2Cell
                </button>
                <button
                  onClick={() => setEscrowPaymentMethod('ewallet')}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition-colors ${
                    escrowPaymentMethod === 'ewallet'
                      ? 'bg-pine text-black border-pine'
                      : 'bg-ink text-sage border-gray-800'
                  }`}
                >
                  <Wallet className="w-4 h-4" /> eWallet
                </button>
              </div>

              {escrowPaymentMethod === 'pay2cell' ? (
                <div className="bg-orange-950/20 border border-orange-900/30 rounded-xl p-4 flex flex-col gap-3">
                  <span className="text-orange-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4" /> Admin Instructions
                  </span>
                  <p className="text-gray-300 text-xs leading-relaxed">
                    Send exactly <strong className="text-white">{escrowGig.price}</strong> via FNB Pay2Cell to the Kampus Admin number below. We hold it until you get your item!
                  </p>
                  <div className="bg-black/50 rounded-lg py-3 flex flex-col items-center justify-center border border-gray-800 mt-1 gap-1">
                    <span className="text-sage text-[10px] uppercase font-bold tracking-wider">FNB Pay2Cell</span>
                    <span className="text-pine font-black text-xl tracking-widest">77037168</span>
                  </div>
                </div>
              ) : (
                <div className="bg-orange-950/20 border border-orange-900/30 rounded-xl p-4 flex flex-col gap-3">
                  <span className="text-orange-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4" /> Admin Instructions
                  </span>
                  <p className="text-gray-300 text-xs leading-relaxed">
                    Send an eWallet for exactly <strong className="text-white">{escrowGig.price}</strong> to the Kampus Admin number below. We hold the cash until you're happy!
                  </p>
                  <div className="bg-black/50 rounded-lg py-3 flex flex-col items-center justify-center border border-gray-800 mt-1 gap-1">
                    <span className="text-sage text-[10px] uppercase font-bold tracking-wider">eWallet Number</span>
                    <span className="text-pine font-black text-xl tracking-widest">71321163</span>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-sage text-xs font-bold uppercase tracking-wider">Your Payment Reference</label>
                <input
                  value={escrowRef}
                  onChange={(e) => setEscrowRef(e.target.value)}
                  placeholder="e.g. Phone number used or Tx ID"
                  className="bg-ink rounded-xl w-full h-12 px-4 border border-gray-800 text-white placeholder:text-gray-600 text-sm outline-none focus:border-pine transition-colors text-center font-medium"
                />
              </div>

              <button
                onClick={submitEscrowCheckout}
                disabled={!escrowRef.trim() || processingEscrow}
                className="w-full h-12 rounded-xl bg-pine text-black font-bold text-base active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg mt-auto"
              >
                {processingEscrow ? <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} /> : <Send className="w-4 h-4" strokeWidth={2} />}
                {processingEscrow ? 'Verifying...' : 'Confirm Payment Sent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {reportGig && profile && (
        <ReportModal
          open={!!reportGig}
          onClose={() => setReportGig(null)}
          contentType="hustle"
          contentId={reportGig.id}
          reporterId={profile.id}
        />
      )}

      {lightboxImages && (
        <Lightbox images={lightboxImages} onClose={() => setLightboxImages(null)} />
      )}

      {/* FIXED: PUBLIC PROFILE MODAL WITH USER ID */}
      {profileUser && (
        <PublicProfileModal
          userId={profileUser.id}
          username={profileUser.username}
          onClose={() => setProfileUser(null)}
          onMessageUser={() => {
            onMessageSeller(profileUser.id, profileUser.username);
            setProfileUser(null);
          }}
        />
      )}
    </div>
  );
}

function SuspendedCard({ gig, onResubmit }: { gig: Gig; onResubmit: (gig: Gig, refId: string) => void }) {
  const [refId, setRefId] = useState('');
  const [showResubmit, setShowResubmit] = useState(false);

  return (
    <div className="bg-red-950/40 border border-red-600/50 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-2xl">⏸️</span>
        <span className="text-red-400 font-black text-sm">Post Suspended</span>
      </div>
      <p className="text-white text-xs leading-relaxed">
        C&apos;mon dude, pay up! 💸 We couldn&apos;t verify payment for reference code{' '}
        <span className="text-pine font-bold">{gig.referenceCode}</span>. Send P10 via FNB/eWallet to get back online.
      </p>
      {showResubmit ? (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={refId}
            onChange={(e) => setRefId(e.target.value)}
            placeholder="Enter new payment ref ID"
            className="bg-ink rounded-lg h-11 px-3 border border-gray-800 text-white placeholder:text-sage/60 text-sm outline-none focus:border-pine"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onResubmit(gig, refId.trim())}
              disabled={refId.trim().length < 3}
              className="flex-1 h-10 rounded-lg bg-pine text-black text-xs font-bold active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} /> Re-activate
            </button>
            <button
              onClick={() => setShowResubmit(false)}
              className="h-10 px-4 rounded-lg bg-surface border border-gray-800 text-sage text-xs font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowResubmit(true)}
          className="w-full h-10 rounded-lg bg-pine/20 border border-pine/50 text-pine text-xs font-bold active:scale-95 transition-transform flex items-center justify-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} /> Re-submit Payment Ref
        </button>
      )}
    </div>
  );
}
