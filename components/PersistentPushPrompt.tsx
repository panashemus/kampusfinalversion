'use client';
import PushNotificationBanner from '@/components/PushNotificationBanner';
export default function PersistentPushPrompt({userId}:{userId:string}){
  return <div className="fixed bottom-20 inset-x-4 z-[9999] mx-auto max-w-lg"><PushNotificationBanner userId={userId}/></div>;
}