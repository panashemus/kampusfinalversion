'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Bell,
  Plus,
  Search,
  X,
  MapPin,
  Lock,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  Phone,
  Loader as Loader2,
  MessageCircle,
  ThumbsUp,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import type {
  View,
  Hazard,
  Comment,
  SosAlert,
  Profile,
  HazardRow,
  AppNotification,
} from '@/lib/types';
import {
  haversineMeters,
  locationLabel,
  timeAgo,
  classifyUniversity,
} from '@/lib/utils';
import WelcomeModal from '@/components/WelcomeModal';
import AuthScreen from '@/components/AuthScreen';
import KampusKritic from '@/components/KampusKritic';
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
import AdminDashboard from '@/components/AdminDashboard';

const RadarMap = dynamic(() => import('@/components/RadarMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-midnight flex items-center justify-center">
      <span className="text-sage text-xs font-bold">Loading radar...</span>
    </div>
  ),
});

const HEADER_TITLES: Record<Exclude<View, 'auth'>, string> = {
  kritic: 'Kampus Kritic',
  radar: 'Kampus Radar',
  hustle: 'Hustle Hub',
  community: 'Campus Feed',
  escrow: 'Escrow & Payments',
  profile: 'Student ID',
};

const VALID_VIEWS: Exclude<View, 'auth'>[] = [
  'kritic',
  'radar',
  'hustle',
  'community',
  'escrow',
  'profile',
];

const HAZARD_CATEGORIES = [
  'Suspicious Activity',
  'Poor Lighting',
  'General Safety',
];

function hasPremiumAccess(p: Profile | null): boolean {
  if (!p) return false;
  if (p.is_admin) return true;
  if (p.is_premium) return true;
  return !!p.subscribed_until && new Date(p.subscribed_until) > new Date();
}

const fireSystemNotification = (title: string, body: string) => {
  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    try {
      new Notification(title, {
        body,
        icon: '/images/ClipSnap_20260723201232.png',
      });
    } catch {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, {
            body,
            icon: '/images/ClipSnap_20260723201232.png',
          });
        });
      }
    }
  }
};

export default function Home() {
  const [activeView, setActiveView] = useState<View>('auth');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);
  const [hazardCategory, setHazardCategory] = useState(HAZARD_CATEGORIES[0]);
  const [geoStatus, setGeoStatus] = useState<
    'idle' | 'locating' | 'locked' | 'denied'
  >('idle');
  const [liveCoords, setLiveCoords] = useState<[number, number] | null>(null);
  const [openHazard, setOpenHazard] = useState<Hazard | null>(null);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const [profileUser, setProfileUser] = useState<string | null>(null);
  const [profileUserId, setProfileUserId] = useState<string>('');

  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatInboxOpen, setChatInboxOpen] = useState(false);
  const [adminQueueOpen, setAdminQueueOpen] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(
    null
  );
  const [activeChat, setActiveChat] = useState<{
    peerId: string;
    peerUsername: string;
  } | null>(null);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);

  const [sosNotifications, setSosNotifications] = useState<
    { id: string; text: string; time: string }[]
  >([]);
  const [dbNotifications, setDbNotifications] = useState<AppNotification[]>([]);

  const [sosGeoStatus, setSosGeoStatus] = useState<
    'idle' | 'locating' | 'broadcasting' | 'done' | 'denied'
  >('idle');
  const [activeSosAlerts, setActiveSosAlerts] = useState<SosAlert[]>([]);
  const [activeHelpCard, setActiveHelpCard] = useState<SosAlert | null>(null);

  const isAdminUser =
    profile?.is_admin || profile?.email === 'musungwa60@gmail.com';

  useEffect(() => {
    if (!profile?.id) return;

    const fetchNotifs = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (data) setDbNotifications(data as AppNotification[]);
    };
    fetchNotifs();

    const channel = supabase
      .channel(`user-notifs-${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const notif = payload.new as AppNotification;
          if (notif.user_id === profile.id) {
            setDbNotifications((prev) => [notif, ...prev]);
            const title =
              notif.type === 'message' ? 'New Message' : 'New Reply';
            toast({ title, description: notif.body });
            fireSystemNotification(title, notif.body);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const markNotificationsAsRead = async () => {
    if (!profile) return;
    const unreadIds = dbNotifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    setDbNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds);
  };

  useEffect(() => {
    if (activeView !== 'radar') return;
    const fetchAlerts = async () => {
      const twentyFourHoursAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      ).toISOString();
      const { data } = await supabase
        .from('sos_alerts')
        .select('*')
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false });
      if (data) setActiveSosAlerts(data as SosAlert[]);
    };
    fetchAlerts();

    const channel = supabase
      .channel('sos_alerts_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sos_alerts' },
        () => {
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeView]);

  useEffect(() => {
    const channel = supabase
      .channel('sos_alerts_push')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sos_alerts' },
        (payload) => {
          const alert = payload.new as SosAlert;
          if (userCoords) {
            const dist = haversineMeters(
              userCoords[0],
              userCoords[1],
              alert.lat,
              alert.lng
            );
            if (dist <= 1000) {
              const userName = alert.user_name ?? 'A student';
              const loc =
                alert.location_name ?? locationLabel(alert.lat, alert.lng);
              const text = `EMERGENCY: ${userName} triggered an assistance alert near ${loc}.`;
              toast({
                title: 'Emergency Alert',
                description: text,
                variant: 'destructive',
              });
              fireSystemNotification('Emergency Alert', text);
              setSosNotifications((prev) => [
                { id: alert.id, text, time: 'just now' },
                ...prev,
              ]);
            }
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userCoords]);

  useEffect(() => {
    if (activeView !== 'radar') return;
    const channel = supabase
      .channel('public:hazards:toast')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hazards' },
        (payload) => {
          const row = payload.new as HazardRow;
          if (row.user_id !== profile?.id) {
            toast({
              title: 'Peer Guard Alert',
              description: 'Active hazard pin dropped nearby.',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeView, profile?.id]);

  const addHazardComment = useCallback((comment: Comment) => {
    setOpenHazard((prev) =>
      prev ? { ...prev, comments: [...prev.comments, comment] } : prev
    );
  }, []);

  const createHazard = useCallback(
    async (coords: [number, number]) => {
      setIsReportModalOpen(false);
      setGeoStatus('idle');
      setLiveCoords(null);

      const { error } = await supabase.from('hazards').insert({
        user_id: profile?.id,
        lat: coords[0],
        lng: coords[1],
        title: `${hazardCategory} pin`,
        type: hazardCategory,
      });

      if (error) {
        toast({
          title: 'Connection Error',
          description: 'Failed to broadcast hazard to the campus radar.',
          variant: 'destructive',
        });
      } else {
        await supabase.from('feed_posts').insert({
          user_id: profile?.id,
          author_name: 'Kampus Radar',
          category: 'General',
          text: `A new ${hazardCategory} hazard was reported on campus. Check the radar map to stay safe.`,
          is_anonymous: false,
          is_blasted: true,
          impact_score: 50,
        });

        toast({
          title: 'Pin Dropped',
          description: 'Hazard broadcasted to campus radar.',
        });
      }
    },
    [hazardCategory, profile?.id]
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
        () => {
          const fallbackLat = userCoords ? userCoords[0] : -21.17;
          const fallbackLng = userCoords ? userCoords[1] : 27.5;
          const coords: [number, number] = [fallbackLat, fallbackLng];

          setLiveCoords(coords);
          setGeoStatus('locked');
          createHazard(coords);
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
      return;
    }
    createHazard(liveCoords);
  }, [geoStatus, liveCoords, createHazard, userCoords]);

  const handleBroadcastSos = useCallback(async () => {
    setSosGeoStatus('locating');

    const executeBroadcast = async (lat: number, lng: number) => {
      setSosGeoStatus('broadcasting');
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

      await supabase.from('feed_posts').insert({
        user_id: profile?.id ?? null,
        author_name: 'Kampus SOS',
        category: 'General',
        text: `${userName} triggered an emergency beacon near ${loc}. Open the radar map immediately.`,
        is_anonymous: false,
        is_blasted: true,
        impact_score: 100,
      });

      const alert = data as SosAlert;
      setActiveSosAlerts((prev) => [alert, ...prev]);
      setActiveHelpCard(alert);
      setSosGeoStatus('done');
      setIsSosModalOpen(false);
    };

    const fallbackLat = userCoords ? userCoords[0] : -21.17;
    const fallbackLng = userCoords ? userCoords[1] : 27.5;

    if (!('geolocation' in navigator)) {
      await executeBroadcast(fallbackLat, fallbackLng);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => executeBroadcast(pos.coords.latitude, pos.coords.longitude),
      () => {
        navigator.geolocation.getCurrentPosition(
          (pos) => executeBroadcast(pos.coords.latitude, pos.coords.longitude),
          async () => {
            await executeBroadcast(fallbackLat, fallbackLng);
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, [profile, userCoords]);

  const handleDismissHelpCard = useCallback(async () => {
    if (!activeHelpCard) return;
    await supabase
      .from('sos_alerts')
      .update({ active: false })
      .eq('id', activeHelpCard.id);

    setActiveSosAlerts((prev) =>
      prev.map((a) =>
        a.id === activeHelpCard.id ? { ...a, active: false } : a
      )
    );
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

      const school = classifyUniversity(session.user.email);
      const hydratedProfile: Profile = data
        ? {
            ...(data as Profile),
            university: (data as Profile).university || school.fullName,
          }
        : {
            id: session.user.id,
            email: session.user.email || '',
            username: session.user.email?.split('@')[0] || 'Student',
            avatar_url: null,
            university: school.fullName,
            verified: true,
            email_verified: true,
            is_admin: false,
            is_premium: false,
            subscribed_until: null,
            sentinel_points: 0,
            ewallet_number: '',
          };

      if (mounted) {
        setProfile(hydratedProfile);

        const initialHash = window.location.hash.replace('#', '') as Exclude<
          View,
          'auth'
        >;
        if (VALID_VIEWS.includes(initialHash)) {
          setActiveView(initialHash);
        } else {
          // Always push Kampus Kritic first when logging in
          setActiveView('kritic');
        }
      }
    })();
    return () => {
      mounted = false;
    };
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

  useEffect(() => {
    if (activeView !== 'auth') {
      const currentHash = window.location.hash.replace('#', '');
      if (currentHash !== activeView) {
        window.history.pushState(null, '', `#${activeView}`);
      }
    }
  }, [activeView]);

  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash.replace('#', '') as Exclude<
        View,
        'auth'
      >;
      if (VALID_VIEWS.includes(hash)) {
        setActiveView(hash);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (activeView === 'auth') {
    return (
      <AuthScreen
        onVerified={(p) => {
          setProfile(p);
          // Push Kampus Kritic into the user's face immediately on login
          setActiveView('kritic');
        }}
      />
    );
  }

  const showSearch = activeView === 'hustle' || activeView === 'community';
  const unreadCount =
    dbNotifications.filter((n) => !n.read).length + sosNotifications.length;
  const myName = profile
    ? profile.username
      ? `@${profile.username.replace(/^@/, '')}`
      : profile.email.split('@')[0]
    : 'student';

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-ink items-center">
      <div className="relative w-full max-w-[430px] h-[100dvh] flex flex-col overflow-hidden bg-midnight border-x border-gray-800">
        <WelcomeModal />

        {/* Original Forest Green & Yellow Top Banner */}
        <header className="sticky top-0 z-[1000] bg-midnight border-b border-gray-800 px-4 py-3.5 flex items-center justify-between shrink-0">
          <span className="text-white font-black text-lg tracking-tight">
            {HEADER_TITLES[activeView]}
          </span>
          <div className="flex items-center gap-2.5">
            {isAdminUser && (
              <button
                onClick={() => setShowAdmin(true)}
                className="bg-surface border border-pine/40 text-pine font-bold text-[11px] tracking-tight px-3 py-1 rounded-full active:scale-95 transition-transform"
              >
                Admin
              </button>
            )}

            {showSearch && (
              <button
                onClick={() => setSearchOpen((v) => !v)}
                aria-label="Search"
                className={`p-1.5 rounded-full transition-colors ${
                  searchOpen
                    ? 'text-pine bg-surface border border-pine/40'
                    : 'text-sage hover:text-white'
                }`}
              >
                <Search className="w-5 h-5" strokeWidth={1.75} />
              </button>
            )}
            <button
              onClick={() => setChatInboxOpen(true)}
              aria-label="Messages"
              className="relative p-1.5 text-sage hover:text-white transition-colors"
            >
              <MessageCircle className="w-5 h-5" strokeWidth={1.75} />
            </button>
            <button
              onClick={() => {
                setIsNotifOpen((v) => {
                  if (!v) markNotificationsAsRead();
                  return !v;
                });
              }}
              aria-label="Toggle notifications"
              className="relative p-1.5 text-sage hover:text-white transition-colors"
            >
              <Bell className="w-5 h-5" strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-pine text-black rounded-full flex items-center justify-center text-[9px] font-black">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Expandable Search Bar */}
        {showSearch && searchOpen && (
          <div className="px-4 py-2.5 bg-midnight border-b border-gray-800 shrink-0">
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeView === 'hustle'
                  ? 'Search gigs by title or seller...'
                  : 'Search posts by keyword...'
              }
              className="w-full h-10 rounded-xl bg-ink border border-gray-800 px-3.5 text-white placeholder:text-sage/60 text-xs outline-none focus:border-pine transition-colors"
            />
          </div>
        )}

        {/* Notifications Popover */}
        {isNotifOpen && (
          <div className="absolute top-16 left-0 right-0 z-[1500] px-4">
            <div className="bg-surface rounded-2xl border border-gray-800 shadow-2xl flex flex-col gap-3 p-4 animate-slide-down">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
                <span className="text-white font-black text-xs uppercase tracking-wider">
                  Notifications
                </span>
                <button
                  onClick={() => setIsNotifOpen(false)}
                  aria-label="Close"
                  className="text-sage hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>

              <div className="flex flex-col gap-2.5 max-h-[60vh] overflow-y-auto no-scrollbar">
                {sosNotifications.length === 0 &&
                dbNotifications.length === 0 ? (
                  <span className="text-sage text-xs py-4 text-center">
                    You&apos;re all caught up.
                  </span>
                ) : (
                  <>
                    {sosNotifications.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-start gap-3 p-3 bg-red-950/30 rounded-xl border border-red-500/30"
                      >
                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                          <ShieldAlert
                            className="w-4 h-4 text-red-400"
                            strokeWidth={1.75}
                          />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-white text-xs font-bold leading-snug">
                            {n.text}
                          </span>
                          <span className="text-red-300 text-[10px]">
                            {n.time}
                          </span>
                        </div>
                      </div>
                    ))}

                    {dbNotifications.map((n) => (
                      <div
                        key={n.id}
                        className={`flex items-start gap-3 p-2.5 rounded-xl transition-colors cursor-pointer ${
                          !n.read
                            ? 'bg-ink border border-pine/30'
                            : 'hover:bg-ink/60'
                        }`}
                        onClick={() => {
                          if (n.type === 'message') {
                            setChatInboxOpen(true);
                            setIsNotifOpen(false);
                          } else if (n.type === 'comment') {
                            setActiveView('community');
                            setIsNotifOpen(false);
                          }
                        }}
                      >
                        <div className="w-8 h-8 rounded-full bg-ink border border-gray-800 flex items-center justify-center shrink-0">
                          {n.type === 'message' ? (
                            <MessageCircle
                              className="w-4 h-4 text-pine"
                              strokeWidth={1.75}
                            />
                          ) : (
                            <MessageSquare
                              className="w-4 h-4 text-pine"
                              strokeWidth={1.75}
                            />
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-white text-xs font-bold leading-snug">
                            {n.title}
                          </span>
                          <span className="text-sage text-xs leading-snug">
                            {n.body}
                          </span>
                          <span className="text-sage/70 text-[10px]">
                            {timeAgo(n.created_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Viewport */}
        <main className="flex-1 relative flex flex-col overflow-y-auto overscroll-y-contain pb-28">
          {activeView === 'kritic' && (
            <KampusKritic
              profile={profile}
              onProfileUpdate={(updated) => setProfile(updated)}
              onOpenTerms={() => setLegalModal('terms')}
            />
          )}

          {activeView === 'radar' && (
            <div className="absolute inset-0">
              <RadarMap
                profile={profile}
                onOpenHazard={setOpenHazard}
                sosAlerts={activeSosAlerts}
                onLocate={(pos) => setUserCoords(pos)}
                onMessageUser={openChat}
              />

              {activeSosAlerts.filter((a) => a.active).length === 0 && (
                <div className="absolute top-4 left-4 right-4 z-[500] pointer-events-none">
                  <div className="bg-surface/95 backdrop-blur-md rounded-2xl border border-gray-800 p-3.5 flex items-center gap-3 shadow-lg">
                    <div className="w-9 h-9 rounded-xl bg-ink border border-pine/40 flex items-center justify-center shrink-0">
                      <ShieldCheck
                        className="w-4 h-4 text-pine"
                        strokeWidth={1.75}
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-white text-xs font-bold tracking-tight">
                        No active emergencies reported nearby
                      </span>
                      <span className="text-sage text-[11px]">
                        Campus radar is clear
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="absolute bottom-28 right-4 z-[1001] flex flex-col items-center gap-3">
                <button
                  onClick={() => {
                    setSosGeoStatus('idle');
                    setIsSosModalOpen(true);
                  }}
                  aria-label="Campus SOS — request help"
                  className="h-13 w-13 p-3.5 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg flex items-center justify-center active:scale-95 transition-all"
                >
                  <ShieldAlert className="w-5 h-5" strokeWidth={2} />
                </button>
                <button
                  onClick={() => setIsReportModalOpen(true)}
                  className="h-13 w-13 p-3.5 rounded-full bg-pine text-black flex items-center justify-center active:scale-95 transition-all shadow-lg"
                  aria-label="Drop new hazard pin"
                >
                  <Plus className="w-5 h-5" strokeWidth={2.5} />
                </button>
              </div>

              {activeHelpCard && (
                <div className="absolute bottom-48 left-4 right-4 z-[1001]">
                  <div className="bg-surface border border-red-500/40 rounded-2xl p-4 shadow-xl flex flex-col gap-3 animate-slide-up">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                        <span className="text-red-400 font-bold text-xs">
                          Active SOS Beacon
                        </span>
                      </div>
                      <button
                        onClick={handleDismissHelpCard}
                        className="text-sage hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" strokeWidth={1.75} />
                      </button>
                    </div>

                    <p className="text-white text-xs leading-relaxed">
                      Your SOS beacon is live. Verified students within{' '}
                      <span className="text-pine font-bold">1km</span> have been
                      alerted.
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href="tel:+26735523962"
                        className="flex items-center justify-center gap-1.5 h-9 rounded-xl bg-ink border border-gray-800 text-white text-xs font-bold active:scale-95 transition-transform"
                      >
                        <Phone
                          className="w-3.5 h-3.5 text-pine"
                          strokeWidth={1.75}
                        />
                        UB Protection
                      </a>
                      <a
                        href="tel:+26739530622"
                        className="flex items-center justify-center gap-1.5 h-9 rounded-xl bg-ink border border-gray-800 text-white text-xs font-bold active:scale-95 transition-transform"
                      >
                        <Phone
                          className="w-3.5 h-3.5 text-pine"
                          strokeWidth={1.75}
                        />
                        BAC Security
                      </a>
                    </div>

                    <button
                      onClick={handleDismissHelpCard}
                      className="w-full h-9 rounded-xl bg-ink border border-gray-800 text-red-300 text-xs font-bold active:scale-95 transition-transform"
                    >
                      I am Safe — Deactivate Beacon
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

          {activeView === 'community' && (
            <CommunityHub
              profile={profile}
              searchQuery={searchQuery}
              onMessageUser={openChat}
            />
          )}

          {activeView === 'escrow' && (
            <EscrowVault requireVerified={requirePremium} />
          )}

          {activeView === 'profile' && (
            <ProfileScreen
              profile={profile}
              onProfileUpdate={(updated) => setProfile(updated)}
              onDisconnect={handleSignOut}
              onOpenSubscription={() => setIsSubscriptionOpen(true)}
              onOpenAdminQueue={() => setAdminQueueOpen(true)}
            />
          )}
        </main>

        {/* Report Campus Hazard Modal */}
        {isReportModalOpen && (
          <div className="absolute inset-0 z-[2000] flex items-end">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setIsReportModalOpen(false)}
            />
            <div className="relative w-full bg-surface border-t border-gray-800 rounded-t-3xl p-6 pb-[max(64px,calc(64px+env(safe-area-inset-bottom)))] flex flex-col gap-5 animate-slide-up max-h-[85dvh] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between shrink-0">
                <span className="text-white font-black text-base">
                  Report Campus Hazard
                </span>
                <button
                  onClick={() => setIsReportModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-ink border border-gray-800 flex items-center justify-center text-sage hover:text-white"
                >
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                <span className="text-sage text-xs font-bold uppercase tracking-wider">
                  Hazard Type
                </span>
                <div className="flex flex-wrap gap-2">
                  {HAZARD_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setHazardCategory(cat)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                        hazardCategory === cat
                          ? 'bg-pine text-black'
                          : 'bg-ink border border-gray-800 text-sage'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${
                    geoStatus === 'locked'
                      ? 'bg-ink text-pine border border-pine/40'
                      : geoStatus === 'denied'
                      ? 'bg-red-950/60 text-red-300 border border-red-800/40'
                      : 'bg-ink text-sage border border-gray-800'
                  }`}
                >
                  <Lock className="w-3 h-3" strokeWidth={1.75} />
                  {geoStatus === 'locating'
                    ? 'Acquiring live GPS...'
                    : geoStatus === 'locked'
                    ? 'Locked to live location'
                    : geoStatus === 'denied'
                    ? 'GPS access denied'
                    : 'Locks to live GPS'}
                </div>
                {liveCoords && geoStatus === 'locked' && (
                  <span className="text-sage text-[11px] font-mono">
                    {liveCoords[0].toFixed(4)}, {liveCoords[1].toFixed(4)}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2.5 mt-1 shrink-0">
                <button
                  onClick={handleDropPin}
                  disabled={geoStatus === 'locating'}
                  className="w-full h-11 rounded-xl bg-pine text-black font-black text-sm active:scale-95 transition-all disabled:opacity-50"
                >
                  {geoStatus === 'locating'
                    ? 'Locking GPS...'
                    : 'Drop Alert Pin'}
                </button>
                <button
                  onClick={() => setIsReportModalOpen(false)}
                  className="w-full h-10 text-sage hover:text-white font-bold text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Emergency SOS Broadcast Modal */}
        {isSosModalOpen && (
          <div className="absolute inset-0 z-[2000] flex items-end">
            <div
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
              onClick={() => {
                if (sosGeoStatus !== 'broadcasting') setIsSosModalOpen(false);
              }}
            />
            <div className="relative w-full bg-surface border-t border-red-500/40 rounded-t-3xl p-6 pb-[max(64px,calc(64px+env(safe-area-inset-bottom)))] flex flex-col gap-5 animate-slide-up max-h-[85dvh] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                    <ShieldAlert
                      className="w-5 h-5 text-red-400"
                      strokeWidth={1.75}
                    />
                  </div>
                  <span className="text-white font-black text-base">
                    Emergency Broadcast
                  </span>
                </div>
                {sosGeoStatus !== 'broadcasting' && (
                  <button
                    onClick={() => setIsSosModalOpen(false)}
                    className="text-sage hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" strokeWidth={1.75} />
                  </button>
                )}
              </div>

              <p className="text-sage text-xs leading-relaxed shrink-0">
                This alerts verified students within{' '}
                <span className="text-white font-bold">1km</span> of your live
                coordinates and places an active SOS beacon on the radar.
              </p>

              <div className="flex flex-col gap-2 shrink-0">
                <span className="text-sage text-xs font-bold uppercase tracking-wider">
                  Campus Security Direct Lines
                </span>
                <div className="flex flex-col gap-2">
                  <a
                    href="tel:+26735523962"
                    className="w-full flex items-center justify-between px-4 h-11 rounded-xl bg-ink border border-gray-800 text-white text-xs font-bold active:scale-95 transition-transform"
                  >
                    <div className="flex items-center gap-2.5">
                      <Phone
                        className="w-4 h-4 text-pine"
                        strokeWidth={1.75}
                      />
                      <span>UB Protection</span>
                    </div>
                    <span className="text-pine font-mono">355 2396</span>
                  </a>
                  <a
                    href="tel:+26739530622"
                    className="w-full flex items-center justify-between px-4 h-11 rounded-xl bg-ink border border-gray-800 text-white text-xs font-bold active:scale-95 transition-transform"
                  >
                    <div className="flex items-center gap-2.5">
                      <Phone
                        className="w-4 h-4 text-pine"
                        strokeWidth={1.75}
                      />
                      <span>BAC Security</span>
                    </div>
                    <span className="text-pine font-mono">395 3062</span>
                  </a>
                </div>
              </div>

              <button
                onClick={handleBroadcastSos}
                disabled={
                  sosGeoStatus === 'locating' || sosGeoStatus === 'broadcasting'
                }
                className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2 shrink-0"
              >
                {(sosGeoStatus === 'locating' ||
                  sosGeoStatus === 'broadcasting') && (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                )}
                {sosGeoStatus === 'locating' && 'Acquiring GPS...'}
                {sosGeoStatus === 'broadcasting' && 'Broadcasting...'}
                {(sosGeoStatus === 'idle' || sosGeoStatus === 'denied') && (
                  <>
                    <ShieldAlert className="w-4 h-4" strokeWidth={2} />
                    <span>Broadcast SOS Alert</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Open Hazard Detail Sheet */}
        {openHazard && (
          <div className="absolute inset-0 z-[2000] flex items-end">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setOpenHazard(null)}
            />
            <div className="relative w-full bg-surface border-t border-gray-800 rounded-t-3xl p-6 pb-[max(64px,calc(64px+env(safe-area-inset-bottom)))] flex flex-col gap-4 animate-slide-up max-h-[85dvh] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between shrink-0">
                <div className="flex flex-col gap-0.5">
                  <span className="text-white font-black text-base">
                    {openHazard.category}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <MapPin
                      className="w-3.5 h-3.5 text-pine"
                      strokeWidth={1.75}
                    />
                    <span className="text-sage text-xs">
                      {openHazard.label}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setOpenHazard(null)}
                  className="w-8 h-8 rounded-full bg-ink border border-gray-800 flex items-center justify-center text-sage hover:text-white"
                >
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>

              <div className="flex items-center justify-between shrink-0">
                <span className="text-sage text-xs">
                  Reported {openHazard.time}
                </span>
                {openHazard.lockedToLive && (
                  <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold bg-ink text-pine border border-pine/40">
                    <Lock className="w-3 h-3" strokeWidth={1.75} />
                    Live GPS Verified
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between bg-ink p-3.5 rounded-2xl border border-gray-800 shrink-0">
                <div className="flex flex-col">
                  <span className="text-white text-xs font-bold">
                    Was this pin helpful?
                  </span>
                  <span className="text-sage text-[11px]">
                    Confirm accuracy for other students
                  </span>
                </div>
                <button
                  onClick={async () => {
                    if (!profile || !openHazard) return;
                    const newUpvotes = (openHazard.upvotes || 0) + 1;
                    setOpenHazard({ ...openHazard, upvotes: newUpvotes });

                    const { error } = await supabase
                      .from('hazard_votes')
                      .insert({
                        hazard_id: openHazard.id,
                        user_id: profile.id,
                      });

                    if (error) {
                      setOpenHazard({
                        ...openHazard,
                        upvotes: openHazard.upvotes,
                      });
                      toast({
                        title: 'Already Voted',
                        description: 'You already marked this pin as helpful.',
                        variant: 'destructive',
                      });
                      return;
                    }

                    await supabase
                      .from('hazards')
                      .update({ upvotes: newUpvotes })
                      .eq('id', openHazard.id);

                    toast({
                      title: 'Marked Helpful',
                      description: 'Thanks for keeping campus informed.',
                    });
                  }}
                  className="flex items-center gap-1.5 bg-pine text-black px-3.5 py-2 rounded-xl text-xs font-black active:scale-95 transition-all"
                >
                  <ThumbsUp className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>Helpful ({openHazard.upvotes || 0})</span>
                </button>
              </div>

              <div className="pt-2 border-t border-gray-800 shrink-0">
                <CommentThread
                  comments={openHazard.comments}
                  onAdd={addHazardComment}
                  currentUserId={profile?.id}
                  isAnonymousPost={false}
                  myName={myName}
                  onAuthorClick={(username, id) => {
                    setProfileUser(username);
                    setProfileUserId(id || '');
                  }}
                  placeholder="e.g. Security arrived at 21:15"
                />
              </div>
            </div>
          </div>
        )}

        {profileUser && openHazard && (
          <PublicProfileModal
            userId={profileUserId}
            username={profileUser}
            onClose={() => {
              setProfileUser(null);
              setProfileUserId('');
            }}
            onMessageUser={openChat}
          />
        )}

        {/* Legal Footer Bar */}
        <footer className="absolute bottom-[max(64px,calc(64px+env(safe-area-inset-bottom)))] left-0 right-0 z-[500] bg-midnight/95 border-t border-gray-800 px-4 py-1.5 flex items-center justify-center gap-4">
          <button
            onClick={() => setLegalModal('terms')}
            className="text-sage text-[10px] font-bold hover:text-pine transition-colors"
          >
            Terms of Service
          </button>
          <span className="text-gray-700 text-[10px]">·</span>
          <button
            onClick={() => setLegalModal('privacy')}
            className="text-sage text-[10px] font-bold hover:text-pine transition-colors"
          >
            Privacy Policy
          </button>
        </footer>

        <BottomNav active={activeView} onChange={setActiveView} />

        <SubscriptionModal
          open={isSubscriptionOpen}
          onClose={() => setIsSubscriptionOpen(false)}
        />
        <AdminQueue
          open={adminQueueOpen}
          onClose={() => setAdminQueueOpen(false)}
        />
        <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />

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

        {activeChat && profile && (
          <ChatRoom
            myId={profile.id}
            peerId={activeChat.peerId}
            peerUsername={activeChat.peerUsername}
            onClose={() => setActiveChat(null)}
          />
        )}

        {showAdmin && (
          <AdminDashboard
            onClose={() => setShowAdmin(false)}
            adminProfile={profile}
          />
        )}
      </div>
    </div>
  );
}
