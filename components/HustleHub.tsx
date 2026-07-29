'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Laptop, Scissors, Book, Star, X, ShieldCheck, Copy, Check, Loader as Loader2, PackageOpen, MessageCircle, MoveVertical as MoreVertical, Flag, TriangleAlert as AlertTriangle, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/utils';
import { uploadImages } from '@/lib/payment';
import type { Comment, Profile, HustleStatus } from '@/lib/types';
import CommentThread from '@/components/CommentThread';
import AdSlot from '@/components/AdSlot';
import PublicProfileModal from '@/components/PublicProfileModal';
import PaymentModal from '@/components/PaymentModal';
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
  const [showPayment, setShowPayment] = useState(false);
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGig, setSelectedGig] = useState<Gig | null>(null);
  const [profileUser, setProfileUser] = useState<string | null>(null);
  const [reportGig, setReportGig] = useState<Gig | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

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

  // Public feed only shows active gigs (non-admins see only active).
  // Admins see all gigs including suspended ones.
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

  // My suspended gigs (for the author's dashboard view)
  const mySuspendedGigs = gigs.filter(
    (g) => g.status === 'unpaid_suspended' && g.sellerId === profile?.id
  );

  const canPostGig =
    newTitle.trim().length >= 3 &&
    newPrice.trim() !== '' &&
    !isNaN(Number(newPrice)) &&
    Number(newPrice) > 0 &&
    newDescription.trim().length >= 10;

  const handlePaymentConfirm = async (referenceCode: string, paymentRefId: string) => {
    if (!profile || !canPostGig) return;
    setPosting(true);

    // Optimistic: insert immediately with status=active
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
        payment_ref_id: paymentRefId || null,
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
      paymentRefId: paymentRefId || null,
      status: 'active',
      images: newImages,
    };
    setGigs((prev) => [gig, ...prev]);

    toast({
      title: 'Gig published!',
      description: `Your listing is live. Ref: ${referenceCode}`,
    });

    setPosting(false);
    setShowPayment(false);
    setShowModal(false);
    setNewTitle('');
    setNewPrice('');
    setNewDescription('');
    setNewImages([]);
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
    <div className="flex-1 bg-midnight flex flex-col">
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
        {/* Suspended listings warning cards (author only) */}
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
          <div className="flex flex-col items-center justify-center h-full gap-3 pt-16">
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
                      <span className="text-white text-sm font-bold">{gig.title}</span>
                      <span className="text-pine text-xs font-extrabold">{gig.price}</span>
                    </div>
                  </button>
                  <div className="px-3 pb-3">
                    <button
                      onClick={() => setProfileUser(gig.seller)}
                      className="text-sage text-[10px] font-bold hover:text-pine transition-colors"
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

      <button
        onClick={() => requireVerified(() => setShowModal(true))}
        className="absolute bottom-24 right-4 z-20 flex items-center gap-1.5 px-4 py-3 rounded-full bg-pine active:scale-95 transition-transform"
      >
        <Plus className="w-5 h-5 text-black" strokeWidth={2.5} />
        <span className="text-black font-bold text-sm">List a Gig</span>
      </button>

      {/* Create Gig Modal */}
      {showModal && (
        <div className="absolute inset-0 z-30 flex items-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowModal(false)} />
          <div className="relative w-full bg-surface rounded-t-2xl p-6 flex flex-col gap-4 animate-slide-up max-h-[85%] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between">
              <span className="text-white font-black text-lg">List a New Gig</span>
              <button onClick={() => setShowModal(false)} aria-label="Close">
                <X className="w-5 h-5 text-sage" strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sage text-xs font-bold uppercase tracking-wider">Gig Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Laptop Screen Repair"
                required
                minLength={3}
                className="bg-ink rounded-lg h-12 w-full px-4 border border-gray-800 text-white placeholder:text-sage outline-none focus:border-sage transition-colors"
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
                className="bg-ink rounded-lg h-12 w-full px-4 border border-gray-800 text-white placeholder:text-sage outline-none focus:border-sage transition-colors"
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
                className="bg-ink rounded-lg w-full p-4 border border-gray-800 text-white placeholder:text-sage outline-none focus:border-sage transition-colors resize-none"
              />
            </div>

            {profile && (
              <ImageUploader
                userId={profile.id}
                onUploaded={(urls) => setNewImages((prev) => [...prev, ...urls])}
                onError={(msg) => toast({ title: 'Upload failed', description: msg, variant: 'destructive' })}
              />
            )}

            <button
              onClick={() => {
                if (!canPostGig) return;
                setShowModal(false);
                setShowPayment(true);
              }}
              disabled={!canPostGig}
              className="w-full h-12 rounded-lg bg-pine text-black font-bold text-base active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
            >
              Proceed to Payment
            </button>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <PaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        onConfirm={handlePaymentConfirm}
        amount={10}
        ctaLabel="Publish Gig"
      />

      {/* Gig Detail Modal */}
      {selectedGig && (
        <div className="absolute inset-0 z-30 flex items-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedGig(null)} />
          <div className="relative w-full bg-surface rounded-t-2xl p-6 flex flex-col gap-4 animate-slide-up max-h-[85%] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between">
              <span className="text-white font-black text-lg">{selectedGig.title}</span>
              <button onClick={() => setSelectedGig(null)} aria-label="Close">
                <X className="w-5 h-5 text-sage" strokeWidth={1.5} />
              </button>
            </div>

            {/* Images */}
            {selectedGig.images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
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
              <div className="w-10 h-10 rounded-full bg-ink border border-gray-800 flex items-center justify-center">
                <Star className="w-5 h-5 text-pine" strokeWidth={1.5} />
              </div>
              <div className="flex flex-col">
                <button
                  onClick={() => setProfileUser(selectedGig.seller)}
                  className="text-white text-sm font-bold hover:text-pine transition-colors text-left"
                >
                  {selectedGig.seller}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-sage text-xs font-bold uppercase tracking-wider">Listing Details</span>
              <p className="text-white text-sm leading-relaxed">
                {selectedGig.description || 'No description provided.'}
              </p>
              <span className="text-pine text-lg font-black mt-1">{selectedGig.price}</span>
            </div>

            {/* Admin audit panel */}
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
                    className="w-full h-10 rounded-lg bg-red-600/20 border border-red-600/50 text-red-400 text-xs font-bold active:scale-95 transition-transform flex items-center justify-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2} /> Flag as Unpaid
                  </button>
                )}
              </div>
            )}

            <button
              onClick={() =>
                requireVerified(() =>
                  toast({ title: 'Secure Escrow', description: 'Initializing secure Escrow...' })
                )
              }
              className="w-full h-12 rounded-lg bg-pine text-black font-bold text-base active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-5 h-5" strokeWidth={2} />
              Start Escrow Trade
            </button>

            <button
              onClick={() => onMessageSeller(selectedGig.sellerId, selectedGig.seller)}
              className="w-full h-12 rounded-lg bg-transparent border border-yellow-400 text-yellow-400 font-bold text-base active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" strokeWidth={2} />
              Message Seller
            </button>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportGig && profile && (
        <ReportModal
          open={!!reportGig}
          onClose={() => setReportGig(null)}
          contentType="hustle"
          contentId={reportGig.id}
          reporterId={profile.id}
        />
      )}

      {/* Lightbox */}
      {lightboxImages && (
        <Lightbox images={lightboxImages} onClose={() => setLightboxImages(null)} />
      )}

      {profileUser && (
        <PublicProfileModal
          username={profileUser}
          onClose={() => setProfileUser(null)}
          onMessageUser={onMessageSeller}
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
