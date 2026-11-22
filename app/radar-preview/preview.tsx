"use client";
import dynamic from "next/dynamic";
import { useState } from 'react';
import ChatRoom from '@/components/ChatRoom';
import { RADAR_JOIN_DRAFT } from '@/lib/radar-privacy';
import type { Profile } from "@/lib/types";
const RadarMap = dynamic(() => import("@/components/RadarMap"), { ssr: false });
const profile: Profile = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "preview@example.invalid",
  username: "Preview",
  avatar_url: null,
  university: "University of Botswana",
  verified: true,
  email_verified: true,
  is_admin: false,
  is_premium: false,
  subscribed_until: null,
  sentinel_points: 0,
  ewallet_number: "",
};
export default function RadarPreview() {
  const [chat,setChat]=useState<{id:string;name:string}|null>(null);
  return (
    <main className="fixed inset-0 bg-midnight">
      <div className="absolute inset-x-0 top-0 z-[5000] bg-amber-200 p-1 text-center text-[10px] text-black">
        LOCAL DESIGN PREVIEW · fictional fixtures supplied by browser review
        only
      </div>
      <div className="absolute inset-x-0 bottom-0 top-6">
        <RadarMap
          profile={profile}
          onOpenHazard={() => {}}
          sosAlerts={[]}
          onLocate={() => {}}
          onMessageUser={() => alert("Preview: opens existing Kampus chat")}
          onJoinUser={(id,name)=>setChat({id,name})}
        />
      </div>
      {chat && <ChatRoom myId={profile.id} peerId={chat.id} peerUsername={chat.name} initialDraft={RADAR_JOIN_DRAFT} radarInvite onClose={()=>setChat(null)} />}
    </main>
  );
}
