'use client';

import { useEffect, useState } from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function decodeVapidKey(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const decoded = atob(padded);
  return Uint8Array.from(decoded, character => character.charCodeAt(0));
}

export default function PushNotificationBanner({ userId }: { userId: string }) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [testStatus, setTestStatus] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);
    setDismissed(sessionStorage.getItem('kampus:push-dismissed') === '1');
    const inspect = async () => {
      try {
        const existing = await navigator.serviceWorker.getRegistration('/');
        const subscription = await existing?.pushManager.getSubscription();
        if (!subscription) return;
        const response = await fetch('/api/push/config', {cache:'no-store'});
        if (!response.ok) return;
        const config = await response.json() as {publicKey:string};
        const expected = decodeVapidKey(config.publicKey);
        const actual = subscription.options.applicationServerKey ? new Uint8Array(subscription.options.applicationServerKey) : null;
        if (!actual || expected.length !== actual.length || actual.some((v,i)=>v!==expected[i])) return;
        const { data, error: queryError } = await supabase.from('push_subscriptions')
          .select('id').eq('user_id', userId).eq('endpoint', subscription.endpoint).maybeSingle();
        if (alive && !queryError && data) setSubscribed(true);
      } catch { /* New users can still enable from the button. */ }
    };
    void inspect();
    return () => { alive = false; };
  }, [userId]);

  const enable = async () => {
    setBusy(true); setError(''); setTestStatus('');
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Web push is unavailable in this browser. On iPhone, install KAMPUS to your Home Screen first.');
      const configResponse = await fetch('/api/push/config', {cache:'no-store'});
      if (!configResponse.ok) throw new Error('KAMPUS push signing key is not ready. Please try again later.');
      const config = await configResponse.json() as {publicKey:string};
      const publicKey = config.publicKey;
      const access = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      setPermission(access);
      if (access !== 'granted') throw new Error('Allow notifications in your browser settings to receive campus alerts.');
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      const vapidBytes = decodeVapidKey(publicKey);
      if (vapidBytes.length !== 65) throw new Error('KAMPUS push server key is invalid.');
      if (subscription) {
        const existingKey = subscription.options.applicationServerKey;
        const bytes = existingKey ? new Uint8Array(existingKey) : null;
        if (!bytes || bytes.length !== vapidBytes.length || bytes.some((v, i) => v !== vapidBytes[i])) {
          const oldEndpoint = subscription.endpoint;
          await subscription.unsubscribe();
          await supabase.from('push_subscriptions').delete().eq('user_id',userId).eq('endpoint',oldEndpoint);
          subscription = null;
        }
      }
      if (!subscription) subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidBytes as BufferSource,
      });
      const keys = subscription.toJSON().keys;
      if (!keys?.p256dh || !keys?.auth) throw new Error('Browser did not provide encrypted push keys.');
      const { error: saveError } = await supabase.from('push_subscriptions').upsert({
        user_id: userId, endpoint: subscription.endpoint,
        keys_p256dh: keys.p256dh, keys_auth: keys.auth,
      }, { onConflict: 'endpoint,user_id' });
      if (saveError) throw saveError;
      setSubscribed(true); setDismissed(false);
    } catch (err) { setError(err instanceof Error ? err.message : 'Notifications could not be enabled.'); }
    finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true); setError(''); setTestStatus('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in again before testing notifications.');
      const response = await fetch('/api/push/test', { method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token } });
      const result = await response.json() as { sent?: number; error?: string };
      if (!response.ok || !result.sent) throw new Error(result.error || 'Push service did not accept the notification.');
      setTestStatus('Test push accepted by the browser notification service. Check your device notifications.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Push test failed.'); }
    finally { setBusy(false); }
  };

  if (permission === 'unsupported') return null;
  if (subscribed) return (
    <div className="rounded-xl border border-pine/30 bg-pine/10 px-4 py-3 my-2 text-sage text-xs">
      <div className="flex gap-2 items-center"><CheckCircle2 className="text-pine w-4 h-4"/><strong className="text-white">Campus notifications enabled</strong></div>
      <button type="button" onClick={test} disabled={busy} className="underline text-pine mt-2 min-h-9 disabled:opacity-60">{busy ? 'Sending…' : 'Send a test notification'}</button>
      {testStatus && <p role="status" className="mt-1">{testStatus}</p>}
      {error && <p role="alert" className="text-red-300 mt-1">{error}</p>}
    </div>
  );
  if (dismissed && !error) return null;
  return (
    <div className="rounded-xl border border-pine/30 bg-pine/10 p-3 my-2 flex items-start gap-3">
      <Bell className="h-5 w-5 text-pine shrink-0 mt-1"/>
      <div className="flex-1 text-xs space-y-2">
        <strong className="text-white">Get KAMPUS alerts</strong>
        <p className="text-sage">Enable browser notifications for campus messages and safety updates, even when KAMPUS isn’t open.</p>
        {permission === 'denied' && <p className="text-amber-300">Notifications are blocked. Allow them in your browser’s site settings, then return here.</p>}
        {error && <p role="alert" className="text-red-300">{error}</p>}
        <div className="flex gap-3 items-center flex-wrap">
          <button disabled={busy || permission === 'denied'} onClick={enable} className="rounded-lg bg-pine text-black px-3 py-2 font-bold disabled:opacity-50">{busy ? 'Setting up…' : permission === 'granted' ? 'Finish setting up alerts' : 'Enable notifications'}</button>
          <button onClick={() => {setDismissed(true);sessionStorage.setItem('kampus:push-dismissed','1');}} className="text-sage underline">Not now</button>
        </div>
      </div>
    </div>
  );
}