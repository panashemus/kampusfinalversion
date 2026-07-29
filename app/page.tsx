'use client';

import { useState, useCallback, useEffect } from 'react';
import { Bell, Plus, Search, X, MapPin, Lock, MessageSquare, ShieldCheck, ShieldAlert, Phone, Loader as Loader2, Crown, MessageCircle, ShieldAlert as SosIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import type { View, Hazard, Comment, SosAlert, Profile, HazardRow } from '@/lib/types';
import { haversineMeters, locationLabel } from '@/lib/utils';
import AuthScreen from '@/components/AuthScreen';
import HustleHub from '@/components/HustleHub';
import CommunityHub from '@/components/CommunityHub';
import EscrowVault from '@/components/EscrowVault';
import ProfileScreen from '@/components/ProfileScreen';
import BottomNav from '@/components/BottomNav';
import CommentThread from '@/components/CommentThread';
import PublicProfileModal from '@/components/PublicProfileModal';
import SubscriptionModal from '@/components/SubscriptionModal';
import OtpModal from '@/components/OtpModal';
import ChatRoom from '@/components/ChatRoom';
import ChatInbox from '@/components/ChatInbox';
import AdminQueue from '@/components/AdminQueue';
import LegalModal from '@/components/LegalModal';

const RadarMap = dynamic(() => import('@/components/RadarMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-midnight flex items-center justify-center">
      <span className="text-sage text-sm">Loading radar…</span>
    </div>
  ),
});

const HEADER_TITLES: Record<Exclude<View, 'auth'>, string> = {
  radar: 'KAMPUS RADAR',
  hustle: 'HUSTLE HUB',
  community: 'CAMPUS FEED',
  escrow: 'ESCROW & PAYMENTS',
  profile: 'STUDENT ID',
};

const HAZARD_CATEGORIES = [
  'Suspicious Activity',
  'Poor Lighting',
  'General Safety',
];

let hazardSeq = 0;
function nextHazardId() {
  hazardSeq += 1;
  return `h-${Date.now()}-${hazardSeq}`;
}

function hasPremiumAccess(p: Profile | null): boolean {
  if (!p) return false;
  if (p.is_admin) return true;
  if (p.is_premium) return true;
  return !!p.subscribed_until && new Date(p.subscribed_until) > new Date();
}

export default function Home() {
  const [activeView, setActiveView] = useState<View>('auth');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);
  const [hazardCategory, setHazardCategory] = useState(HAZARD_CATEGORIES[0]);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'locked' | 'denied'>('idle');
  const [liveCoords, setLiveCoords] = useState<[number, number] | null>(null);
  const [pendingHazard, setPendingHazard] = useState<Hazard | null>(null);
  const [openHazard, setOpenHazard] = useState<Hazard | null>(null);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [profileUser, setProfileUser] = useState<string | null>(null);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatInboxOpen, setChatInboxOpen] = useState(false);
  const [adminQueueOpen, setAdminQueueOpen] = useState(false);
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);
  const [activeChat, setActiveChat] = useState<{ peerId: string; peerUsername: string } | null>(null);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [sosNotifications, setSosNotifications] = useState<{ id: string; text: string; time: string }[]>([]);

  // SOS state
  const [sosGeoStatus, setSosGeoStatus] = useState<'idle' | 'locating' | 'broadcasting' | 'done' | 'denied'>('idle');
  const [activeSosAlerts, setActiveSosAlerts] = useState<SosAlert[]>([]);
  const [activeHelpCard, setActiveHelpCard] = useState<SosAlert | null>(null);

  // Load active SOS alerts on radar view
  useEffect(() => {
    if (activeView !== 'radar') return;
    const fetchAlerts = async () => {
      const { data } = await supabase
        .from('sos_alerts')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (data) setActiveSosAlerts(data as SosAlert[]);
    };
    fetchAlerts();

    const channel = supabase
      .channel('sos_alerts_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alerts' }, () => {
        fetchAlerts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeView]);

  // Real-time SOS alert listener — broadcasts in-app push notification
  // to all users within 1km of the alert.
  useEffect(() => {
    const channel = supabase
      .channel('sos_alerts_push')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sos_alerts' },
        (payload) => {
          const alert = payload.new as SosAlert;
          // Only show push if we have the user's location and it's within 1km.
          if (userCoords) {
            const dist = haversineMeters(
              userCoords[0],
              userCoords[1],
              alert.lat,
              alert.lng
            );
            if (dist <= 1000) {
              const userName = alert.user_name ?? 'A student';
              const loc = alert.location_name ?? locationLabel(alert.lat, alert.lng);
              const text = `EMERGENCY: ${userName} has triggered an assistance alert near ${loc}.`;
              toast({ title: '🚨 EMERGENCY ALERT', description: text, variant: 'destructive' });
              setSosNotifications((prev) => [
                { id: alert.id, text, time: 'just now' },
                ...prev,
              ]);
            }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userCoords]);

  // Real-time hazards subscription — Peer Guard toast on new SOS hazard.
  useEffect(() => {
    if (activeView !== 'radar') return;
    const channel = supabase
      .channel('public:hazards')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hazards' },
        (payload) => {
          const row = payload.new as HazardRow;
          toast({
            title: '🚨 PEER GUARD',
            description: 'Active SOS Alert Nearby!',
          });
          // Also surface as a local hazard pin for immediate visibility.
          const hazard: Hazard = {
            id: row.id,
            position: [row.lat, row.lng],
            label: row.title,
            category: row.type,
            time: 'just now',
            lockedToLive: true,
            comments: [],
          };
          setPendingHazard(hazard);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeView]);

  const handleNewHazardConsumed = useCallback(() => {
    setPendingHazard(null);
  }, []);

  const addHazardComment = useCallback(
    (comment: Comment) => {
      setOpenHazard((prev) =>
        prev ? { ...prev, comments: [...prev.comments, comment] } : prev
      );
    },
    []
  );

  const createHazard = useCallback(
    (coords: [number, number]) => {
      const hazard: Hazard = {
        id: nextHazardId(),
        position: coords,
        label: `${hazardCategory} pin`,
        category: hazardCategory,
        time: 'just now',
        lockedToLive: true,
        comments: [],
      };
      setPendingHazard(hazard);
      setIsReportModalOpen(false);
      setGeoStatus('idle');
      setLiveCoords(null);
    },
    [hazardCategory]
  );

  const handleDropPin = useCallback(() => {
    if (geoStatus !== 'locked' || !liveCoords) {
      setGeoStatus('locating');
      if (!('geolocation' in navigator)) {
        setGeoStatus('denied');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: [number, number] = [
            position.coords.latitude,
            position.coords.longitude,
          ];
          setLiveCoords(coords);
          setGeoStatus('locked');
          createHazard(coords);
        },
        () => setGeoStatus('denied'),
        { enableHighAccuracy: true, timeout: 15000 }
      );
      return;
    }
    createHazard(liveCoords);
  }, [geoStatus, liveCoords, createHazard]);

  const handleBroadcastSos = useCallback(async () => {
    setSosGeoStatus('locating');
    if (!('geolocation' in navigator)) {
      setSosGeoStatus('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setSosGeoStatus('broadcasting');
        const { latitude: lat, longitude: lng } = position.coords;
        const userName = profile ? profile.email.split('@')[0] : 'A student';
        const loc = locationLabel(lat, lng);
        const { data, error } = await supabase
          .from('sos_alerts')
          .insert({
            lat,
            lng,
            active: true,
            user_id: profile?.id ?? null,
            user_name: userName,
            location_name: loc,
          })
          .select()
          .maybeSingle();

        if (error || !data) {
          setSosGeoStatus('idle');
          return;
        }

        const alert = data as SosAlert;
        setActiveSosAlerts((prev) => [alert, ...prev]);
        setActiveHelpCard(alert);
        setSosGeoStatus('done');
        setIsSosModalOpen(false);
      },
      () => setSosGeoStatus('denied'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, [profile]);

  const handleDismissHelpCard = useCallback(async () => {
    if (!activeHelpCard) return;
    await supabase
      .from('sos_alerts')
      .update({ active: false })
      .eq('id', activeHelpCard.id);
    setActiveSosAlerts((prev) => prev.filter((a) => a.id !== activeHelpCard.id));
    setActiveHelpCard(null);
    setSosGeoStatus('idle');
  }, [activeHelpCard]);

  const requireVerified = useCallback(
    (action: () => void) => {
      if (!profile?.email_verified) {
        toast({
          title: 'Verification required',
          description: 'Please verify your student email to use this feature.',
          variant: 'destructive',
        });
        setShowOtp(true);
        return;
      }
      action();
    },
    [profile]
  );

  const requirePremium = useCallback(
    (action: () => void) => {
      if (!profile?.email_verified) {
        toast({
          title: 'Verification required',
          description: 'Please verify your student email to use this feature.',
          variant: 'destructive',
        });
        setShowOtp(true);
        return;
      }
      if (!hasPremiumAccess(profile)) {
        setIsSubscriptionOpen(true);
        return;
      }
      action();
    },
    [profile]
  );

  const openChat = useCallback(
    (peerId: string, peerUsername: string) => {
      requireVerified(() => setActiveChat({ peerId, peerUsername }));
    },
    [requireVerified]
  );

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setActiveView('auth');
  }, []);

  // Restore session on mount.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user || !mounted) return;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      if (data && mounted) {
        setProfile(data as Profile);
        setActiveView('radar');
        // Prompt verification for unverified users.
        if (!(data as Profile).email_verified) setShowOtp(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profile.id)
      .maybeSingle();
    if (data) setProfile(data as Profile);
  }, [profile]);

  if (activeView === 'auth') {
    return (
      <AuthScreen
        onVerified={(p) => {
          setProfile(p);
          setActiveView('radar');
        }}
      />
    );
  }

  const showSearch = activeView === 'hustle' || activeView === 'community';

  return (
    <div className="flex flex-col h-screen h-[100dvh] w-full overflow-hidden bg-[#0B1611] items-center">
      <div className="relative w-full max-w-[430px] h-screen h-[100dvh] flex flex-col overflow-hidden bg-midnight">
        {/* Global Top Header */}
        <header className="sticky top-0 z-[1000] bg-midnight p-4 flex items-center justify-between">
          <span className="text-white font-black text-xl tracking-tight">
            {HEADER_TITLES[activeView]}
          </span>
          <div className="flex items-center gap-3">
            {showSearch && (
              <button
                onClick={() => setSearchOpen((v) => !v)}
                aria-label="Search gigs"
                className={searchOpen ? 'text-pine' : 'text-sage'}
              >
                <Search className="w-6 h-6" strokeWidth={1.5} />
              </button>
            )}
            <button
              onClick={() => setChatInboxOpen(true)}
              aria-label="Messages"
              className="relative"
            >
              <MessageCircle className="w-6 h-6 text-sage" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setIsNotifOpen((v) => !v)}
              aria-label="Toggle notifications"
              className="relative"
            >
              <Bell className="w-6 h-6 text-sage" strokeWidth={1.5} />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
            </button>
          </div>
        </header>

        {/* Search bar (Hustle Hub) */}
        {showSearch && searchOpen && (
          <div className="px-4 pb-3 bg-midnight">
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeView === 'hustle' ? 'Search gigs by title or seller...' : 'Search posts by keyword...'}
              className="w-full h-10 rounded-lg bg-surface border border-gray-800 px-3 text-white placeholder:text-sage text-sm outline-none focus:border-pine transition-colors"
            />
          </div>
        )}

        {/* Notifications Panel */}
        {isNotifOpen && (
          <div className="absolute top-16 left-0 right-0 z-[1500] px-4">
            <div className="bg-surface rounded-2xl border border-gray-800 shadow-xl flex flex-col gap-3 p-4 animate-slide-down">
              <div className="flex items-center justify-between">
                <span className="text-white font-black text-sm tracking-wider">
                  NOTIFICATIONS
                </span>
                <button onClick={() => setIsNotifOpen(false)} aria-label="Close">
                  <X className="w-4 h-4 text-sage" strokeWidth={1.5} />
                </button>
              </div>
              {sosNotifications.length === 0 ? (
                <span className="text-sage text-xs">No new notifications.</span>
              ) : (
                sosNotifications.map((n) => (
                  <div key={n.id} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-red-900/30 border border-red-700/50 flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-4 h-4 text-red-400" strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-white text-sm font-bold leading-snug">
                        {n.text}
                      </span>
                      <span className="text-sage text-[10px]">{n.time}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* View Content */}
        <main className="flex-1 relative overflow-y-auto overscroll-y-contain pb-24">
          {activeView === 'radar' && (
            <div className="absolute inset-0">
              <RadarMap
                newHazard={pendingHazard}
                onNewHazardConsumed={handleNewHazardConsumed}
                onOpenHazard={setOpenHazard}
                sosAlerts={activeSosAlerts}
                onLocate={(pos) => setUserCoords(pos)}
              />

              {/* Empty state overlay when no hazards and no SOS alerts */}
              {activeSosAlerts.length === 0 && (
                <div className="absolute top-20 left-4 right-4 z-[500] pointer-events-none">
                  <div className="bg-surface/80 backdrop-blur-sm rounded-2xl border border-gray-800 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-pine/15 border border-pine/40 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5 text-pine" strokeWidth={1.5} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-white text-sm font-bold">No active hazards reported nearby</span>
                      <span className="text-sage text-xs">Campus is clear!</span>
                    </div>
                  </div>
                </div>
              )}

              {/* FAB cluster: hazard pin + SOS */}
              <div className="absolute bottom-6 right-4 z-[1001] flex flex-col items-center gap-3">
                {/* SOS FAB */}
                <button
                  onClick={() => { setSosGeoStatus('idle'); setIsSosModalOpen(true); }}
                  aria-label="Campus SOS — request help"
                  className="sos-fab-glow h-14 w-14 rounded-full bg-red-600 flex items-center justify-center active:scale-95 transition-transform"
                >
                  <ShieldAlert className="w-6 h-6 text-white" strokeWidth={2} />
                </button>

                {/* Hazard pin FAB */}
                <button
                  onClick={() => setIsReportModalOpen(true)}
                  className="h-14 w-14 rounded-full bg-pine flex items-center justify-center active:scale-95 transition-transform shadow-lg"
                  aria-label="Drop new hazard pin"
                >
                  <Plus className="w-6 h-6 text-black" strokeWidth={2.5} />
                </button>
              </div>

              {/* Active Help Request Card */}
              {activeHelpCard && (
                <div className="absolute bottom-28 left-4 right-4 z-[1001]">
                  <div className="bg-red-950/90 border border-red-600/60 rounded-2xl p-4 backdrop-blur-sm shadow-xl flex flex-col gap-3 animate-slide-up">
                    {/* Pulsing header row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-broadcast-pulse inline-block" />
                        <span className="text-red-400 font-black text-xs tracking-widest uppercase">
                          Active Help Request
                        </span>
                      </div>
                      <button
                        onClick={handleDismissHelpCard}
                        aria-label="Dismiss help request"
                        className="text-red-400 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" strokeWidth={2} />
                      </button>
                    </div>

                    <p className="text-white text-sm leading-relaxed">
                      Your SOS beacon is live. Verified students within{' '}
                      <span className="text-red-300 font-bold">1km</span> have been
                      alerted. Help is on the way.
                    </p>

                    <div className="flex gap-2">
                      <a
                        href="tel:+26735523962"
                        className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-red-700/60 text-white text-xs font-bold active:scale-95 transition-transform"
                      >
                        <Phone className="w-3.5 h-3.5" strokeWidth={2} />
                        UB Protection
                      </a>
                      <a
                        href="tel:+26739530622"
                        className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-red-700/60 text-white text-xs font-bold active:scale-95 transition-transform"
                      >
                        <Phone className="w-3.5 h-3.5" strokeWidth={2} />
                        BAC Security
                      </a>
                    </div>

                    <button
                      onClick={handleDismissHelpCard}
                      className="w-full h-9 rounded-lg border border-red-600/50 text-red-400 text-xs font-bold active:scale-95 transition-transform"
                    >
                      I&apos;m Safe — Deactivate Beacon
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {activeView === 'hustle' && (
            <HustleHub
              searchQuery={searchQuery}
              onMessageSeller={openChat}
              requireVerified={requirePremium}
              profile={profile}
            />
          )}
          {activeView === 'community' && <CommunityHub profile={profile} searchQuery={searchQuery} />}
          {activeView === 'escrow' && (
            <EscrowVault requireVerified={requirePremium} />
          )}
          {activeView === 'profile' && (
            <ProfileScreen
              profile={profile}
              onDisconnect={handleSignOut}
              onOpenSubscription={() => setIsSubscriptionOpen(true)}
              onOpenAdminQueue={() => setAdminQueueOpen(true)}
            />
          )}
        </main>

        {/* Hazard Report Modal */}
        {isReportModalOpen && (
          <div className="absolute inset-0 z-[2000] flex items-end">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setIsReportModalOpen(false)}
            />
            <div className="relative w-full bg-surface rounded-t-2xl p-6 flex flex-col gap-5 animate-slide-up">
              <div className="flex items-center justify-between">
                <span className="text-white font-bold text-lg">
                  Report Campus Hazard
                </span>
                <button
                  onClick={() => setIsReportModalOpen(false)}
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-sage" strokeWidth={1.5} />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sage text-xs font-bold uppercase tracking-wider">
                  Category
                </span>
                <div className="flex flex-wrap gap-2">
                  {HAZARD_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setHazardCategory(cat)}
                      className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                        hazardCategory === cat
                          ? 'bg-pine text-black'
                          : 'bg-transparent border border-sage text-sage'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Geofence status micro-badge */}
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold ${
                    geoStatus === 'locked'
                      ? 'bg-pine/15 text-pine border border-pine/50'
                      : geoStatus === 'denied'
                      ? 'bg-red-500/15 text-red-400 border border-red-500/40'
                      : 'bg-ink text-sage border border-gray-800'
                  }`}
                >
                  <Lock className="w-3 h-3" strokeWidth={2} />
                  {geoStatus === 'locating'
                    ? 'Acquiring live GPS...'
                    : geoStatus === 'locked'
                    ? 'Locked to live location'
                    : geoStatus === 'denied'
                    ? 'GPS access denied'
                    : 'Will lock to live GPS'}
                </div>
                {liveCoords && geoStatus === 'locked' && (
                  <span className="text-sage text-[10px]">
                    {liveCoords[0].toFixed(4)}, {liveCoords[1].toFixed(4)}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-3 mt-1">
                <button
                  onClick={handleDropPin}
                  disabled={geoStatus === 'locating'}
                  className="w-full h-12 rounded-lg bg-pine text-black font-bold text-base active:scale-95 transition-transform disabled:opacity-60 disabled:active:scale-100"
                >
                  {geoStatus === 'locating'
                    ? 'Locking GPS...'
                    : 'Drop Alert Pin'}
                </button>
                <button
                  onClick={() => setIsReportModalOpen(false)}
                  className="w-full h-10 text-red-500 font-bold text-sm active:scale-95 transition-transform"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SOS Trigger Modal */}
        {isSosModalOpen && (
          <div className="absolute inset-0 z-[2000] flex items-end">
            <div
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
              onClick={() => { if (sosGeoStatus !== 'broadcasting') setIsSosModalOpen(false); }}
            />
            <div className="relative w-full bg-[#170909] border-t-2 border-red-700/70 rounded-t-2xl p-6 flex flex-col gap-5 animate-slide-up">

              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-600/20 border border-red-600/50 flex items-center justify-center">
                    <ShieldAlert className="w-5 h-5 text-red-500" strokeWidth={2} />
                  </div>
                  <span className="text-red-500 font-black text-xl tracking-tight">
                    EMERGENCY BROADCAST
                  </span>
                </div>
                {sosGeoStatus !== 'broadcasting' && (
                  <button
                    onClick={() => setIsSosModalOpen(false)}
                    aria-label="Close SOS modal"
                    className="text-red-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" strokeWidth={2} />
                  </button>
                )}
              </div>

              {/* Description */}
              <p className="text-gray-300 text-sm leading-relaxed">
                This will alert all verified students within{' '}
                <span className="text-red-400 font-bold">1km</span> of your exact
                location and display an active help pin on the campus radar.
              </p>

              {/* GPS denied warning */}
              {sosGeoStatus === 'denied' && (
                <div className="flex items-center gap-2 rounded-xl bg-red-900/30 border border-red-700/50 px-4 py-3">
                  <span className="text-red-400 text-xs font-bold">
                    GPS access denied. Please enable location in your browser settings and try again.
                  </span>
                </div>
              )}

              {/* Direct Hotlines */}
              <div className="flex flex-col gap-2">
                <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                  Direct Hotlines
                </span>
                <div className="flex gap-3">
                  <a
                    href="tel:+26735523962"
                    className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-red-900/40 border border-red-700/50 text-white text-sm font-bold active:scale-95 transition-transform"
                  >
                    <Phone className="w-4 h-4 text-red-400" strokeWidth={2} />
                    UB Protection
                  </a>
                  <a
                    href="tel:+26739530622"
                    className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-red-900/40 border border-red-700/50 text-white text-sm font-bold active:scale-95 transition-transform"
                  >
                    <Phone className="w-4 h-4 text-red-400" strokeWidth={2} />
                    BAC Security
                  </a>
                </div>
                <div className="flex gap-3">
                  <a
                    href="tel:+26735523962"
                    className="flex-1 text-center text-gray-500 text-[10px]"
                  >
                    +267 355 2396
                  </a>
                  <a
                    href="tel:+26739530622"
                    className="flex-1 text-center text-gray-500 text-[10px]"
                  >
                    +267 395 3062
                  </a>
                </div>
              </div>

              {/* Broadcast button */}
              <button
                onClick={handleBroadcastSos}
                disabled={sosGeoStatus === 'locating' || sosGeoStatus === 'broadcasting'}
                className="w-full h-14 rounded-xl bg-red-600 text-white font-black text-base tracking-wide animate-broadcast-pulse active:scale-95 transition-transform disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2"
              >
                {(sosGeoStatus === 'locating' || sosGeoStatus === 'broadcasting') && (
                  <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
                )}
                {sosGeoStatus === 'locating' && 'Acquiring GPS...'}
                {sosGeoStatus === 'broadcasting' && 'Broadcasting...'}
                {(sosGeoStatus === 'idle' || sosGeoStatus === 'denied') && (
                  <>
                    <ShieldAlert className="w-5 h-5" strokeWidth={2} />
                    BROADCAST SOS ALERT
                  </>
                )}
              </button>

              <p className="text-gray-600 text-[10px] text-center leading-relaxed">
                Only use in a genuine emergency. False alerts may result in account suspension.
              </p>
            </div>
          </div>
        )}

        {/* Hazard Pin Drawer */}
        {openHazard && (
          <div className="absolute inset-0 z-[2000] flex items-end">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setOpenHazard(null)}
            />
            <div className="relative w-full bg-surface rounded-t-2xl p-6 flex flex-col gap-4 animate-slide-up max-h-[80%] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-white font-bold text-lg">
                    {openHazard.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-pine" strokeWidth={1.5} />
                    <span className="text-sage text-xs">{openHazard.label}</span>
                  </div>
                </div>
                <button onClick={() => setOpenHazard(null)} aria-label="Close">
                  <X className="w-5 h-5 text-sage" strokeWidth={1.5} />
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sage text-xs font-bold uppercase tracking-wider">
                  Time Reported
                </span>
                <span className="text-white text-sm">{openHazard.time}</span>
              </div>

              {openHazard.lockedToLive && (
                <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold bg-pine/15 text-pine border border-pine/50 w-fit">
                  <Lock className="w-3 h-3" strokeWidth={2} />
                  Locked to live location
                </div>
              )}

              <div className="pt-2 border-t border-gray-800">
                <CommentThread
                  comments={openHazard.comments}
                  onAdd={addHazardComment}
                  onAuthorClick={setProfileUser}
                  placeholder="e.g. Security arrived at 21:15"
                />
              </div>
            </div>
          </div>
        )}

        {/* Public Profile Modal (from hazard drawer) */}
        {profileUser && openHazard && (
          <PublicProfileModal
            username={profileUser}
            onClose={() => setProfileUser(null)}
            onMessageUser={openChat}
          />
        )}

        {/* Footer with legal links */}
        <footer className="absolute bottom-0 left-0 right-0 z-[500] bg-midnight border-t border-gray-900 px-4 py-2 flex items-center justify-center gap-4">
          <button
            onClick={() => setLegalModal('terms')}
            className="text-sage text-[10px] font-bold hover:text-pine transition-colors"
          >
            Terms of Service
          </button>
          <span className="text-gray-700 text-[10px]">|</span>
          <button
            onClick={() => setLegalModal('privacy')}
            className="text-sage text-[10px] font-bold hover:text-pine transition-colors"
          >
            Privacy Policy
          </button>
        </footer>

        {/* Global Bottom Nav */}
        <BottomNav active={activeView} onChange={setActiveView} />

        {/* Subscription modal */}
        <SubscriptionModal
          open={isSubscriptionOpen}
          onClose={() => setIsSubscriptionOpen(false)}
        />

        {/* Admin flagged content queue */}
        <AdminQueue open={adminQueueOpen} onClose={() => setAdminQueueOpen(false)} />

        {/* Legal modals */}
        <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />

        {/* OTP verification modal */}
        {showOtp && profile && (
          <OtpModal
            userId={profile.id}
            email={profile.email}
            onClose={() => setShowOtp(false)}
            onVerified={() => {
              setShowOtp(false);
              refreshProfile();
            }}
          />
        )}

        {/* Chat inbox */}
        {chatInboxOpen && profile && (
          <ChatInbox
            myId={profile.id}
            onOpenConversation={(peerId, peerUsername) => {
              setChatInboxOpen(false);
              setActiveChat({ peerId, peerUsername });
            }}
            onClose={() => setChatInboxOpen(false)}
          />
        )}

        {/* Active chat room */}
        {activeChat && profile && (
          <ChatRoom
            myId={profile.id}
            peerId={activeChat.peerId}
            peerUsername={activeChat.peerUsername}
            onClose={() => setActiveChat(null)}
          />
        )}
      </div>
    </div>
  );
}
