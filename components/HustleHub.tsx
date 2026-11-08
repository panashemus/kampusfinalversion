'use client';
import Link from 'next/link';
import SecureImage from './SecureImage';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Laptop, Scissors, Book, Star, X, ShieldCheck, Copy, Check, Loader as Loader2, PackageOpen, MessageCircle, MoveVertical as MoreVertical, Flag, TriangleAlert as AlertTriangle, RefreshCw, Image as ImageIcon, CreditCard, Wallet, Send, Tag, Lock, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { uploadImages } from '@/lib/media-upload';
import type { Comment, Profile, HustleStatus } from '@/lib/types';
import AdSlot from '@/components/AdSlot';
import PublicProfileModal from '@/components/PublicProfileModal';
import ImageUploader from '@/components/ImageUploader';
import Lightbox from '@/components/Lightbox';
import ReportModal from '@/components/ReportModal';
import ContextActions from './ContextActions';
import type {Destination,Visibility} from '@/lib/interconnect';
import { useToast } from '@/hooks/use-toast';

type Category = 'All' | 'Tech' | 'Beauty' | 'Textbooks';

const FILTERS: Category[] = ['All', 'Tech', 'Beauty', 'Textbooks'];

const CATEGORY_ICONS: Record<string, typeof Laptop> = {
  Tech: Laptop,
  Beauty: Scissors,
  Textbooks: Book,
};

type Gig = {
  visibility: Visibility; approved: boolean;
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
  visibility: Visibility; public_approved: boolean;
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
  searchQuery, selectedListingId, onNavigate,
  onMessageSeller,
  requireVerified,
  profile,
}: {
  selectedListingId?: string;
  onNavigate: (destination: Destination) => void;
  searchQuery: string;
  onMessageSeller: (peerId: string, peerUsername: string, listingId?: string) => void;
  requireVerified: (action: () => void) => void;
  profile: Profile | null;
}) {
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<Category>('All');
  const [showModal, setShowModal] = useState(false);
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [publicListing,setPublicListing]=useState(false);
  const [page,setPage]=useState(0);
  const [selectedGig, setSelectedGig] = useState<Gig | null>(null);
  
  const [profileUser, setProfileUser] = useState<{ id: string; username: string } | null>(null);
  
  const [reportGig, setReportGig] = useState<Gig | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategory, setNewCategory] = useState<Exclude<Category, 'All'>>('Tech');
  const [newDescription, setNewDescription] = useState('');
  const [newImages, setNewImages] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);

  const myName = profile ? (profile.username ? `@${profile.username}` : profile.email.split('@')[0]) : 'student';
  const isAdmin = !!profile?.is_admin;
  
  // Admin override for image manipulation
  const isSuperAdmin = !!profile?.is_admin;

  const loadGigs = useCallback(async () => {
    setLoading(true);setLoadError('');
    let query=supabase.from('listing_preview').select('*').order('created_at',{ascending:false});
    if(selectedListingId)query=query.eq('id',selectedListingId);
    if(searchQuery.trim())query=query.ilike('title','%'+searchQuery.trim().replace(/[\%_]/g,'')+'%');
    const {data,error}=await query.range(page*40,page*40+39);
    if(error||!data){setLoadError('Listings could not be loaded. Please try again.');setLoading(false);return;}
    const mapped: Gig[] = (data as HustleRow[]).map((row) => ({
      id: row.id,
      visibility:row.visibility,approved:row.public_approved,
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
    if(selectedListingId)setSelectedGig(mapped.find(g=>g.id===selectedListingId)||null);
    setLoading(false);
  }, [selectedListingId,searchQuery,page]);

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

  const canPostGig =
    newTitle.trim().length >= 3 &&
    newPrice.trim() !== '' &&
    !isNaN(Number(newPrice)) &&
    Number(newPrice) > 0 &&
    newDescription.trim().length >= 10;

  const handlePublishGig = async () => {
    if (!profile || !canPostGig) return;
    setPosting(true);

    const { data, error } = await supabase
      .from('hustles')
      .insert({
        seller_id: profile.id,
        visibility:publicListing?"public":"campus",
        institution:profile.university,
        seller_name: myName,
        title: newTitle.trim(),
        price: Number(newPrice),
        category: newCategory,
        description: newDescription.trim(),
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
      visibility: publicListing ? 'public' : 'campus', approved: false,
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
      referenceCode: null,
      paymentRefId: null,
      status: 'active',
      images: newImages,
    };
    setGigs((prev) => [gig, ...prev]);

    toast({
      title: 'Gig published!',
      description: "Your listing is live for free. No listing fee is charged.",
    });

    setPosting(false);
    setShowModal(false);
    setNewTitle('');
    setNewPrice('');
    setNewDescription('');
    setNewImages([]);
  };

  const deleteGig = async (gigId: string) => {
    const { error } = await supabase.from('hustles').delete().eq('id', gigId);
    if (error) {
      toast({ title: 'Could not delete listing', description: error.message, variant: 'destructive' });
      return;
    }
    setMenuOpenId(null);
    setGigs(prev => prev.filter(g => g.id !== gigId));
    toast({ title: 'Listing deleted' });
  };

  // Admin image handlers
  const updateGigImages = async (gigId: string, updatedImages: string[]) => {
    const { error } = await supabase
      .from('hustles')
      .update({ images: updatedImages.length > 0 ? updatedImages : null })
      .eq('id', gigId);

    if (!error) {
      setGigs((prev) => prev.map((g) => (g.id === gigId ? { ...g, images: updatedImages } : g)));
      setSelectedGig((prev) => prev && prev.id === gigId ? { ...prev, images: updatedImages } : prev);
      toast({ title: 'Images synchronized successfully' });
    } else {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    }
  };

  const removeImageFromGig = async (gigId: string, indexToRemove: number) => {
    if (!selectedGig) return;
    const updatedImages = selectedGig.images.filter((_, i) => i !== indexToRemove);
    await updateGigImages(gigId, updatedImages);
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
        
        {/* Curated storefront: separate from student-owned Supabase listings. */}
        {!selectedListingId && (activeFilter === 'All' || activeFilter === 'Beauty') && (!searchQuery.trim() || /her|nail|beauty|salon|tlokweng/i.test(searchQuery)) && (
          <Link href="/store/her-nail-tech" className="group mb-4 block overflow-hidden rounded-3xl border border-[#8c6c7b]/60 bg-[radial-gradient(ellipse_at_90%_0%,#4d3545,#130f13_68%)] text-white shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#efdeea]">
            <div className="flex items-stretch gap-3 p-4 sm:gap-5 sm:p-5">
              <div className="h-32 w-28 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-[#37252e] sm:h-36 sm:w-36">
                <div className="h-full w-full transition-transform duration-300 group-hover:scale-105" style={{backgroundImage:"url('/images/her-nail-tech/portfolio-refresh.svg')",backgroundSize:'300% 300%',backgroundPosition:'0% 0%'}} role="img" aria-label="Nail designs from HER NAIL TECH"/>
              </div>
              <div className="flex min-w-0 flex-col justify-center">
                <span className="mb-2 text-[10px] font-bold uppercase tracking-[.17em] text-[#e5bfcf]">Featured beauty studio</span>
                <h2 className="font-serif text-xl leading-tight sm:text-3xl">HER NAIL TECH ♡</h2>
                <p className="mt-1 text-xs text-[#d5c5cd]">Tlokweng, Metlhabeng · Nail artistry</p>
                <p className="mt-2 line-clamp-2 text-xs text-[#bdb0ba]">Explore the lookbook, policies and direct WhatsApp booking.</p>
                <span className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#f7e4ed]">Enter the storefront <span aria-hidden="true">→</span></span>
              </div>
            </div>
          </Link>
        )}

        {/* STATIC LIST GIG BUTTON */}
        <button
          onClick={() => requireVerified(() => { setShowModal(true); })}
          className="w-full mb-5 h-12 rounded-xl bg-pine text-black flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg"
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
          <span className="font-bold text-sm">List a New Gig</span>
        </button>

        {loadError ? <div role="alert" className="foundation-card">{loadError}<button className="foundation-action" onClick={()=>loadGigs()}>Try again</button></div> : loading ? (
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
                        {(profile?.id === gig.sellerId || isAdmin) && (
                          <button
                            onClick={() => deleteGig(gig.id)}
                            className="flex items-center gap-2 px-3 py-2.5 text-left text-red-400 text-xs font-bold hover:bg-white/5 border-t border-gray-800"
                          >
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} /> Delete Gig
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
                        <SecureImage loading="lazy" src={gig.images[0]} alt={gig.title} className="w-full h-full object-cover" />
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

      {!selectedListingId&&<div className="flex justify-between px-4 pb-28"><button className="foundation-action" disabled={page===0} onClick={()=>setPage(v=>v-1)}>Previous</button><button className="foundation-action" disabled={gigs.length<40} onClick={()=>setPage(v=>v+1)}>Next</button></div>}
      {/* 2-STEP CREATE GIG MODAL (Centered Floating Window) */}
      {showModal && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-[420px] max-h-[85dvh] bg-surface rounded-3xl border border-gray-800 flex flex-col shadow-2xl overflow-hidden animate-slide-up">
            
            <div className="flex items-center justify-between p-5 border-b border-gray-800 shrink-0">
              <span className="text-white font-black text-lg">
                List a New Gig
              </span>
              <button onClick={() => setShowModal(false)} aria-label="Close" className="w-8 h-8 rounded-full bg-ink flex items-center justify-center text-sage hover:text-white transition-colors">
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>

            {/* Free student listing form */}
            {(
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 no-scrollbar">
                <label className="text-sm text-sage flex gap-3"><input type="checkbox" checked={publicListing} onChange={e=>setPublicListing(e.target.checked)}/>Show this listing publicly after moderator review. Private contact details stay private.</label>
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
                  onClick={handlePublishGig}
                  disabled={!canPostGig || posting}
                  className="w-full mt-4 h-12 rounded-lg bg-pine text-black font-bold text-base active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center shrink-0"
                >
                  {posting ? "Publishing..." : "Publish Listing for Free"}
                </button>
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
                      <SecureImage loading="lazy" src={img} alt={`gig-img-${i}`} className="w-full h-full object-cover" />
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
                <ContextActions content={{id:selectedGig.id,type:"listing",module:"hustle",ownerId:selectedGig.sellerId,visibility:selectedGig.visibility,approved:selectedGig.approved,available:selectedGig.status==="active"}} userId={profile?.id} onNavigate={onNavigate}/>
              </div>

              {/* Admin image editing */}
              {isSuperAdmin && profile && (
                <div className="bg-[#111] rounded-xl border border-yellow-500/30 p-4 flex flex-col gap-3 shadow-[0_0_15px_rgba(234,179,8,0.05)]">
                  <span className="text-yellow-500 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" /> Super Admin: Manage Images
                  </span>
                  
                  {selectedGig.images.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {selectedGig.images.map((img, i) => (
                        <div key={i} className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-gray-800">
                          <SecureImage loading="lazy" src={img} alt="thumb" className="w-full h-full object-cover" />
                          <button
                            onClick={() => removeImageFromGig(selectedGig.id, i)}
                            className="absolute top-1 right-1 w-6 h-6 bg-black/80 rounded-full flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-1">
                    <ImageUploader
                      userId={profile.id}
                      onUploaded={(urls) => {
                        const newArray = [...selectedGig.images, ...urls];
                        updateGigImages(selectedGig.id, newArray);
                      }}
                      onError={(msg) => toast({ title: 'Upload failed', description: msg, variant: 'destructive' })}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 mt-4">
                <button
                  onClick={() => onMessageSeller(selectedGig.sellerId, selectedGig.seller,selectedGig.id)}
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

