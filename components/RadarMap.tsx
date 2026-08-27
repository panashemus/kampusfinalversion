'use client';

import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/utils';
import type { Hazard, SosAlert, HazardRow, Profile } from '@/lib/types';
import { X, MessageCircle, MapPin as MapPinIcon, Clock, User, CheckCircle2, Ghost, Eye, Send, Lock, Unlock, Sparkles, Navigation, GraduationCap, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PaymentModal from '@/components/PaymentModal';

import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER: [number, number] = [-21.1700, 27.5000]; // Francistown Default

// --- Campus Coordinates & Radiuses ---
const CAMPUSES = {
  BAC_FTO: { name: 'BAC Francistown', lat: -21.1633, lng: 27.5144, radius: 2000, zoom: 17 },
  UB_GBE: { name: 'University of Botswana', lat: -24.6615, lng: 25.9338, radius: 2500, zoom: 16 },
  BAC_GBE: { name: 'BAC Gaborone', lat: -24.6581, lng: 25.9331, radius: 1500, zoom: 17 },
};

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
  const html = `<div style="position:relative;width:24px;height:24px;"><span style="position:absolute;inset:-4px;border-radius:50%;background:#FFDE4D;opacity:0.35;animation:kampus-pulse 2s ease-out infinite;"></span><span style="position:absolute;inset:0;border-radius:50%;background:#FFDE4D;box-shadow:0 0 0 3px rgba(255,222,77,0.25);"></span></div>`;
  return L.divIcon({ html, className: 'kampus-user-pin', iconSize: [24, 24], iconAnchor: [12, 12] });
}

function createHazardPin() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFDE4D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;
  const html = `<div style="width:28px;height:28px;border-radius:50%;background:#15241C;border:1px solid #8BA396;display:flex;align-items:center;justify-content:center;">${svg}</div>`;
  return L.divIcon({ html, className: 'kampus-hazard-pin', iconSize: [28, 28], iconAnchor: [14, 14] });
}

function createSosPin(active: boolean) {
  const bg = active ? '#EF4444' : '#6B7280';
  const shadow = active ? 'rgba(239,68,68,0.55)' : 'rgba(107,114,128,0.25)';
  const html = `<div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;"><span style="position:absolute;inset:0;border-radius:50%;background:${bg};box-shadow:0 0 12px 4px ${shadow};display:flex;align-items:center;justify-content:center;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg></span></div>`;
  return L.divIcon({ html, className: 'kampus-sos-pin', iconSize: [36, 36], iconAnchor: [18, 18] });
}

function createKonnectPin(user: KonnectUser) {
  const initial = user.username.charAt(0).toUpperCase();
  const statusHtml = user.status_text 
    ? `<div style="position:absolute; top:-30px; left:50%; transform:translateX(-50%); background:white; color:black; font-weight:bold; font-size:10px; padding:4px 8px; border-radius:12px; white-space:nowrap; box-shadow:0 4px 6px rgba(0,0,0,0.3); pointer-events:none; z-index: 1000;">${user.status_text}</div>` 
    : '';
  const html = `<div style="position:relative; width:30px; height:30px;">${statusHtml}<div style="width:30px; height:30px; border-radius:50%; background:#FFDE4D; border:2px solid #0B1611; display:flex; align-items:center; justify-content:center; color:#0B1611; font-weight:900; font-size:14px; box-shadow:0 0 10px rgba(255,222,77,0.4);">${initial}</div></div>`;
  return L.divIcon({ html, className: 'kampus-konnect-pin', iconSize: [30, 30], iconAnchor: [15, 15] });
}

function createLocationPin() {
  const html = `<div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;"><span style="position:absolute;inset:-3px;border-radius:50%;background:#FFFFFF;opacity:0.2;animation:kampus-pulse 2s ease-out infinite;"></span><div style="width:22px;height:22px;border-radius:50%;background:#FFFFFF; border:2px solid #0B1611; display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px rgba(255,255,255,0.8);"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0B1611" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div></div>`;
  return L.divIcon({ html, className: 'kampus-event-pin', iconSize: [28, 28], iconAnchor: [14, 14] });
}

// --- GPS Locator ---
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

// --- Contextual Campus Detector ---
function CampusDetector({ onNearbyCampus }: { onNearbyCampus: (campusKey: string | null) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      let foundCampus = null;
      
      for (const [key, data] of Object.entries(CAMPUSES)) {
        const distance = center.distanceTo(L.latLng(data.lat, data.lng));
        if (distance < data.radius) {
          foundCampus = key;
          break;
        }
      }
      onNearbyCampus(foundCampus);
    }
  });
  return null;
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
  
  const [isFreeWeekend, setIsFreeWeekend] = useState(false);
  const [userTier, setUserTier] = useState<0 | 1 | 2>(0); 
  const [showUpgradeModal, setShowUpgradeModal] = useState<'base' | 'ghost' | null>(null);
  const [pendingTier, setPendingTier] = useState<1 | 2 | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [isGhostMode, setIsGhostMode] = useState(false);
  const [myStatus, setMyStatus] = useState('');
  const [showStatusInput, setShowStatusInput] = useState(false);

  const [nearbyCampus, setNearbyCampus] = useState<string | null>(null);
  const [inCampusMode, setInCampusMode] = useState<string | null>(null);

  // Note: Standard Leaflet Map Ref to manually trigger zooms outside component
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  useEffect(() => {
    const loadData = async () => {
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
    // (Supabase real-time channels omitted for brevity, keep your existing ones here)
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
        is_free_trial_pin: isFreeWeekend 
      } as any);
    }
  }, [onLocate, profile, isGhostMode, myStatus, userTier, isFreeWeekend]);

  const handleEnterCampusMode = () => {
    if (!nearbyCampus || !mapInstance) return;
    const campusData = CAMPUSES[nearbyCampus as keyof typeof CAMPUSES];
    
    // Zoom exactly into the campus
    mapInstance.flyTo([campusData.lat, campusData.lng], campusData.zoom, { animate: true, duration: 1.5 });
    setInCampusMode(nearbyCampus);
    
    toast({ 
      title: `${campusData.name} Mode Active`, 
      description: 'Showing detailed lecture halls and facilities.' 
    });
  };

  return (
    <div className="relative w-full h-full">
      
      {/* 
        Contextual Campus Button: 
        Only shows up when the user pans the map close to UB or BAC 
      */}
      {nearbyCampus && inCampusMode !== nearbyCampus && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto animate-in slide-in-from-top-4 fade-in">
          <button 
            onClick={handleEnterCampusMode}
            className="flex items-center gap-2 bg-white text-black px-4 py-2.5 rounded-full font-black text-sm shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 transition-transform"
          >
            <GraduationCap className="w-5 h-5 text-pine" />
            Enter {CAMPUSES[nearbyCampus as keyof typeof CAMPUSES].name} Map
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      )}

      {inCampusMode && (
         <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto">
           <div className="bg-pine/20 border border-pine backdrop-blur-md text-[#FFDE4D] px-4 py-1.5 rounded-full font-bold text-xs flex items-center gap-2 shadow-lg">
             <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
             {CAMPUSES[inCampusMode as keyof typeof CAMPUSES].name} Active
             <button onClick={() => setInCampusMode(null)} className="ml-2 bg-ink/50 rounded-full p-1"><X className="w-3 h-3 text-white" /></button>
           </div>
         </div>
      )}

      {/* Adding Global CSS to invert standard OSM tiles into Dark Mode without API keys */}
      <style dangerouslySetInnerHTML={{__html: `
        .dark-osm-tiles {
          filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
        }
      `}} />

      <MapContainer 
        center={DEFAULT_CENTER} 
        zoom={14} 
        zoomControl={false} 
        attributionControl={false} 
        className="w-full h-full" 
        style={{ background: '#0B1611' }}
        ref={setMapInstance}
      >
        {/* 100% Free, NO API Key Required Dark Tile Layer */}
        <TileLayer 
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
          className="dark-osm-tiles" 
        />
        
        <CampusDetector onNearbyCampus={setNearbyCampus} />
        <LocationTracker onLocate={handleLocate} />
        
        {/* All your existing markers (Hazards, SOS, Konnect Users, Ads) stay exactly the same */}
        {hazards.map((h) => (
          <Marker key={h.id} position={h.position} icon={createHazardPin()} eventHandlers={{ click: () => onOpenHazard(h) }} />
        ))}
        
        {/* ... Rest of your existing marker loops (SOS, Promoted Locations, Users) ... */}
        
      </MapContainer>

      {/* ... Rest of your existing UI Overlays (Upgrade Modal, Status Inputs, Floating Cards) ... */}
    </div>
  );
}
