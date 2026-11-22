'use client';
import SecureImage from './SecureImage';
import RadarSocial from './RadarSocial';
import {useRadar, escapeRadarText, type RadarShare} from '@/lib/use-radar';
import { filterRadarShares, type RadarFilter } from '@/lib/radar-privacy';

import L from 'leaflet';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/utils';
import type { Hazard, SosAlert, HazardRow, Profile } from '@/lib/types';
import {
  X,
  MessageCircle,
  MapPin as MapPinIcon,
  Clock,
  User,
  Navigation,
  Plus,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

function createKonnectPin(user: RadarShare) {
 const label=escapeRadarText((user.username||'Friend').slice(0,30));
 const initial=escapeRadarText((user.username||'?')[0].toUpperCase());
 return L.divIcon({html:`<div class="radar-friend-pin ${user.company_welcome?'radar-welcome':''}"><span>${initial}</span><b>${label}</b>${user.company_welcome?'<i>Join me</i>':''}</div>`,className:'kampus-konnect-pin',iconSize:[48,48],iconAnchor:[24,24]});
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

function RadarCanvas({onMap,campus}:{onMap:(map:L.Map|null)=>void;campus:string}) {
 const node=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!node.current)return;
  const centre=/university of botswana|\bub\b/i.test(campus)?CAMPUSES.UB_GBE:/gaborone/i.test(campus)?CAMPUSES.BAC_GBE:null;
  const map=L.map(node.current,{zoomControl:false,attributionControl:true}).setView(centre?[centre.lat,centre.lng]:DEFAULT_CENTER,15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{className:'dark-osm-tiles',attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  onMap(map);const resize=new ResizeObserver(()=>map.invalidateSize());resize.observe(node.current);
  return()=>{resize.disconnect();map.remove();onMap(null);};
 },[onMap,campus]);
 return <div ref={node} className="h-full w-full" style={{background:'#0B0F0E'}} aria-label="Campus map"/>;
}

/** Storefront links focus a public area, never a private business address. */
function RequestedPlaceFocus({map,place}:{map:L.Map|null;place?:string}){
 useEffect(()=>{
  if(!map)return;
  if(place?.toLowerCase().includes('tlokweng'))map.flyTo([-24.66861,25.97111],13);
  if(place?.toLowerCase()==='gaborone rock n rolls')map.flyTo([-24.6282,25.9231],12);
 },[map,place]);
 return null;
}

export default function RadarMap({
  profile,
  onOpenHazard,
  sosAlerts,
  onLocate,
  onMessageUser,
  onJoinUser,
  onRequestSOS,
  onReportHazard,
  focusPlace,
}: {
  profile: Profile | null;
  onOpenHazard: (h: Hazard) => void;
  sosAlerts: SosAlert[];
  onLocate: (pos: [number, number]) => void;
  onMessageUser?: (userId: string, username: string) => void;
  onJoinUser?: (userId: string, username: string) => void;
  onRequestSOS?: () => void;
  onReportHazard?: () => void;
  focusPlace?: string;
}) {
  const { toast } = useToast();
  const [isMounted,setIsMounted]=useState(false);
  const [locateRequested,setLocateRequested]=useState(false);
  const [localPosition,setLocalPosition]=useState<[number,number]|null>(null);

  const radar=useRadar(profile?.id);
  const [friendFilter,setFriendFilter]=useState<RadarFilter>('all');
  const [selectedPeer,setSelectedPeer]=useState<RadarShare|null>(null);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [selectedSos, setSelectedSos] = useState<SosAlert | null>(null);

  const [promotedLocations, setPromotedLocations] = useState<
    PromotedLocation[]
  >([]);
  const [selectedLocation, setSelectedLocation] =
    useState<PromotedLocation | null>(null);

  const [nearbyCampus, setNearbyCampus] = useState<string | null>(null);
  const [inCampusMode, setInCampusMode] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const loadData = async () => {
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

      const { data: pData } = await supabase
        .from('promoted_locations')
        .select('*');
      if (pData) setPromotedLocations(pData as PromotedLocation[]);

    };
    loadData();

    const channel = supabase
      .channel('public:radar_map')
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

  const visibleSharesKey=JSON.stringify(filterRadarShares(radar.data.shares,friendFilter));
  useEffect(()=>{
   if(!mapInstance)return;
   const group=L.layerGroup().addTo(mapInstance);
   hazards.forEach(h=>L.marker(h.position,{icon:createHazardPin(),title:h.label}).on('click',()=>onOpenHazard(h)).addTo(group));
   sosAlerts.forEach(alert=>L.marker([alert.lat,alert.lng],{icon:createSosPin(alert.active),title:'SOS alert'}).on('click',()=>setSelectedSos(alert)).addTo(group));
   (JSON.parse(visibleSharesKey) as RadarShare[]).forEach(peer=>L.marker([peer.lat,peer.lng],{icon:createKonnectPin(peer),title:peer.username||'Friend'}).on('click',()=>setSelectedPeer(peer)).addTo(group));
   promotedLocations.forEach(place=>L.marker([place.lat,place.lng],{icon:createLocationPin(),title:place.title}).on('click',()=>setSelectedLocation(place)).addTo(group));
   if(localPosition)L.marker(localPosition,{icon:createUserPin(),title:'Your position (only visible to you)'}).addTo(group);
   return()=>{group.remove();};
  },[mapInstance,hazards,sosAlerts,visibleSharesKey,promotedLocations,localPosition,onOpenHazard]);
  useEffect(()=>{
   if(!mapInstance)return;
   const detect=()=>{const center=mapInstance.getCenter();const match=Object.entries(CAMPUSES).find(([,c])=>center.distanceTo([c.lat,c.lng])<c.radius);setNearbyCampus(match?.[0]||null);};
   detect();mapInstance.on('moveend',detect);return()=>{mapInstance.off('moveend',detect);};
  },[mapInstance]);
  const locate=()=>{
   if(!navigator.geolocation){toast({title:'Location unavailable'});return;}
   setLocateRequested(true);
   navigator.geolocation.getCurrentPosition(p=>{const pos:[number,number]=[p.coords.latitude,p.coords.longitude];setLocalPosition(pos);onLocate(pos);mapInstance?.setView(pos,16);setLocateRequested(false);},()=>{setLocateRequested(false);toast({title:'Location unavailable',description:'Allow location access to centre the map. Your position is not shared.'});},{enableHighAccuracy:true,timeout:15000,maximumAge:5000});
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
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .dark-osm-tiles { filter: invert(100%) hue-rotate(180deg) brightness(92%) contrast(92%) saturate(80%); }
      `,
        }}
      />

      <RadarCanvas onMap={setMapInstance} campus={profile?.university||''}/>
      <RequestedPlaceFocus map={mapInstance} place={focusPlace}/>


      {/* A single action rail prevents SOS, hazard and locate from overlapping. */}
      <div
        role="group"
        aria-label="Radar map actions"
        className="pointer-events-none absolute right-3 top-1/2 z-[1200] flex -translate-y-1/2 flex-col items-center gap-2.5 sm:right-5"
      >
        {onRequestSOS && (
          <button
            type="button"
            onClick={onRequestSOS}
            aria-label="Campus SOS — request help"
            title="Campus SOS"
            className="pointer-events-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-400/40 bg-red-600 text-white shadow-lg shadow-black/30 transition-transform active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <ShieldAlert className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
        )}
        {onReportHazard && (
          <button
            type="button"
            onClick={onReportHazard}
            aria-label="Drop new hazard pin"
            title="Report hazard"
            className="pointer-events-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-yellow-300/50 bg-pine text-midnight shadow-lg shadow-black/30 transition-transform active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          disabled={locateRequested}
          aria-label="Center map on my location"
          title="Locate me (only visible to you)"
          onClick={locate}
          className="pointer-events-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-pine/50 bg-[#102219]/95 text-pine shadow-lg shadow-black/30 transition-transform active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pine disabled:opacity-60"
        >
          {locateRequested
            ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            : <Navigation className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      <RadarSocial
        campusFocus={nearbyCampus ? {
          label: CAMPUSES[nearbyCampus as keyof typeof CAMPUSES].name,
          active: inCampusMode === nearbyCampus,
          onFocus: handleEnterCampusMode,
          onClear: () => setInCampusMode(null),
        } : undefined}
        radar={radar} selected={selectedPeer} onSelect={setSelectedPeer} onMessage={onMessageUser} onJoin={onJoinUser} filter={friendFilter} onFilter={setFriendFilter} signedIn={!!profile}
        onFocus={(lat,lng)=>mapInstance?.flyTo([lat,lng],16,{duration:.8,animate:!window.matchMedia('(prefers-reduced-motion: reduce)').matches})}
        places={[...Object.entries(CAMPUSES).map(([id,c])=>({id,title:c.name,lat:c.lat,lng:c.lng})),...promotedLocations]} />

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
                <SecureImage
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
