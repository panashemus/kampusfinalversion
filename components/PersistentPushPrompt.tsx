'use client';

import { useState, useEffect } from 'react';
import { Bell, X, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function PersistentPushPrompt({ userId }: { userId: string }) {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 1. Check if notifications are supported
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    // 2. If they already granted or denied, do not show the prompt
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      return;
    }

    // 3. Check if they temporarily dismissed it this session
    const dismissedThisSession = sessionStorage.getItem('push_prompt_dismissed');
    if (dismissedThisSession) return;

    // 4. Delay the popup slightly so it doesn't jump-scare them before the feed loads
    const timer = setTimeout(() => {
      setShow(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    // Hide it for now, but it WILL come back next time they open the app
    sessionStorage.setItem('push_prompt_dismissed', 'true');
    setShow(false);
  };

  const handleEnablePush = async () => {
    setLoading(true);
    try {
      // This triggers the browser's native "Allow Notifications" popup
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        });

        // Save it to your database so the blasts actually reach them
        await supabase.from('push_subscriptions').upsert({
          user_id: userId,
          subscription: JSON.stringify(subscription),
          endpoint: subscription.endpoint,
        });

        setShow(false); // Success! Hide forever.
      } else {
        handleDismiss(); // They clicked block or closed the native prompt
      }
    } catch (error) {
      console.error('Error enabling push:', error);
      handleDismiss();
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[9999] bg-[#111827] border border-pine/30 rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5">
      <button 
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-sage hover:text-white transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-pine/15 border border-pine/30 flex items-center justify-center text-pine shrink-0 mt-1">
          <Bell className="w-6 h-6 animate-pulse" />
        </div>
        
        <div className="flex flex-col gap-2 pr-4">
          <div>
            <h3 className="text-white font-bold text-sm">Don't miss the campus tea 🚨</h3>
            <p className="text-sage text-xs leading-relaxed mt-1">
              Turn on notifications to know instantly when a wild confession or blast drops on the timeline.
            </p>
          </div>

          <button
            onClick={handleEnablePush}
            disabled={loading}
            className="w-full mt-2 h-10 rounded-lg bg-pine text-black font-bold text-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            {loading ? 'Securing connection...' : 'Turn On Alerts'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
