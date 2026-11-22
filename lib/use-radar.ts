"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { trackForegroundLocation } from './radar-privacy';

export type RadarFriend = {
  user_id: string;
  username: string | null;
  accepted: boolean;
  incoming: boolean;
};
export type RadarShare = {
  user_id: string;
  username: string | null;
  lat: number;
  lng: number;
  status_text: string;
  company_welcome: boolean;
  updated_at: string;
  expires_at: string;
  audience?: string;
  selected_ids?: string[];
};
type Snapshot = {
  friends: RadarFriend[];
  shares: RadarShare[];
  own: RadarShare | null;
  blocked: { user_id: string; username: string | null }[];
};
const empty: Snapshot = { friends: [], shares: [], own: null, blocked: [] };
export function useRadar(userId?: string) {
  const [data, setData] = useState<Snapshot>(empty),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(Date.now());
  const [trackingError, setTrackingError] = useState("");
  const generation = useRef(0),
    lastWrite = useRef(0),
    writing = useRef(false),
    stopping = useRef(false);
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    if (!userId) {
      setData(empty);
      setLoading(false);
      return;
    }
    if (document.hidden) return;
    const { data: result, error: e } = await supabase.rpc("radar_snapshot");
    if (version !== generation.current) return;
    if (e) {
      setData((previous) => ({ ...empty, own: previous.own }));
      setError("Radar connections could not load. Try again.");
    } else {
      setData(result as Snapshot);
      setError("");
    }
    setLoading(false);
  }, [userId]);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    setData(empty);
    setLoading(true);
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 15000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const visibility = () => {
      invalidate();
      if (document.hidden) setData(previous => ({ ...empty, own: previous.own }));
      else void refresh();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      invalidate();
      clearInterval(timer);
      clearInterval(clock);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [refresh, invalidate]);
  const run = useCallback(
    async (name: string, args?: Record<string, unknown>) => {
      setBusy(true);
      setError("");
      try {
        const { error: e } = await supabase.rpc(name, args);
        if (e) throw e;
        await refresh();
      } catch {
        throw new Error("Could not save. Check your connection and try again.");
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );
  const active =
    data.own &&
    data.own.user_id === userId &&
    Date.parse(data.own.expires_at) > now
      ? data.own
      : null;
  useEffect(() => {
    if (!active?.expires_at || !userId) return;
    if (!navigator.geolocation) {
      setTrackingError(
        "Location is unavailable. Your last position expires automatically.",
      );
      return;
    }
    let alive = true;
    setTrackingError("");
    const update = async (p: GeolocationPosition) => {
        if (
          !alive ||
          stopping.current ||
          writing.current ||
          Date.now() - lastWrite.current < 15000 ||
          document.hidden
        )
          return;
        writing.current = true;
        lastWrite.current = Date.now();
        try {
          const { error: e } = await supabase.rpc("radar_update_position", {
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
          });
          if (alive)
            setTrackingError(
              e
                ? "Position could not update. Your pin will disappear if it becomes stale."
                : "",
            );
        } finally {
          writing.current = false;
        }
      };
    const unavailable = () => {
        if (alive)
          setTrackingError(
            "Location access interrupted. Your pin hides after five minutes without an update.",
          );
      };
    const cleanup = trackForegroundLocation(navigator.geolocation, document, update, unavailable);
    return () => {
      alive = false;
      cleanup();
    };
  }, [active?.expires_at, userId]);
  const stop = async () => {
    stopping.current = true;
    try {
      await run("radar_stop_share");
      setData((d) => ({ ...d, own: null }));
    } finally {
      stopping.current = false;
    }
  };
  return {
    data: {
      ...data,
      own: active,
      shares: data.shares.filter(
        (x) =>
          Date.parse(x.expires_at) > now &&
          now - Date.parse(x.updated_at) < 300000,
      ),
    },
    error,
    loading,
    busy,
    trackingError,
    now,
    refresh,
    run,
    stop,
  };
}
export type RadarState = ReturnType<typeof useRadar>;
export function escapeRadarText(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
