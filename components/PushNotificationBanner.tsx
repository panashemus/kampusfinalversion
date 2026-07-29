'use client';

import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function PushNotificationBanner({ userId }: { userId: string }) {
  const [visible, setVisible] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    setPermission(Notification.permission);
    const dismissed = localStorage.getItem('push_banner_dismissed');
    if (Notification.permission === 'default' && !dismissed) {
      setVisible(true);
    }
  }, []);

  const enable = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      registerServiceWorker(userId);
      new Notification('Kampus Alerts Enabled', {
        body: 'You will now receive campus safety alerts and post replies.',
      });
    }
    setVisible(false);
  };

  const dismiss = () => {
    localStorage.setItem('push_banner_dismissed', '1');
    setVisible(false);
  };

  if (!visible || permission !== 'default') return null;

  return (
    <div className="bg-pine/10 border border-pine/30 rounded-xl p-3 flex items-start gap-3 mb-3">
      <div className="w-9 h-9 rounded-full bg-pine/15 border border-pine/40 flex items-center justify-center shrink-0">
        <Bell className="w-4 h-4 text-pine" strokeWidth={2} />
      </div>
      <div className="flex-1 flex flex-col gap-2">
        <p className="text-white text-xs font-bold leading-snug">
          Enable Campus &amp; Emergency Alerts
        </p>
        <p className="text-sage text-[10px] leading-snug">
          Get instant alerts for nearby safety reports and replies to your posts.
        </p>
        <div className="flex gap-2">
          <button
            onClick={enable}
            className="rounded-lg bg-pine text-black text-xs font-bold px-3 py-1.5 active:scale-95 transition-transform"
          >
            Enable
          </button>
          <button
            onClick={dismiss}
            className="rounded-lg bg-surface border border-gray-800 text-sage text-xs font-bold px-3 py-1.5 active:scale-95 transition-transform"
          >
            Not now
          </button>
        </div>
      </div>
      <button onClick={dismiss} aria-label="Dismiss" className="text-sage shrink-0">
        <X className="w-4 h-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}

async function registerServiceWorker(userId: string) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch {
    // Service worker registration failed; notifications still work in-app.
  }
}
