import type { RadarShare } from './use-radar';

export type RadarFilter = 'all' | 'welcome';
export function filterRadarShares(shares: RadarShare[], filter: RadarFilter) {
  return filter === 'welcome' ? shares.filter(s => s.company_welcome) : shares;
}
export const RADAR_JOIN_DRAFT = 'Hey — is there still room to join you?';

/** Stop the actual sensor watcher while hidden, and reject late callbacks. */
export function trackForegroundLocation(
  geo: Geolocation,
  page: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>,
  onPosition: PositionCallback,
  onError: PositionErrorCallback,
  timers = {
    setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
    clearInterval: (id: ReturnType<typeof setInterval>) => clearInterval(id),
  },
) {
  let watch: number | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let epoch = 0;
  let disposed = false;
  const stop = () => {
    epoch++;
    if (watch !== undefined) geo.clearWatch(watch);
    if (heartbeat !== undefined) timers.clearInterval(heartbeat);
    watch = undefined;
    heartbeat = undefined;
  };
  const sync = () => {
    stop();
    if (disposed || page.hidden) return;
    const current = epoch;
    const valid = () => !disposed && !page.hidden && current === epoch;
    const success: PositionCallback = p => { if (valid()) onPosition(p); };
    const failure: PositionErrorCallback = e => { if (valid()) onError(e); };
    const options = { enableHighAccuracy: false, maximumAge: 10000, timeout: 15000 };
    watch = geo.watchPosition(success, failure, options);
    heartbeat = timers.setInterval(() => {
      if (valid()) geo.getCurrentPosition(success, failure, options);
    }, 30000);
  };
  page.addEventListener('visibilitychange', sync);
  sync();
  return () => {
    disposed = true;
    page.removeEventListener('visibilitychange', sync);
    stop();
  };
}
