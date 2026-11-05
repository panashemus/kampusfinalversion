import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildWebPushRequest } from '@/lib/webpush';
export const runtime = 'nodejs';

const allowedPushHost = (host: string) =>
  host === 'fcm.googleapis.com' || host === 'fcm-xm.googleapis.com' ||
  host === 'updates.push.services.mozilla.com' || host === 'push.services.mozilla.com' ||
  host.endsWith('.push.apple.com') || host === 'web.push.apple.com' ||
  host.endsWith('.notify.windows.com') || host.endsWith('.wns.windows.com');

export async function POST(req: Request) {
  try {
    const apiUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    if (!apiUrl || !key || !publicKey || !privateKey || !subject) return NextResponse.json({ error: 'Push service is not configured' }, { status: 503 });
    const bearer = req.headers.get('authorization')?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
    if (!bearer) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    const admin = createClient(apiUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: userError } = await admin.auth.getUser(bearer);
    if (userError || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    const { data: latest } = await admin.from('notifications').select('id')
      .eq('user_id', user.id).eq('type', 'push_test')
      .gte('created_at', new Date(Date.now() - 120000).toISOString()).limit(1);
    if (latest?.length) return NextResponse.json({ error: 'Test notifications are limited to one every two minutes.' }, { status: 429 });
    const { data: devices, error: readError } = await admin.from('push_subscriptions')
      .select('id, endpoint, keys_p256dh, keys_auth').eq('user_id', user.id).limit(10);
    if (readError) throw readError;
    if (!devices?.length) return NextResponse.json({ error: 'No registered device. Enable notifications first.' }, { status: 404 });
    let sent = 0;
    for (const device of devices) {
      try {
        const destination = new URL(device.endpoint);
        if (!allowedPushHost(destination.hostname)) continue;
        const push = buildWebPushRequest(device, {
          title: 'KAMPUS notifications are working!',
          body: 'KAMPUS 2.0 has been refurbished. Come check out what\u2019s new!',
          url: '/', tag: 'kampus-push-self-test',
        }, { publicKey, privateKey, subject });
        const result = await fetch(push.url, { method: 'POST', headers: push.headers, body: new Uint8Array(push.body) });
        if (result.ok) sent++;
        else if (result.status === 404 || result.status === 410) await admin.from('push_subscriptions').delete().eq('id', device.id).eq('user_id', user.id);
      } catch (err) { console.error('Push delivery failed:', err instanceof Error ? err.message : 'Unknown error'); }
    }
    if (sent) await admin.from('notifications').insert({user_id:user.id, type:'push_test', title:'KAMPUS notification test', body:'Your device push test was accepted by the push service.'});
    return NextResponse.json(sent ? { sent } : { error:'The push service rejected this request. Check your browser permissions and try again.' }, { status: sent ? 200 : 502 });
  } catch (err) {
    console.error('Push test failed', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: 'Push test failed; try again later' }, { status: 500 });
  }
}