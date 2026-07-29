'use client';

import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/utils';
import type { Hazard, SosAlert, HazardRow } from '@/lib/types';

import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER: [number, number] = [-24.6735, 25.9297];

function createUserPin() {
  const html = `
    <div style="position:relative;width:24px;height:24px;">
      <span style="position:absolute;inset:-4px;border-radius:50%;background:#FFDE4D;opacity:0.35;animation:kampus-pulse 2s ease-out infinite;"></span>
      <span style="position:absolute;inset:0;border-radius:50%;background:#FFDE4D;box-shadow:0 0 0 3px rgba(255,222,77,0.25);"></span>
    </div>`;
  return L.divIcon({
    html,
    className: 'kampus-user-pin',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function createHazardPin() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFDE4D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;
  const html = `
    <div style="
      width:28px;height:28px;border-radius:50%;
      background:#15241C;border:1px solid #8BA396;
      display:flex;align-items:center;justify-content:center;
    ">${svg}</div>`;
  return L.divIcon({
    html,
    className: 'kampus-hazard-pin',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createSosPin() {
  const html = `
    <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
      <span style="position:absolute;inset:-8px;border-radius:50%;background:#EF4444;opacity:0.18;animation:sos-pulse-ring 1.4s ease-out infinite;"></span>
      <span style="position:absolute;inset:-3px;border-radius:50%;background:#EF4444;opacity:0.28;animation:sos-pulse-ring 1.4s ease-out 0.4s infinite;"></span>
      <span style="position:absolute;inset:0;border-radius:50%;background:#EF4444;box-shadow:0 0 12px 4px rgba(239,68,68,0.55);display:flex;align-items:center;justify-content:center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
      </span>
    </div>`;
  return L.divIcon({
    html,
    className: 'kampus-sos-pin',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function LocationTracker({
  onLocate,
}: {
  onLocate: (pos: [number, number]) => void;
}) {
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
  newHazard,
  onNewHazardConsumed,
  onOpenHazard,
  sosAlerts,
  onLocate,
}: {
  newHazard: Hazard | null;
  onNewHazardConsumed: () => void;
  onOpenHazard: (h: Hazard) => void;
  sosAlerts: SosAlert[];
  onLocate: (pos: [number, number]) => void;
}) {
  const [hazards, setHazards] = useState<Hazard[]>([]);

  // Load real hazards from the database.
  useEffect(() => {
    const loadHazards = async () => {
      const { data } = await supabase
        .from('hazards')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) {
        const mapped: Hazard[] = (data as HazardRow[]).map((row) => ({
          id: row.id,
          position: [row.lat, row.lng],
          label: row.title,
          category: row.type,
          time: timeAgo(row.created_at),
          lockedToLive: true,
          comments: [],
        }));
        setHazards(mapped);
      }
    };
    loadHazards();

    const channel = supabase
      .channel('public:hazards:radar')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hazards' },
        (payload) => {
          const row = payload.new as HazardRow;
          const hazard: Hazard = {
            id: row.id,
            position: [row.lat, row.lng],
            label: row.title,
            category: row.type,
            time: 'just now',
            lockedToLive: true,
            comments: [],
          };
          setHazards((prev) => [hazard, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Handle a locally-created hazard (from the report modal).
  useEffect(() => {
    if (!newHazard) return;
    setHazards((prev) => [newHazard, ...prev]);
    onNewHazardConsumed();
  }, [newHazard, onNewHazardConsumed]);

  const handleLocate = useCallback(
    (pos: [number, number]) => onLocate(pos),
    [onLocate]
  );

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={14}
      zoomControl={false}
      attributionControl={false}
      className="w-full h-full"
      style={{ background: '#0B1611' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
      />
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
          icon={createSosPin()}
        />
      ))}

      {/* Emergency Unit Disclaimer */}
      <div className="absolute bottom-2 left-2 right-2 z-[500] pointer-events-none">
        <div className="bg-surface/85 backdrop-blur-sm rounded-xl border border-gray-800 px-3 py-2">
          <p className="text-sage text-[9px] leading-snug text-center">
            <span className="font-bold text-yellow-400">Notice:</span> Kampus is a peer-to-peer student community assistance platform. Kampus is NOT an official emergency response unit, law enforcement agency, or campus security service. In case of immediate life-threatening danger, contact campus security or emergency services (999/997) directly.
          </p>
        </div>
      </div>
    </MapContainer>
  );
}
