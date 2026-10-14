'use client';

import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/utils';
import type { Hazard, SosAlert, HazardRow, Profile } from '@/lib/types';
import {
  X,
  MessageCircle,
  MapPin as MapPinIcon,
  Clock,
  User,
  Ghost,
  Eye,
  Send,
  Lock,
  Unlock,
  Navigation,
  GraduationCap,
  ChevronRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PaymentModal from '@/components/PaymentModal';

import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER: [number, number] = [-21.17, 27.5];

const CAMPUSES = {
  BAC_FTO: {
    name: 'BAC Francistown',
    lat: -21.1633,
    lng: 27.5144,
    radius: 2000,
    zoom: 17,
  },
  UB_GBE: {
    name: 'University of Botswana',
    lat: -24.6615,
    lng: 25.9338,
    radius: 2500,
    zoom: 16,
  },
  BAC_GBE: {
    name: 'BAC Gaborone',
    lat: -24.6581,
    lng: 25.9331,
    radius: 1500,
    zoom: 17,
  },
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

function createUserPin() {
  const html = `
    <div style="position:relative;width:22px;height:22px;">
      <span style="position:absolute;inset:-4px;border-radius:50%;background:#FBBF24;opacity:0.30;animation:kampus-pulse 2s ease-out infinite;"></span>
      <span style="position:absolute;inset:0;border-radius:50%;background:#FBBF24;border:2px solid #0B0F0E;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></span>
    </div>`;
  return L.divIcon({
    html,
    className: 'kampus-user-pin',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function createHazardPin() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;
  const html = `
    <div style="width:28px;height:28px;border-radius:50%;background:#121816;border:1px solid rgba(255,255,255,0.14);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.4);">
      ${svg}
    </div>`;
  return L.divIcon({
    html,
    className: 'kampus-hazard-pin',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createSosPin(active: boolean) {
  const bg = active ? '#E11D48' : '#52525B';
  const shadow = active ? 'rgba(225,29,72,0.45)' : 'rgba(82,82,91,0.25)';
  const html = `
    <div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;">
      <span style="position:absolute;inset:0;border-radius:50%;background:${bg};box-shadow:0 0 12px 3px ${shadow};display:flex;align-items:center;justify-content:center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
      </span>
    </div>`;
  return L.divIcon({
    html,
    className: 'kampus-sos-pin',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function createKonnectPin(user: KonnectUser) {
  const initial = user.username.charAt(0).toUpperCase();
  const statusHtml = user.status_text
    ? `<div style="position:absolute; top:-28px; left:50%; transform:translateX(-50%); background:#18181B; color:#F4F4F5; border:1px solid rgba(255,255,255,0.1); font-weight:600; font-size:10px; padding:3px 8px; border-radius:9999px; white-space:nowrap; box-shadow:0 4px 10px rgba(0,0,0,0.4); pointer-events:none; z-index:1000;">${user.status_text}</div>`
    : '';

  const html = `
    <div style="position:relative; width:28px; height:28px;">
      ${statusHtml}
      <div style="width:28px; height:28px; border-radius:50%; background:#064E3B; border:1.5px solid #34D399; display:flex; align-items:center; justify-content:center; color:#A7F3D0; font-weight:700; font-size:12px; box-shadow:0 2px 8px rgba(0,0,0,0.4);">
        ${initial}
      </div>
    </div>`;
  return L.divIcon({
    html,
    className: 'kampus-konnect-pin',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createLocationPin() {
  const html = `
    <div style="position:relative;width:26px;height:26px;display:flex;align-items:center;justify-content:center;">
      <div style="width:22px;height:22px;border-radius:50%;background:#F4F4F5; border:2px solid #0B0F0E; display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.5);">
        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0B0F0E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </div>
    </div>`;
  return L.divIcon({
    html,
    className: 'kampus-event-pin',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function LocationTracker({
  onLocate,
}: {
  onLocate: (pos: [number, number]) => void;
}) {
  const map = useMap();
  const [pos, setPos] = useState<[number, number] | null>(null);
  const hasCentered = useRef(false);

  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const next: [number, number] = [latitude, longitude];
        setPos(next);
        onLocate(next);

        if (!hasCentered.current) {
          map.setView(next, map.getZoom(), { animate: true });
          hasCentered.current = true;
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [map, onLocate]);

  if (!pos) return null;
  return <Marker position={pos} icon={createUserPin()} />;
}

function CampusDetector({
  onNearbyCampus,
}: {
  onNearbyCampus: (campusKey: string | null) => void;
}) {
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
    },
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
  const [isMounted, setIsMounted] = useState(false);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [selectedSos, setSelectedSos] = useState<SosAlert | null>(null);
  const [konnectUsers, setKonnectUsers] = useState<KonnectUser[]>([]);
  const [promotedLocations, setPromotedLocations] = useState<
    PromotedLocation[]
  >([]);
  const [selectedLocation, setSelectedLocation] =
    useState<PromotedLocation | null>(null);

  const [isFreeWeekend, setIsFreeWeekend] = useState(false);

  const [userTier, setUserTier] = useState<0 | 1 | 2>(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState<
    'base' | 'ghost' | null
  >(null);
  const [pendingTier, setPendingTier] = useState<1 | 2 | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [isGhostMode, setIsGhostMode] = useState(false);
  const [myStatus, setMyStatus] = useState('');
  const [showStatusInput, setShowStatusInput] = useState(false);

  const [nearbyCampus, setNearbyCampus] = useState<string | null>(null);
  const [inCampusMode, setInCampusMode] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('is_free_weekend')
        .eq('id', 1)
        .maybeSingle();
      if (settings) setIsFreeWeekend(settings.is_free_weekend);

      const { data: hData } = await supabase
        .from('hazards')
        .select('*')
        .order('created_at', { ascending: false });
      if (hData) {
        setHazards(
          (hData as HazardRow[]).map((row) => ({
            id: row.id,
            position: [row.lat, row.lng],
            label: row.title,
            category: row.type,
            time: timeAgo(row.created_at),
            lockedToLive: true,
            upvotes: row.upvotes || 0,
            comments: [],
          }))
        );
      }

      const { data: kData } = await supabase
        .from('konnect_locations')
        .select('*');
      if (kData) setKonnectUsers(kData as KonnectUser[]);

      const { data: pData } = await supabase
        .from('promoted_locations')
        .select('*');
      if (pData) setPromotedLocations(pData as PromotedLocation[]);

      if (profile) {
        if ((profile as any).konnect_tier) {
          setUserTier((profile as any).konnect_tier as 0 | 1 | 2);
        }
        const { data: myLoc } = await supabase
          .from('konnect_locations')
          .select('is_ghost_mode, status_text')
          .eq('user_id', profile.id)
          .maybeSingle();
        if (myLoc) {
          setIsGhostMode(myLoc.is_ghost_mode);
          setMyStatus(myLoc.status_text || '');
        }
      }
    };
    loadData();

    const channel = supabase
      .channel('public:radar_map')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'platform_settings' },
        (payload) => {
          if (payload.new && payload.new.id === 1) {
            setIsFreeWeekend(payload.new.is_free_weekend);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hazards' },
        (payload) => {
          const row = payload.new as HazardRow;
          setHazards((prev) => [
            {
              id: row.id,
              position: [row.lat, row.lng],
              label: row.title,
              category: row.type,
              time: 'just now',
              lockedToLive: true,
              upvotes: row.upvotes || 0,
              comments: [],
            },
            ...prev,
          ]);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'konnect_locations' },
        async () => {
          const { data } = await supabase.from('konnect_locations').select('*');
          if (data) setKonnectUsers(data as KonnectUser[]);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'promoted_locations' },
        async () => {
          const { data } = await supabase
            .from('promoted_locations')
            .select('*');
          if (data) setPromotedLocations(data as PromotedLocation[]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const handleLocate = useCallback(
    async (pos: [number, number]) => {
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
          is_free_trial_pin: isFreeWeekend,
        } as any);
      }
    },
    [onLocate, profile, isGhostMode, myStatus, userTier, isFreeWeekend]
  );

  const handleGhostModeToggle = async () => {
    if (userTier < 2) {
      setShowUpgradeModal('ghost');
      return;
    }
    const newGhostState = !isGhostMode;
    setIsGhostMode(newGhostState);
    if (profile) {
      await supabase
        .from('konnect_locations')
        .update({
          is_ghost_mode: newGhostState,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', profile.id);
    }
  };

  const updateStatus = async () => {
    setShowStatusInput(false);
    if (profile) {
      await supabase
        .from('konnect_locations')
        .update({
          status_text: myStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', profile.id);
    }
  };

  const handleInitiatePayment = async (tier: 1 | 2) => {
    if (isFreeWeekend && tier === 1) {
      if (!profile) return;

      await supabase
        .from('profiles')
        .update({ konnect_tier: 1 })
        .eq('id', profile.id);

      setUserTier(1);
      setShowUpgradeModal(null);
      toast({
        title: 'Weekend Pass Claimed',
        description:
          'Kampus Konnect is free until Sunday midnight. Dropping your pin.',
      });
      return;
    }

    setPendingTier(tier);
    setShowUpgradeModal(null);
    setShowPaymentModal(true);
  };

  const handlePaymentConfirm = async (
    referenceCode: string,
    paymentRefId: string
  ) => {
    if (!profile || !pendingTier) return;
    setUserTier(pendingTier);
    setShowPaymentModal(false);

    await supabase.from('payments').insert({
      user_id: profile.id,
      amount: pendingTier === 2 ? 30 : 20,
      reference_code: referenceCode,
      payment_ref_id: paymentRefId,
      feature: pendingTier === 2 ? 'konnect_ghost' : 'konnect_base',
      status: 'pending',
    });

    toast({
      title: 'Kampus Konnect Unlocked',
      description: 'Your live map is active.',
    });
    setPendingTier(null);
  };

  const handleEnterCampusMode = () => {
    if (!nearbyCampus || !mapInstance) return;
    const campusData = CAMPUSES[nearbyCampus as keyof typeof CAMPUSES];

    mapInstance.flyTo([campusData.lat, campusData.lng], campusData.zoom, {
      animate: true,
      duration: 1.5,
    });
    setInCampusMode(nearbyCampus);

    toast({
      title: `${campusData.name} Active`,
      description: 'Focused on campus zone.',
    });
  };

  if (!isMounted) return null;

  return (
    <div className="relative w-full h-full">
      {nearbyCampus && inCampusMode !== nearbyCampus && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto">
          <button
            onClick={handleEnterCampusMode}
            className="flex items-center gap-2 bg-zinc-900/90 backdrop-blur-md ring-1 ring-white/10 text-white px-4 py-2 rounded-full font-semibold text-xs shadow-xl active:scale-[0.98] transition-all"
          >
            <GraduationCap className="w-4 h-4 text-emerald-400" />
            <span>
              Focus {CAMPUSES[nearbyCampus as keyof typeof CAMPUSES].name}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>
      )}

      {inCampusMode && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto">
          <div className="bg-emerald-950/80 border border-emerald-700/40 backdrop-blur-md text-emerald-300 px-3.5 py-1.5 rounded-full font-medium text-xs flex items-center gap-2 shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>
              {CAMPUSES[inCampusMode as keyof typeof CAMPUSES].name}
            </span>
            <button
              onClick={() => setInCampusMode(null)}
              className="ml-1 bg-black/40 rounded-full p-0.5 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .dark-osm-tiles { filter: invert(100%) hue-rotate(180deg) brightness(92%) contrast(92%) saturate(80%); }
      `,
        }}
      />

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={14}
        zoomControl={false}
        attributionControl={false}
        className="w-full h-full"
        style={{ background: '#0B0F0E' }}
        ref={setMapInstance}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="dark-osm-tiles"
        />

        <CampusDetector onNearbyCampus={setNearbyCampus} />
        <LocationTracker onLocate={handleLocate} />

        {hazards.map((h) => (
          <Marker
            key={h.id}
            position={h.position}
            icon={createHazardPin()}
            eventHandlers={{ click: () => onOpenHazard(h) }}
          />
        ))}

        {sosAlerts.map((s) => (
          <Marker
            key={s.id}
            position={[s.lat, s.lng]}
            icon={createSosPin(s.active)}
            eventHandlers={{ click: () => setSelectedSos(s) }}
          />
        ))}

        {userTier >= 1 &&
          konnectUsers.map((user) => {
            if (user.user_id === profile?.id) return null;
            if (user.is_ghost_mode) return null;
            const isStale =
              new Date().getTime() - new Date(user.updated_at).getTime() >
              15 * 60 * 1000;
            if (isStale) return null;
            return (
              <Marker
                key={user.user_id}
                position={[user.lat, user.lng]}
                icon={createKonnectPin(user)}
                eventHandlers={{
                  click: () =>
                    onMessageUser && onMessageUser(user.user_id, user.username),
                }}
              />
            );
          })}

        {userTier >= 1 &&
          promotedLocations.map((loc) => (
            <Marker
              key={loc.id}
              position={[loc.lat, loc.lng]}
              icon={createLocationPin()}
              eventHandlers={{ click: () => setSelectedLocation(loc) }}
            />
          ))}
      </MapContainer>

      {/* Bottom-Left Konnect Controls */}
      <div className="absolute bottom-28 left-4 z-[1000] flex flex-col gap-2.5 items-start pointer-events-none">
        {userTier === 0 ? (
          <button
            onClick={() => setShowUpgradeModal('base')}
            className="bg-zinc-900/90 backdrop-blur-md ring-1 ring-white/10 text-white rounded-2xl px-4 py-2.5 flex flex-col items-start pointer-events-auto shadow-xl active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-1.5 font-semibold text-xs text-amber-300">
              <Lock className="w-3.5 h-3.5" />
              <span>
                {isFreeWeekend ? 'Claim Free Pass' : 'Unlock Konnect'}
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 mt-0.5">
              {isFreeWeekend
                ? 'Free until Sunday midnight'
                : 'See live campus pins · P 20'}
            </span>
          </button>
        ) : (
          <>
            <button
              onClick={handleGhostModeToggle}
              className={`w-11 h-11 rounded-full flex items-center justify-center pointer-events-auto shadow-lg transition-all ring-1 ${
                userTier < 2
                  ? 'bg-zinc-900/90 text-zinc-500 ring-white/[0.08]'
                  : isGhostMode
                  ? 'bg-zinc-800 text-zinc-300 ring-white/10'
                  : 'bg-emerald-950/80 text-emerald-300 ring-emerald-700/50'
              }`}
            >
              {userTier < 2 ? (
                <Lock className="w-4 h-4" />
              ) : isGhostMode ? (
                <Ghost className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>

            {showStatusInput ? (
              <div className="bg-zinc-900/95 backdrop-blur-xl ring-1 ring-white/10 rounded-2xl p-1.5 flex items-center gap-1.5 pointer-events-auto shadow-2xl">
                <input
                  type="text"
                  value={myStatus}
                  onChange={(e) => setMyStatus(e.target.value)}
                  placeholder="Set your campus status..."
                  className="bg-zinc-950 rounded-xl h-8 px-3 text-xs text-white placeholder-zinc-500 outline-none w-44"
                  maxLength={40}
                />
                <button
                  onClick={updateStatus}
                  className="w-8 h-8 rounded-xl bg-amber-400 text-zinc-950 flex items-center justify-center shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowStatusInput(true)}
                className="bg-zinc-900/85 backdrop-blur-md ring-1 ring-white/[0.08] rounded-full px-3.5 py-2 text-xs font-medium text-zinc-200 pointer-events-auto hover:text-white transition-colors shadow-lg"
              >
                {myStatus ? `"${myStatus}"` : '+ Set Map Status'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Upgrade Konnect Modal */}
      {showUpgradeModal && (
        <div className="absolute inset-0 z-[3000] flex items-center justify-center pointer-events-auto p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowUpgradeModal(null)}
          />
          <div className="relative w-full max-w-[330px] bg-[#121816] ring-1 ring-white/[0.08] rounded-3xl p-6 flex flex-col gap-5 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 flex items-center justify-center mx-auto">
              {showUpgradeModal === 'ghost' ? (
                <Ghost className="w-6 h-6" />
              ) : (
                <Unlock className="w-6 h-6" />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="text-white font-semibold tracking-tight text-lg">
                {showUpgradeModal === 'ghost' ? 'Ghost Mode' : 'Kampus Konnect'}
              </h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                {showUpgradeModal === 'ghost'
                  ? 'Browse campus hotspots and statuses invisibly without sharing your live pin.'
                  : 'See where campus is active, view peer statuses, and drop your own live pin.'}
              </p>
            </div>
            <div className="bg-zinc-950/80 rounded-2xl ring-1 ring-white/[0.06] p-4">
              <span className="text-2xl font-bold font-mono text-amber-300">
                {isFreeWeekend && showUpgradeModal === 'base'
                  ? 'FREE'
                  : `P ${showUpgradeModal === 'ghost' ? '30' : '20'}`}
              </span>
              <span className="text-zinc-500 text-xs ml-1">
                {isFreeWeekend && showUpgradeModal === 'base'
                  ? '/ weekend pass'
                  : '/ one-time'}
              </span>
            </div>
            <button
              onClick={() =>
                handleInitiatePayment(showUpgradeModal === 'ghost' ? 2 : 1)
              }
              className="w-full h-11 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-xs active:scale-[0.98] transition-all"
            >
              {isFreeWeekend && showUpgradeModal === 'base'
                ? 'Claim Weekend Pass'
                : 'Continue to Checkout'}
            </button>
            <button
              onClick={() => setShowUpgradeModal(null)}
              className="text-zinc-500 text-xs hover:text-zinc-300"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}

      <PaymentModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onConfirm={handlePaymentConfirm}
        amount={pendingTier === 2 ? 30 : 20}
        ctaLabel="Unlock Konnect"
      />

      {/* Selected Promoted Location Sheet */}
      {selectedLocation && (
        <div className="absolute inset-0 z-[2500] flex items-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedLocation(null)}
          />
          <div className="relative w-full bg-[#121816] ring-1 ring-white/[0.08] rounded-t-3xl p-6 pb-[max(64px,calc(64px+env(safe-area-inset-bottom)))] flex flex-col gap-4 animate-slide-up shadow-2xl max-h-[85dvh] overflow-y-auto no-scrollbar">
            {selectedLocation.image_url && (
              <div className="relative w-full h-44 rounded-2xl overflow-hidden ring-1 ring-white/[0.06] shrink-0 bg-zinc-950">
                <img
                  src={selectedLocation.image_url}
                  alt={selectedLocation.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1 pr-4">
                <span className="text-amber-300 text-[11px] font-medium">
                  {selectedLocation.category}
                </span>
                <h3 className="text-white text-xl font-semibold tracking-tight leading-tight">
                  {selectedLocation.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLocation(null)}
                className="w-8 h-8 rounded-full bg-zinc-900 ring-1 ring-white/[0.06] flex items-center justify-center text-zinc-400 hover:text-white shrink-0"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
            <p className="text-zinc-400 text-xs italic">
              &ldquo;{selectedLocation.vibe_tag}&rdquo;
            </p>
            <div className="flex flex-col gap-3 bg-zinc-950/70 rounded-2xl p-4 ring-1 ring-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center shrink-0">
                  <Clock
                    className="w-4 h-4 text-emerald-400"
                    strokeWidth={1.75}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-zinc-500 text-[10px] font-medium">
                    When
                  </span>
                  <span className="text-zinc-100 text-xs font-medium">
                    {selectedLocation.display_time}
                  </span>
                </div>
              </div>
              <div className="h-[1px] w-full bg-white/[0.05]" />
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center shrink-0">
                  <MapPinIcon
                    className="w-4 h-4 text-amber-300"
                    strokeWidth={1.75}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-zinc-500 text-[10px] font-medium">
                    Where
                  </span>
                  <span className="text-zinc-100 text-xs font-medium">
                    {selectedLocation.landmark_anchor}
                  </span>
                </div>
              </div>
            </div>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${selectedLocation.lat},${selectedLocation.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-11 rounded-xl bg-amber-400 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all mt-1"
            >
              <Navigation className="w-4 h-4" /> Get Directions
            </a>
          </div>
        </div>
      )}

      {/* Selected SOS Alert Sheet */}
      {selectedSos && (
        <div className="absolute inset-0 z-[2500] flex items-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedSos(null)}
          />
          <div className="relative w-full bg-[#121816] ring-1 ring-white/[0.08] rounded-t-3xl p-6 pb-[max(64px,calc(64px+env(safe-area-inset-bottom)))] flex flex-col gap-4 animate-slide-up shadow-2xl max-h-[85dvh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {selectedSos.active ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping inline-block" />
                    <span className="text-rose-300 font-semibold text-sm tracking-tight">
                      Active Emergency Broadcast
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
                    <span className="text-zinc-400 font-semibold text-sm tracking-tight">
                      Resolved Alert
                    </span>
                  </>
                )}
              </div>
              <button
                onClick={() => setSelectedSos(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>
            <div className="flex flex-col gap-3 bg-zinc-950/70 rounded-2xl p-4 ring-1 ring-white/[0.06] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center shrink-0">
                  <User
                    className="w-4 h-4 text-emerald-400"
                    strokeWidth={1.75}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-zinc-500 text-[10px] font-medium">
                    Student
                  </span>
                  <span className="text-zinc-100 text-xs font-semibold">
                    {selectedSos.user_name ?? 'Student'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center shrink-0">
                  <MapPinIcon
                    className="w-4 h-4 text-amber-300"
                    strokeWidth={1.75}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-zinc-500 text-[10px] font-medium">
                    Location
                  </span>
                  <span className="text-zinc-100 text-xs font-medium">
                    {selectedSos.location_name ?? 'Campus Zone'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-zinc-400" strokeWidth={1.75} />
                </div>
                <div className="flex flex-col">
                  <span className="text-zinc-500 text-[10px] font-medium">
                    Time
                  </span>
                  <span className="text-zinc-200 text-xs">
                    {timeAgo(selectedSos.created_at)}
                  </span>
                </div>
              </div>
            </div>
            {selectedSos.user_id && onMessageUser ? (
              <button
                onClick={() => {
                  const uid = selectedSos.user_id;
                  const uname = selectedSos.user_name ?? 'Student';
                  setSelectedSos(null);
                  if (uid) onMessageUser(uid, uname);
                }}
                className="w-full h-11 rounded-xl bg-amber-400 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all shrink-0"
              >
                <MessageCircle className="w-4 h-4" strokeWidth={2} /> Check Up /
                Message Student
              </button>
            ) : (
              <p className="text-zinc-500 text-xs text-center shrink-0">
                Broadcasted by a guest session.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
