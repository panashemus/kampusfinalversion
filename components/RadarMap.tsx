'use client';

import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/utils';
import type { Hazard, SosAlert, HazardRow, Profile } from '@/lib/types';
import { X, MessageCircle, MapPin as MapPinIcon, Clock, User, CheckCircle2, Ghost, Eye, Send, Lock, Unlock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER: [number, number] = [-21.1700, 27.5000];

type KonnectUser = {
  user_id: string;
  username: string;
  lat: number;
  lng: number;
  status_text: string | null;
  updated_at: string;
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
    ? `<div style="position:absolute; top:-30px; left:50%; transform:translateX(-50%); background:white; color:black; font-weight:bold; font-size:10px; padding:4px 8px; border-radius:12px; white-space:nowrap; box-shadow:0 4px 6px rgba(0,0,0,0.3); pointer-events:none;">${user.status_text}</div>` 
    : '';

  const html = `
    <div style="position:relative; width:30px; height:30px;">
      ${statusHtml}
      <div style="width:30px; height:30px; border-radius:50%; background:#10B981; border:2px solid #0B1611; display:flex; align-items:center; justify-content:center; color:#0B1611; font-weight:900; font-size:14px; box-shadow:0 0 10px rgba(16,185,129,0.4);">
        ${initial}
      </div>
    </div>`;
  return L.divIcon({ html, className: 'kampus-konnect-pin', iconSize: [30, 30], iconAnchor: [15, 15] });
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
  
  // Konnect Monetization State
  // 0 = Locked (Free safety map only)
  // 1 = P20 Tier (See users, drop status)
  // 2 = P30 Tier (Access Ghost Mode)
  // TODO: Replace this with profile?.konnect_tier from your database
  const [userTier, setUserTier] = useState<0 | 1 | 2>(0); 
  const [showUpgradeModal, setShowUpgradeModal] = useState<'base' | 'ghost' | null>(null);

  // Konnect Functionality State
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [myStatus, setMyStatus] = useState('');
  const [showStatusInput, setShowStatusInput] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const { data: hData } = await supabase.from('hazards').select('*').order('created_at', { ascending: false });
      if (hData) {
        setHazards((hData as HazardRow[]).map(row => ({
          id: row.id, position: [row.lat, row.lng], label: row.title, category: row.type, time: timeAgo(row.created_at), lockedToLive: true, upvotes: row.upvotes || 0, comments: []
        })));
      }

      const { data: kData } = await supabase.from('konnect_locations').select('*');
      if (kData) setKonnectUsers(kData as KonnectUser[]);
      
      if (profile) {
        const { data: myLoc } = await supabase.from('konnect_locations').select('is_ghost_mode, status_text').eq('user_id', profile.id).maybeSingle();
        if (myLoc) {
          setIsGhostMode(myLoc.is_ghost_mode);
          setMyStatus(myLoc.status_text || '');
        }
      }
    };
    loadData();

    const channel = supabase.channel('public:radar_map')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hazards' }, (payload) => {
        const row = payload.new as HazardRow;
        setHazards((prev) => [{ id: row.id, position: [row.lat, row.lng], label: row.title, category: row.type, time: 'just now', lockedToLive: true, upvotes: row.upvotes || 0, comments: [] }, ...prev]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'konnect_locations' }, async () => {
        const { data } = await supabase.from('konnect_locations').select('*');
        if (data) setKonnectUsers(data as KonnectUser[]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const handleLocate = useCallback(async (pos: [number, number]) => {
    onLocate(pos);
    
    // Only upload location to map if they have unlocked Konnect AND are not hiding
    if (profile && userTier >= 1) {
      await supabase.from('konnect_locations').upsert({
        user_id: profile.id,
        username: profile.username || profile.email.split('@')[0],
        lat: pos[0],
        lng: pos[1],
        status_text: myStatus || null,
        is_ghost_mode: isGhostMode,
        updated_at: new Date().toISOString()
      });
    }
  }, [onLocate, profile, isGhostMode, myStatus, userTier]);

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

  const handleMockPayment = (tier: 1 | 2) => {
    // TODO: Connect this to your real payment gateway / upload logic
    setUserTier(tier);
    setShowUpgradeModal(null);
    toast({ title: 'Payment Successful', description: `Kampus Konnect tier unlocked.` });
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

        {/* Only render other users if the current user has paid for the P20 tier */}
        {userTier >= 1 && konnectUsers.map((user) => (
          user.user_id !== profile?.id && (
            <Marker key={user.user_id} position={[user.lat, user.lng]} icon={createKonnectPin(user)} eventHandlers={{ click: () => onMessageUser && onMessageUser(user.user_id, user.username) }} />
          )
        ))}
      </MapContainer>

      {/* KONNECT PAYWALL & UI CONTROLS */}
      <div className="absolute top-24 right-4 z-[1000] flex flex-col gap-2 items-end pointer-events-none">
        
        {userTier === 0 ? (
          // LOCKED STATE (P20 Paywall)
          <button 
            onClick={() => setShowUpgradeModal('base')}
            className="bg-pine text-black rounded-xl p-3 flex flex-col items-end pointer-events-auto shadow-2xl active:scale-95 transition-transform"
          >
            <div className="flex items-center gap-2 font-black text-sm">
              Unlock Konnect <Lock className="w-4 h-4" />
            </div>
            <span className="text-[10px] opacity-80 font-bold">See campus vibes (P20)</span>
          </button>
        ) : (
          // UNLOCKED STATE
          <>
            {showStatusInput ? (
              <div className="bg-surface border border-gray-800 rounded-xl p-2 flex items-center gap-2 pointer-events-auto shadow-2xl animate-in fade-in zoom-in">
                <input 
                  type="text"
                  value={myStatus}
                  onChange={(e) => setMyStatus(e.target.value)}
                  placeholder="e.g. Vibes at Las Vegas dorms"
                  className="bg-ink border border-gray-700 rounded-lg h-9 px-3 text-xs text-white placeholder-sage outline-none focus:border-pine w-48"
                  maxLength={40}
                />
                <button onClick={updateStatus} className="w-9 h-9 rounded-lg bg-pine text-black flex items-center justify-center shrink-0">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowStatusInput(true)}
                className="bg-surface/80 backdrop-blur-md border border-gray-800 rounded-full px-4 py-2 text-xs font-bold text-white pointer-events-auto hover:bg-surface transition-colors shadow-lg"
              >
                {myStatus ? `"${myStatus}"` : "+ Set Map Status"}
              </button>
            )}

            <button 
              onClick={handleGhostModeToggle}
              className={`w-12 h-12 rounded-full flex items-center justify-center pointer-events-auto shadow-lg transition-colors border ${
                userTier < 2 ? 'bg-ink text-gray-500 border-gray-700' :
                isGhostMode ? 'bg-zinc-800 text-gray-400 border-zinc-700' : 'bg-pine text-black border-emerald-400'
              }`}
            >
              {userTier < 2 ? <Lock className="w-4 h-4" /> : isGhostMode ? <Ghost className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </  >
        )}
      </div>

      {/* UPGRADE MODAL */}
      {showUpgradeModal && (
        <div className="absolute inset-0 z-[3000] flex items-center justify-center pointer-events-auto">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowUpgradeModal(null)} />
          <div className="relative w-[320px] bg-surface border border-gray-800 rounded-3xl p-6 flex flex-col gap-5 text-center shadow-2xl animate-in zoom-in-95">
            
            <div className="w-14 h-14 rounded-full bg-pine/15 text-pine flex items-center justify-center mx-auto border border-pine/30">
              {showUpgradeModal === 'ghost' ? <Ghost className="w-7 h-7" /> : <Unlock className="w-7 h-7" />}
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-white font-black text-xl">
                {showUpgradeModal === 'ghost' ? 'Ghost Mode' : 'Kampus Konnect'}
              </h3>
              <p className="text-sage text-xs leading-relaxed">
                {showUpgradeModal === 'ghost' 
                  ? "Go completely off the grid. See the map and hotspots without anyone seeing your location." 
                  : "See exactly where the campus is moving. View hotspots, student statuses, and drop your own pins."}
              </p>
            </div>

            <div className="bg-ink rounded-xl border border-gray-800 p-4">
              <span className="text-3xl font-black text-pine">
                P{showUpgradeModal === 'ghost' ? '30' : '20'}
              </span>
              <span className="text-sage text-xs ml-1">/ one-time</span>
            </div>

            <button 
              onClick={() => handleMockPayment(showUpgradeModal === 'ghost' ? 2 : 1)}
              className="w-full h-12 rounded-xl bg-pine text-black font-bold active:scale-95 transition-transform"
            >
              Pay Now
            </button>

            <button onClick={() => setShowUpgradeModal(null)} className="text-sage text-xs hover:text-white">
              Maybe later
            </button>
          </div>
        </div>
      )}

      {/* ... [Rest of your SOS Detail Modal remains exactly the same] ... */}
    </div>
  );
}
