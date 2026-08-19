'use client';

import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/utils';
import type { Hazard, SosAlert, HazardRow, Profile } from '@/lib/types';
import { X, MessageCircle, MapPin as MapPinIcon, Clock, User, CheckCircle2, Ghost, Eye, Send, Lock, Unlock, Sparkles, Navigation } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PaymentModal from '@/components/PaymentModal';

import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER: [number, number] = [-21.1700, 27.5000];

type KonnectUser = {
  user_id: string;
  username: string;
  lat: number;
  lng: number;
  status_text: string | null;
  is_ghost_mode: boolean;
  updated_at: string;
};

type PromotedLocation = {
  id: string;
  title: string;
  vibe_tag: string;
  lat: number;
  lng: number;
  display_time: string;
  landmark_anchor: string;
  category: string;
  image_url?: string | null;
};

// --- Custom Icons ---
function createUserPin() {
  const html = `
    <div style="position:relative;width:24px;height:24px;">
      <span style="position:absolute;inset:-4px;border-radius:50%;background:#FFDE4D;opacity:0.35;animation:kampus-pulse 2s ease-out infinite;"></span>
      <span style="position:absolute;inset:0;border-radius:50%;background:#FFDE4D;box-shadow:0 0 0 3px rgba(255,222,77,0.25);"></span>
    </div>`;
  return L.divIcon({ html, className: 'kampus-user-pin', iconSize: [24, 24], iconAnchor: [12, 12] });
}

function createHazardPin() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFDE4D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;
  const html = `
    <div style="width:28px;height:28px;border-radius:50%;background:#15241C;border:1px solid #8BA396;display:flex;align-items:center;justify-content:center;">
      ${svg}
    </div>`;
  return L.divIcon({ html, className: 'kampus-hazard-pin', iconSize: [28, 28], iconAnchor: [14, 14] });
}

function createSosPin(active: boolean) {
  const bg = active ? '#EF4444' : '#6B7280';
  const shadow = active ? 'rgba(239,68,68,0.55)' : 'rgba(107,114,128,0.25)';
  const html = `
    <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
      <span style="position:absolute;inset:0;border-radius:50%;background:${bg};box-shadow:0 0 12px 4px ${shadow};display:flex;align-items:center;justify-content:center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
      </span>
    </div>`;
  return L.divIcon({ html, className: 'kampus-sos-pin', iconSize: [36, 36], iconAnchor: [18, 18] });
}

function createKonnectPin(user: KonnectUser) {
  const initial = user.username.charAt(0).toUpperCase();
  const statusHtml = user.status_text 
    ? `<div style="position:absolute; top:-30px; left:50%; transform:translateX(-50%); background:white; color:black; font-weight:bold; font-size:10px; padding:4px 8px; border-radius:12px; white-space:nowrap; box-shadow:0 4px 6px rgba(0,0,0,0.3); pointer-events:none; z-index: 1000;">${user.status_text}</div>` 
    : '';

  const html = `
    <div style="position:relative; width:30px; height:30px;">
      ${statusHtml}
      <div style="width:30px; height:30px; border-radius:50%; background:#FFDE4D; border:2px solid #0B1611; display:flex; align-items:center; justify-content:center; color:#0B1611; font-weight:900; font-size:14px; box-shadow:0 0 10px rgba(255,222,77,0.4);">
        ${initial}
      </div>
    </div>`;
  return L.divIcon({ html, className: 'kampus-konnect-pin', iconSize: [30, 30], iconAnchor: [15, 15] });
}

function createLocationPin() {
  const html = `
    <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
      <span style="position:absolute;inset:-3px;border-radius:50%;background:#FFFFFF;opacity:0.2;animation:kampus-pulse 2s ease-out infinite;"></span>
      <div style="width:22px;height:22px;border-radius:50%;background:#FFFFFF; border:2px solid #0B1611; display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px rgba(255,255,255,0.8);">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0B1611" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </div>
    </div>`;
  return L.divIcon({ html, className: 'kampus-event-pin', iconSize: [28, 28], iconAnchor: [14, 14] });
}

function LocationTracker({ onLocate }: { onLocate: (pos: [number, number]) => void }) {
  const map = useMap();
  const [pos, setPos] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const next: [number, number] = [latitude, longitude];
        setPos(next);
        onLocate(next);
        map.setView(next, map.getZoom(), { animate: true });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [map, onLocate]);

  if (!pos) return null;
  return <Marker position={pos} icon={createUserPin()} />;
}

export default function RadarMap({
  profile,
  onOpenHazard,
  sosAlerts,
  onLocate,
  onMessageUser,
}: {
  profile: Profile | null;
  onOpenHazard: (h: Hazard) => void;
  sosAlerts: SosAlert[];
  onLocate: (pos: [number, number]) => void;
  onMessageUser?: (userId: string, username: string) => void;
}) {
  const { toast } = useToast();
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [selectedSos, setSelectedSos] = useState<SosAlert | null>(null);
  const [konnectUsers, setKonnectUsers] = useState<KonnectUser[]>([]);
  const [promotedLocations, setPromotedLocations] = useState<PromotedLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<PromotedLocation | null>(null);
  
  // 🔥 Live Feature Flag State
  const [isFreeWeekend, setIsFreeWeekend] = useState(false);

  const [userTier, setUserTier] = useState<0 | 1 | 2>(0); 
  const [showUpgradeModal, setShowUpgradeModal] = useState<'base' | 'ghost' | null>(null);
  const [pendingTier, setPendingTier] = useState<1 | 2 | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [isGhostMode, setIsGhostMode] = useState(false);
  const [myStatus, setMyStatus] = useState('');
  const [showStatusInput, setShowStatusInput] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      // 1. Fetch Global Settings Live
      const { data: settings } = await supabase.from('platform_settings').select('is_free_weekend').eq('id', 1).maybeSingle();
      if (settings) setIsFreeWeekend(settings.is_free_weekend);

      const { data: hData } = await supabase.from('hazards').select('*').order('created_at', { ascending: false });
      if (hData) {
        setHazards((hData as HazardRow[]).map(row => ({
          id: row.id, position: [row.lat, row.lng], label: row.title, category: row.type, time: timeAgo(row.created_at), lockedToLive: true, upvotes: row.upvotes || 0, comments: []
        })));
      }

      const { data: kData } = await supabase.from('konnect_locations').select('*');
      if (kData) setKonnectUsers(kData as KonnectUser[]);

      const { data: pData } = await supabase.from('promoted_locations').select('*');
      if (pData) setPromotedLocations(pData as PromotedLocation[]);
      
      if (profile) {
        if ((profile as any).konnect_tier) {
           setUserTier((profile as any).konnect_tier as 0 | 1 | 2);
        }
        const { data: myLoc } = await supabase.from('konnect_locations').select('is_ghost_mode, status_text').eq('user_id', profile.id).maybeSingle();
        if (myLoc) {
          setIsGhostMode(myLoc.is_ghost_mode);
          setMyStatus(myLoc.status_text || '');
        }
      }
    };
    loadData();

    const channel = supabase.channel('public:radar_map')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'platform_settings' }, (payload) => {
        // 🔥 Instant updates when you hit the toggle in Admin Dashboard
        if (payload.new && payload.new.id === 1) {
          setIsFreeWeekend(payload.new.is_free_weekend);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hazards' }, (payload) => {
        const row = payload.new as HazardRow;
        setHazards((prev) => [{ id: row.id, position: [row.lat, row.lng], label: row.title, category: row.type, time: 'just now', lockedToLive: true, upvotes: row.upvotes || 0, comments: [] }, ...prev]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'konnect_locations' }, async () => {
        const { data } = await supabase.from('konnect_locations').select('*');
        if (data) setKonnectUsers(data as KonnectUser[]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'promoted_locations' }, async () => {
        const { data } = await supabase.from('promoted_locations').select('*');
        if (data) setPromotedLocations(data as PromotedLocation[]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const handleLocate = useCallback(async (pos: [number, number]) => {
    onLocate(pos);
    
    if (profile && userTier >= 1) {
      await supabase.from('konnect_locations').upsert({
        user_id: profile.id,
        username: profile.username || profile.email.split('@')[0],
        lat: pos[0],
        lng: pos[1],
        status_text: myStatus || null,
        is_ghost_mode: isGhostMode,
        updated_at: new Date().toISOString(),
        is_free_trial_pin: isFreeWeekend // 🔥 Captures if they dropped this pin during the free weekend
      } as any);
    }
  }, [onLocate, profile, isGhostMode, myStatus, userTier, isFreeWeekend]);

  const handleGhostModeToggle = async () => {
    if (userTier < 2) {
      setShowUpgradeModal('ghost');
      return;
    }
    const newGhostState = !isGhostMode;
    setIsGhostMode(newGhostState);
    if (profile) {
      await supabase.from('konnect_locations').update({ is_ghost_mode: newGhostState, updated_at: new Date().toISOString() }).eq('user_id', profile.id);
    }
  };

  const updateStatus = async () => {
    setShowStatusInput(false);
    if (profile) {
      await supabase.from('konnect_locations').update({ status_text: myStatus, updated_at: new Date().toISOString() }).eq('user_id', profile.id);
    }
  };

  const handleInitiatePayment = async (tier: 1 | 2) => {
    // 🔥 FREE WEEKEND BYPASS: Skip payment gateway entirely and update DB instantly!
    if (isFreeWeekend && tier === 1) {
      if (!profile) return;
      
      // Update DB to Tier 1
      await supabase.from('profiles').update({ konnect_tier: 1 }).eq('id', profile.id);

      // Update UI
      setUserTier(1);
      setShowUpgradeModal(null);
      toast({ 
        title: 'Weekend Pass Claimed 🚀', 
        description: 'Kampus Konnect is free until Sunday midnight! Dropping your pin on the map.' 
      });
      return;
    }

    setPendingTier(tier);
    setShowUpgradeModal(null);
    setShowPaymentModal(true);
  };

  const handlePaymentConfirm = async (referenceCode: string, paymentRefId: string) => {
    if (!profile || !pendingTier) return;
    setUserTier(pendingTier);
    setShowPaymentModal(false);
    
    await supabase.from('payments').insert({
      user_id: profile.id,
      amount: pendingTier === 2 ? 30 : 20,
      reference_code: referenceCode,
      payment_ref_id: paymentRefId,
      feature: pendingTier === 2 ? 'konnect_ghost' : 'konnect_base',
      status: 'pending'
    });

    toast({ title: 'Kampus Konnect Unlocked 🚀', description: 'Your map is live! Admin will verify your payment reference shortly.' });
    setPendingTier(null);
  };

  return (
    <div className="relative w-full h-full">
      <MapContainer center={DEFAULT_CENTER} zoom={14} zoomControl={false} attributionControl={false} className="w-full h-full" style={{ background: '#0B1611' }}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" subdomains="abcd" />
        <LocationTracker onLocate={handleLocate} />
        
        {hazards.map((h) => (
          <Marker key={h.id} position={h.position} icon={createHazardPin()} eventHandlers={{ click: () => onOpenHazard(h) }} />
        ))}
        
        {sosAlerts.map((s) => (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={createSosPin(s.active)} eventHandlers={{ click: () => setSelectedSos(s) }} />
        ))}

        {userTier >= 1 && konnectUsers.map((user) => {
          if (user.user_id === profile?.id) return null;
          if (user.is_ghost_mode) return null;
          const isStale = (new Date().getTime() - new Date(user.updated_at).getTime()) > 15 * 60 * 1000; 
          if (isStale) return null;
          return <Marker key={user.user_id} position={[user.lat, user.lng]} icon={createKonnectPin(user)} eventHandlers={{ click: () => onMessageUser && onMessageUser(user.user_id, user.username) }} />;
        })}

        {userTier >= 1 && promotedLocations.map((loc) => (
          <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={createLocationPin()} eventHandlers={{ click: () => setSelectedLocation(loc) }} />
        ))}
      </MapContainer>

      <div className="absolute bottom-28 left-4 z-[1000] flex flex-col gap-2 items-start pointer-events-none">
        {userTier === 0 ? (
          <button onClick={() => setShowUpgradeModal('base')} className="bg-[#FFDE4D] text-black rounded-xl p-3 flex flex-col items-start pointer-events-auto shadow-2xl active:scale-95 transition-transform">
            <div className="flex items-center gap-2 font-black text-sm">
              <Lock className="w-4 h-4" /> {isFreeWeekend ? 'Claim Free Pass' : 'Unlock Konnect'}
            </div>
            <span className="text-[10px] opacity-80 font-bold mt-0.5">
              {isFreeWeekend ? 'Free until Sunday midnight' : 'See campus vibes (P20)'}
            </span>
          </button>
        ) : (
          <>
            <button onClick={handleGhostModeToggle} className={`w-12 h-12 rounded-full flex items-center justify-center pointer-events-auto shadow-lg transition-colors border ${userTier < 2 ? 'bg-ink text-gray-500 border-gray-700' : isGhostMode ? 'bg-zinc-800 text-gray-400 border-zinc-700' : 'bg-[#FFDE4D] text-black border-[#FFDE4D]'}`}>
              {userTier < 2 ? <Lock className="w-4 h-4" /> : isGhostMode ? <Ghost className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
            
            {showStatusInput ? (
              <div className="bg-surface border border-gray-800 rounded-xl p-2 flex items-center gap-2 pointer-events-auto shadow-2xl animate-in fade-in zoom-in">
                <input type="text" value={myStatus} onChange={(e) => setMyStatus(e.target.value)} placeholder="e.g. Vibes at Las Vegas dorms" className="bg-ink border border-gray-700 rounded-lg h-9 px-3 text-xs text-white placeholder-sage outline-none focus:border-pine w-48" maxLength={40} />
                <button onClick={updateStatus} className="w-9 h-9 rounded-lg bg-pine text-black flex items-center justify-center shrink-0"><Send className="w-4 h-4" /></button>
              </div>
            ) : (
              <button onClick={() => setShowStatusInput(true)} className="bg-surface/80 backdrop-blur-md border border-gray-800 rounded-full px-4 py-2 text-xs font-bold text-white pointer-events-auto hover:bg-surface transition-colors shadow-lg">
                {myStatus ? `"${myStatus}"` : "+ Set Map Status"}
              </button>
            )}
          </>
        )}
      </div>

      {showUpgradeModal && (
        <div className="absolute inset-0 z-[3000] flex items-center justify-center pointer-events-auto">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowUpgradeModal(null)} />
          <div className="relative w-[320px] bg-surface border border-gray-800 rounded-3xl p-6 flex flex-col gap-5 text-center shadow-2xl animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-yellow-400/15 text-[#FFDE4D] flex items-center justify-center mx-auto border border-yellow-400/30">
              {showUpgradeModal === 'ghost' ? <Ghost className="w-7 h-7" /> : <Unlock className="w-7 h-7" />}
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-white font-black text-xl">{showUpgradeModal === 'ghost' ? 'Ghost Mode' : 'Kampus Konnect'}</h3>
              <p className="text-sage text-xs leading-relaxed">{showUpgradeModal === 'ghost' ? "Go completely off the grid. See the map and hotspots without anyone seeing your location." : "See exactly where the campus is moving. View hotspots, student statuses, and drop your own pins."}</p>
            </div>
            <div className="bg-ink rounded-xl border border-gray-800 p-4">
              <span className="text-3xl font-black text-[#FFDE4D]">{isFreeWeekend && showUpgradeModal === 'base' ? 'FREE' : `P${showUpgradeModal === 'ghost' ? '30' : '20'}`}</span>
              <span className="text-sage text-xs ml-1">{isFreeWeekend && showUpgradeModal === 'base' ? '/ this weekend' : '/ one-time'}</span>
            </div>
            <button onClick={() => handleInitiatePayment(showUpgradeModal === 'ghost' ? 2 : 1)} className="w-full h-12 rounded-xl bg-[#FFDE4D] text-black font-bold active:scale-95 transition-transform">
              {isFreeWeekend && showUpgradeModal === 'base' ? 'Claim Weekend Pass' : 'Pay Now'}
            </button>
            {isFreeWeekend && showUpgradeModal === 'base' && <p className="text-[#FFDE4D] text-[10px] font-bold mt-[-8px]">Map visibility reverts to P20 on Monday morning.</p>}
            <button onClick={() => setShowUpgradeModal(null)} className="text-sage text-xs hover:text-white mt-1">Maybe later</button>
          </div>
        </div>
      )}

      <PaymentModal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} onConfirm={handlePaymentConfirm} amount={pendingTier === 2 ? 30 : 20} ctaLabel="Unlock Konnect" />

      {selectedLocation && (
        <div className="absolute inset-0 z-[2500] flex items-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setSelectedLocation(null)} />
          <div className="relative w-full bg-surface border-t border-gray-800 rounded-t-3xl p-6 pb-[max(64px,calc(64px+env(safe-area-inset-bottom)))] flex flex-col gap-4 animate-slide-up shadow-2xl max-h-[85dvh] overflow-y-auto no-scrollbar">
            {selectedLocation.image_url && <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-gray-800 shrink-0 bg-ink"><img src={selectedLocation.image_url} alt={selectedLocation.title} className="w-full h-full object-cover"/></div>}
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1 pr-4">
                <span className="text-[#FFDE4D] text-[10px] uppercase font-black tracking-widest">{selectedLocation.category}</span>
                <h3 className="text-white text-2xl font-black leading-tight">{selectedLocation.title}</h3>
              </div>
              <button onClick={() => setSelectedLocation(null)} className="w-8 h-8 rounded-full bg-ink flex items-center justify-center text-sage hover:text-white shrink-0"><X className="w-4 h-4" strokeWidth={2} /></button>
            </div>
            <p className="text-sage text-sm italic">"{selectedLocation.vibe_tag}"</p>
            <div className="flex flex-col gap-3 bg-ink rounded-2xl p-4 border border-gray-800">
              <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center shrink-0"><Clock className="w-5 h-5 text-pine" strokeWidth={1.5} /></div><div className="flex flex-col"><span className="text-sage text-[10px] uppercase font-bold tracking-wider">When</span><span className="text-white font-semibold">{selectedLocation.display_time}</span></div></div>
              <div className="h-[1px] w-full bg-gray-800/50 my-1" />
              <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center shrink-0"><MapPinIcon className="w-5 h-5 text-pine" strokeWidth={1.5} /></div><div className="flex flex-col"><span className="text-sage text-[10px] uppercase font-bold tracking-wider">Where</span><span className="text-white font-semibold">{selectedLocation.landmark_anchor}</span></div></div>
            </div>
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${selectedLocation.lat},${selectedLocation.lng}`} target="_blank" rel="noopener noreferrer" className="w-full h-12 rounded-xl bg-white text-black font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform mt-1"><Navigation className="w-4 h-4" /> Get Directions</a>
          </div>
        </div>
      )}

      {selectedSos && (
        <div className="absolute inset-0 z-[2500] flex items-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setSelectedSos(null)} />
          <div className="relative w-full bg-surface border-t border-gray-800 rounded-t-2xl p-6 pb-[max(64px,calc(64px+env(safe-area-inset-bottom)))] flex flex-col gap-4 animate-slide-up shadow-2xl max-h-[85dvh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                {selectedSos.active ? <><span className="w-3 h-3 rounded-full bg-red-500 animate-broadcast-pulse inline-block" /><span className="text-red-400 font-black text-sm tracking-wider uppercase">Active Emergency Broadcast</span></> : <><span className="w-3 h-3 rounded-full bg-gray-500" /><span className="text-gray-400 font-black text-sm tracking-wider uppercase">Resolved (Deactivated)</span></>}
              </div>
              <button onClick={() => setSelectedSos(null)} className="text-sage hover:text-white"><X className="w-5 h-5" strokeWidth={1.5} /></button>
            </div>
            <div className="flex flex-col gap-3 bg-ink rounded-xl p-4 border border-gray-800 shrink-0">
              <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-surface border border-gray-800 flex items-center justify-center shrink-0"><User className="w-4 h-4 text-pine" strokeWidth={1.5} /></div><div className="flex flex-col"><span className="text-sage text-[10px] uppercase font-bold tracking-wider">Student Handle</span><span className="text-white text-sm font-bold">{selectedSos.user_name ?? 'Anonymous Student'}</span></div></div>
              <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-surface border border-gray-800 flex items-center justify-center shrink-0"><MapPinIcon className="w-4 h-4 text-pine" strokeWidth={1.5} /></div><div className="flex flex-col"><span className="text-sage text-[10px] uppercase font-bold tracking-wider">Broadcast Area</span><span className="text-white text-sm font-semibold">{selectedSos.location_name ?? 'Campus Zone'}</span></div></div>
              <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-surface border border-gray-800 flex items-center justify-center shrink-0"><Clock className="w-4 h-4 text-pine" strokeWidth={1.5} /></div><div className="flex flex-col"><span className="text-sage text-[10px] uppercase font-bold tracking-wider">Triggered</span><span className="text-white text-sm">{timeAgo(selectedSos.created_at)}</span></div></div>
            </div>
            {selectedSos.user_id && onMessageUser ? <button onClick={() => { const uid = selectedSos.user_id; const uname = selectedSos.user_name ?? 'Student'; setSelectedSos(null); if (uid) onMessageUser(uid, uname); }} className="w-full h-12 rounded-xl bg-pine text-black font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform shrink-0 mt-2"><MessageCircle className="w-4 h-4" strokeWidth={2} /> Check Up / Message Student</button> : <p className="text-sage text-xs text-center shrink-0">Broadcasted by an unlinked guest user.</p>}
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 right-2 z-[500] pointer-events-none">
        <div className="bg-surface/85 backdrop-blur-sm rounded-xl border border-gray-800 px-3 py-2">
          <p className="text-sage text-[9px] leading-snug text-center"><span className="font-bold text-yellow-400">Notice:</span> Kampus is a peer-to-peer student community assistance platform. Kampus is NOT an official emergency response unit or security service.</p>
        </div>
      </div>
    </div>
  );
}
