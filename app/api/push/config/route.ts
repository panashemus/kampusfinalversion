import { NextResponse } from 'next/server';
import { deriveVapidPublicKey } from '@/lib/webpush';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET() {
  try {
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!privateKey) return NextResponse.json({error:'Push key is not configured'}, {status:503,headers:{'Cache-Control':'no-store'}});
    return NextResponse.json({publicKey:deriveVapidPublicKey(privateKey)}, {headers:{'Cache-Control':'no-store'}});
  } catch {
    return NextResponse.json({error:'Push key configuration needs attention'}, {status:503,headers:{'Cache-Control':'no-store'}});
  }
}