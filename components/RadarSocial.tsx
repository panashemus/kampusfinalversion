"use client";
import { useEffect, useRef, useState } from "react";
import {
  Users,
  MapPin,
  Radio,
  Pause,
  MessageCircle,
  Shield,
  Clock,
  UserPlus,
  ArrowUpRight,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import type { RadarShare, RadarState } from "@/lib/use-radar";
import { supabase } from "@/lib/supabase";
import { filterRadarShares, type RadarFilter } from '@/lib/radar-privacy';

type Props = {
  radar: RadarState;
  selected: RadarShare | null;
  onSelect: (s: RadarShare | null) => void;
  onMessage?: (id: string, name: string) => void;
  onJoin?: (id: string, name: string) => void;
  filter: RadarFilter;
  onFilter: (filter: RadarFilter) => void;
  onFocus: (lat: number, lng: number) => void;
  places: { id: string; title: string; lat: number; lng: number }[];
  signedIn: boolean;
};
const button =
  "min-h-[44px] rounded-2xl px-4 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-pine disabled:opacity-40";
export default function RadarSocial({
  radar,
  selected,
  onSelect,
  onMessage,
  onJoin,
  filter: tab,
  onFilter: setTab,
  onFocus,
  places,
  signedIn,
}: Props) {
  const { data, busy, now } = radar;
  const [panel, setPanel] = useState<"share" | "friends" | "places" | null>(
      null,
    );
  const [status, setStatus] = useState(""),
    [welcome, setWelcome] = useState(false),
    [minutes, setMinutes] = useState(60),
    [audience, setAudience] = useState("friends"),
    [ids, setIds] = useState<string[]>([]);
  const [handle, setHandle] = useState(""),
    [found, setFound] = useState<{ user_id: string; username: string }[]>([]),
    [notice, setNotice] = useState(""),
    [locating, setLocating] = useState(false);
  const friends = data.friends.filter((f) => f.accepted);
  const peer = selected
    ? data.shares.find((x) => x.user_id === selected.user_id)
    : null;
  const act = async (fn: () => Promise<unknown>, success = "") => {
    setNotice("");
    try {
      await fn();
      setNotice(success);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Something went wrong.");
    }
  };
  const openShare = () => {
    setStatus(data.own?.status_text || "");
    setWelcome(data.own?.company_welcome || false);
    setAudience(data.own?.audience || "friends");
    setIds(data.own?.selected_ids || []);
    setNotice("");
    setPanel("share");
  };
  const shareAttempt = useRef(0);
  useEffect(() => () => { shareAttempt.current++; }, []);
  const start = async () => {
    if (locating || busy || document.hidden) return;
    const attempt = ++shareAttempt.current;
    setLocating(true);
    setNotice("");
    try {
      if (!navigator.geolocation)
        throw new Error("This browser cannot access location.");
      const p = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(
          resolve,
          () =>
            reject(
              new Error(
                "Allow location access in your browser, then try again.",
              ),
            ),
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 5000 },
        ),
      );
      if (attempt !== shareAttempt.current) return;
      if (document.hidden) throw new Error('Return to Radar and try sharing again.');
      await radar.run("radar_start_share", {
        latitude: p.coords.latitude,
        longitude: p.coords.longitude,
        minutes,
        audience_mode: audience,
        recipients: ids,
        status,
        welcome,
      });
      setPanel(null);
      onFocus(p.coords.latitude, p.coords.longitude);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Sharing could not start.");
    } finally {
      setLocating(false);
    }
  };
  const list = filterRadarShares(data.shares, tab);
  return (
    <>
      <div className="absolute inset-x-3 top-3 z-[1000] flex flex-col gap-3 pointer-events-none sm:inset-x-5">
        <div className="rounded-3xl border border-white/10 bg-[#101f18]/95 p-4 shadow-xl backdrop-blur-md pointer-events-auto">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[.23em] text-emerald-300">
                Your campus, connected
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white">
                Find your people.
              </h2>
            </div>
            <button
              type="button"
              className={`${button} bg-white/5 text-white flex gap-2 items-center`}
              onClick={() => {
                setNotice("");
                setPanel("friends");
              }}
            >
              <Users size={18} />
              <span className="hidden min-[360px]:inline">Friends</span>
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={!signedIn || busy}
              onClick={openShare}
              className={`${button} flex-1 bg-pine text-midnight flex items-center justify-center gap-2`}
            >
              <Radio size={16} />
              {data.own ? "Manage sharing" : "Share my location"}
            </button>
            <button
              type="button"
              onClick={() => {
                setNotice("");
                setPanel("places");
              }}
              className={`${button} bg-white/5 text-white flex items-center gap-1`}
            >
              <MapPin size={16} />
              Places
            </button>
          </div>
          <div className="mt-3 flex items-start gap-2 text-xs text-zinc-300">
            <Shield size={14} className="shrink-0 mt-0.5" />
            <span>
              {data.own
                ? `${data.own.audience === "selected" ? "Selected friends" : "Friends only"} · ends ${new Date(data.own.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : radar.loading
                  ? "Checking sharing status…"
                : radar.error
                  ? "Sharing status unavailable. Retry to confirm."
                  : "Sharing is off. Explore without broadcasting your location."}
            </span>
            {data.own && (
              <button
                disabled={busy}
                onClick={() => void act(radar.stop, "Sharing stopped.")}
                className="ml-auto underline text-pine min-h-8 px-1"
              >
                Stop
              </button>
            )}
          </div>
        </div>
        {(radar.error || radar.trackingError || notice) &&
          !panel &&
          !selected && (
            <div
              role="status"
              className="rounded-2xl bg-midnight p-3 text-xs text-amber-200 pointer-events-auto"
            >
              {notice || radar.error || radar.trackingError}
              {radar.error && (
                <button
                  onClick={() => void radar.refresh()}
                  className="underline ml-3 min-h-8"
                >
                  Retry
                </button>
              )}
            </div>
          )}
      </div>
      <div className="absolute bottom-5 inset-x-3 z-[1000] pointer-events-none sm:inset-x-5">
        <div className="rounded-3xl border border-white/10 bg-[#101f18]/95 p-4 shadow-xl backdrop-blur-md pointer-events-auto">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setTab("all")}
              aria-pressed={tab === "all"}
              className={`${button} py-2 ${tab === "all" ? "bg-white/10 text-white" : "text-zinc-400"}`}
            >
              Friends on map{" "}
              <span className="text-pine">{data.shares.length}</span>
            </button>
            <button
              onClick={() => setTab("welcome")}
              aria-pressed={tab === "welcome"}
              className={`${button} py-2 ${tab === "welcome" ? "bg-emerald-900 text-emerald-200" : "text-zinc-400"}`}
            >
              Join me
            </button>
          </div>
          {radar.loading ? (
            <p role="status" className="text-sm text-zinc-400">
              Finding your connections…
            </p>
          ) : list.length ? (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {list.map((p) => (
                <button
                  key={p.user_id}
                  onClick={() => {
                    onSelect(p);
                    onFocus(p.lat, p.lng);
                  }}
                  className="flex min-w-[160px] max-w-[230px] gap-3 rounded-2xl bg-white/5 p-3 text-left"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-900 text-emerald-200 ring-2 ring-emerald-400">
                    {(p.username || "?")[0].toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-white truncate">
                      {p.username || "Friend"}
                    </span>
                    <span className="block text-xs text-emerald-300 truncate">
                      {p.company_welcome
                        ? "Company welcome"
                        : p.status_text || "Sharing with you"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-zinc-400">
              {tab === "welcome"
                ? "No open invitations right now. Share a study session or a coffee break."
                : friends.length
                  ? "Your friends aren’t sharing right now. Check back later."
                  : "Add a friend, then share a little of your campus day."}
            </p>
          )}
        </div>
      </div>
      <Dialog
        open={!!panel || !!selected}
        onOpenChange={(open) => {
          if (!open) {
            shareAttempt.current++;
            setPanel(null);
            onSelect(null);
            setNotice("");
          }
        }}
      >
        <DialogContent
          overlayClassName="z-[3900]"
          className="z-[4000] max-h-[85dvh] w-[calc(100%-24px)] overflow-y-auto rounded-3xl border-white/10 bg-[#101f18] text-white sm:max-w-md"
        >
          <DialogTitle>
            {selected
              ? "A little closer"
              : panel === "share"
                ? "Share on your terms"
                : panel === "friends"
                  ? "Your Radar friends"
                  : "Around campus"}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {selected
              ? "Reach out before heading over."
              : panel === "share"
                ? "Only accepted friends you choose can see your approximate pin (about 100 m grid). Status notes may reveal your meeting place."
                : panel === "friends"
                  ? "Friend requests never share your location automatically."
                  : "Choose a campus or a place to explore."}
          </DialogDescription>
          {selected &&
            (peer ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-900 text-xl text-emerald-200">
                    {(peer.username || "?")[0].toUpperCase()}
                  </span>
                  <div>
                    <h3 className="font-semibold break-all">
                      {peer.username || "Friend"}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Updated{" "}
                      {Math.max(
                        0,
                        Math.floor((now - Date.parse(peer.updated_at)) / 60000),
                      )}{" "}
                      min ago
                    </p>
                  </div>
                </div>
                <p className="break-words text-lg">
                  {peer.status_text || "Out on campus"}
                </p>
                {peer.company_welcome && (
                  <p className="text-emerald-300 text-sm">
                    Company welcome · message to join
                  </p>
                )}
                <p className="text-xs text-zinc-400">
                  Approximate pin · sharing ends{" "}
                  {new Date(peer.expires_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <button
                  disabled={peer.company_welcome ? !onJoin && !onMessage : !onMessage}
                  className={`${button} bg-pine text-midnight w-full flex items-center justify-center gap-2`}
                  onClick={() => {
                    onSelect(null);
                    (peer.company_welcome ? onJoin || onMessage : onMessage)?.(peer.user_id, peer.username || "Friend");
                  }}
                >
                  <MessageCircle size={18} />
                  {peer.company_welcome
                    ? "Ask to join in chat"
                    : "Message friend"}
                </button>
                <div className="flex gap-2">
                  <button
                    disabled={busy}
                    className={`${button} bg-white/5 flex-1`}
                    onClick={() =>
                      void act(async () => {
                        await radar.run("radar_friend_action", {
                          peer: peer.user_id,
                          action: "remove",
                        });
                        onSelect(null);
                      })
                    }
                  >
                    Remove friend
                  </button>
                  <button
                    disabled={busy}
                    className={`${button} text-rose-300`}
                    onClick={() =>
                      void act(async () => {
                        await radar.run("radar_friend_action", {
                          peer: peer.user_id,
                          action: "block",
                        });
                        onSelect(null);
                      })
                    }
                  >
                    Block
                  </button>
                </div>
              </div>
            ) : (
              <p role="status" className="text-zinc-400">
                This location is no longer available.
              </p>
            ))}
          {panel === "share" && (
            <div className="space-y-4">
              <label className="block text-sm">
                What are you up to?
                <input
                  maxLength={80}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  placeholder="Library session until 5"
                  className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 p-3"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  "Studying at the library",
                  "Coffee break",
                  "Lunch on campus",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className="rounded-full border border-white/10 px-3 py-2 text-xs text-zinc-300"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-3 rounded-xl bg-emerald-950 p-3">
                <input
                  type="checkbox"
                  checked={welcome}
                  onChange={(e) => setWelcome(e.target.checked)}
                />
                <span className="text-sm">
                  Company welcome{" "}
                  <span className="block text-xs text-zinc-400">
                    Friends can message to join you.
                  </span>
                </span>
              </label>
              <fieldset>
                <legend className="mb-2 text-sm">Sharing duration</legend>
                <div className="flex gap-2">
                  {[30, 60, 180].map((m) => (
                    <button
                      key={m}
                      aria-pressed={minutes === m}
                      onClick={() => setMinutes(m)}
                      className={`${button} flex-1 ${minutes === m ? "bg-pine text-midnight" : "bg-white/5"}`}
                    >
                      {m === 30 ? "30 min" : m === 60 ? "1 hour" : "3 hours"}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="block text-sm">
                Who can see you?
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="mt-2 w-full rounded-xl bg-[#192e23] p-3"
                >
                  <option value="friends">
                    All accepted friends ({friends.length})
                  </option>
                  <option value="selected">Selected friends</option>
                </select>
              </label>
              {audience === "selected" && (
                <fieldset className="space-y-2">
                  <legend className="sr-only">Choose friends</legend>
                  {friends.map((f) => (
                    <label
                      key={f.user_id}
                      className="flex items-center gap-3 p-2"
                    >
                      <input
                        type="checkbox"
                        checked={ids.includes(f.user_id)}
                        onChange={(e) =>
                          setIds(
                            e.target.checked
                              ? [...ids, f.user_id]
                              : ids.filter((id) => id !== f.user_id),
                          )
                        }
                      />
                      {f.username || "Friend"}
                    </label>
                  ))}
                </fieldset>
              )}
              {!friends.length && (
                <p className="text-amber-200 text-sm">
                  Add a friend first. Nobody can see your location until you
                  choose to share.
                </p>
              )}
              <p className="text-xs text-zinc-400">
                Off by default. Updates only while Radar is open and visible. Pins hide after 5 minutes without
                an update. Sharing ends automatically.
              </p>
              <button
                disabled={
                  busy ||
                  locating ||
                  !friends.length ||
                  (audience === "selected" && !ids.length)
                }
                onClick={() => void start()}
                className={`${button} w-full bg-pine text-midnight flex justify-center items-center gap-2`}
              >
                {locating ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Radio size={16} />
                )}{" "}
                {data.own
                  ? "Update sharing & restart timer"
                  : "Share my location"}
              </button>
              {data.own && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      await radar.stop();
                      setPanel(null);
                    }, "Sharing stopped.")
                  }
                  className={`${button} w-full bg-white/5 flex justify-center items-center gap-2`}
                >
                  <Pause size={16} />
                  Stop sharing now
                </button>
              )}
            </div>
          )}
          {panel === "friends" && (
            <div className="space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(async () => {
                    setFound([]);
                    const { data: d, error } = await supabase.rpc(
                      "radar_find_friend",
                      { handle },
                    );
                    if (error)
                      throw new Error("Search unavailable. Try again.");
                    setFound(d || []);
                    if (!d?.length)
                      setNotice(
                        "No matching student. Check the exact username.",
                      );
                  });
                }}
                className="flex gap-2"
              >
                <label className="sr-only" htmlFor="radar-handle">
                  Exact username
                </label>
                <input
                  id="radar-handle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  minLength={3}
                  maxLength={60}
                  required
                  placeholder="Exact @username"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 p-3"
                />
                <button className={`${button} bg-white/10`}>Find</button>
              </form>
              {found.map((f) => (
                <div
                  key={f.user_id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="truncate">{f.username}</span>
                  <button
                    disabled={
                      busy || data.friends.some((x) => x.user_id === f.user_id)
                    }
                    onClick={() =>
                      void act(
                        () =>
                          radar.run("radar_friend_action", {
                            peer: f.user_id,
                            action: "request",
                          }),
                        "Friend request sent.",
                      )
                    }
                    className={`${button} bg-pine text-midnight`}
                  >
                    Add friend
                  </button>
                </div>
              ))}
              {!data.friends.length && (
                <div className="rounded-2xl bg-white/5 p-4">
                  <UserPlus className="text-pine mb-2" />
                  <p className="text-sm text-zinc-300">
                    Start with someone you know. Ask for their Kampus username.
                  </p>
                </div>
              )}
              {data.friends.map((f) => (
                <div key={f.user_id} className="rounded-2xl bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">
                      {f.username || "Student"}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {f.accepted
                        ? "Friends"
                        : f.incoming
                          ? "Wants to connect"
                          : "Request sent"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {!f.accepted && f.incoming && (
                      <button
                        disabled={busy}
                        className={`${button} bg-pine text-midnight`}
                        onClick={() =>
                          void act(() =>
                            radar.run("radar_friend_action", {
                              peer: f.user_id,
                              action: "accept",
                            }),
                          )
                        }
                      >
                        Accept
                      </button>
                    )}
                    <button
                      disabled={busy}
                      className={`${button} bg-white/5`}
                      onClick={() =>
                        void act(() =>
                          radar.run("radar_friend_action", {
                            peer: f.user_id,
                            action: "remove",
                          }),
                        )
                      }
                    >
                      {f.accepted
                        ? "Remove"
                        : f.incoming
                          ? "Decline"
                          : "Cancel request"}
                    </button>
                    <button
                      disabled={busy}
                      className={`${button} text-rose-300`}
                      onClick={() =>
                        void act(() =>
                          radar.run("radar_friend_action", {
                            peer: f.user_id,
                            action: "block",
                          }),
                        )
                      }
                    >
                      Block
                    </button>
                  </div>
                </div>
              ))}
              {data.blocked.length > 0 && (
                <h3 className="text-sm text-zinc-400">Blocked students</h3>
              )}
              {data.blocked.map((f) => (
                <div
                  key={f.user_id}
                  className="flex justify-between items-center gap-2"
                >
                  <span className="truncate">{f.username || "Student"}</span>
                  <button
                    disabled={busy}
                    className={`${button} bg-white/5`}
                    onClick={() =>
                      void act(() =>
                        radar.run("radar_friend_action", {
                          peer: f.user_id,
                          action: "unblock",
                        }),
                      )
                    }
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
          {panel === "places" && (
            <div className="space-y-2">
              {places.map((p) => (
                <button
                  key={p.id}
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-white/5 p-4 text-left"
                  onClick={() => {
                    onFocus(p.lat, p.lng);
                    setPanel(null);
                  }}
                >
                  <MapPin className="shrink-0 text-pine" size={18} />
                  <span className="flex-1">{p.title}</span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>
          )}
          {notice && (
            <p role="status" className="text-sm text-amber-200">
              {notice}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
