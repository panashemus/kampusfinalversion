'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export default function GlobalNotificationListener() {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);

  // 1. Get the logged-in user on mount
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    fetchUser();

    // Listen for logins/logouts
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // 2. Listen to the Notifications table
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('global_notifications')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications', 
          filter: `user_id=eq.${userId}` 
        },
        (payload) => {
          const newNotif = payload.new;

          // Trigger the In-App Toast
          toast({
            title: newNotif.title,
            description: newNotif.message,
          });

          // Trigger the OS/Desktop Notification
          if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'granted') {
              new Notification(newNotif.title, {
                body: newNotif.message,
                // You can add an icon here later if you want: icon: '/icon.png'
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, toast]);

  return null; // This is an invisible component, it renders nothing!
}
