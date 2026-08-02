import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();
    
    const apiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: 'Kampus <verify@kampusbw.site>', // Updated to your verified domain!
        to: [email],
        subject: `${code} is your Kampus verification code`,
        html: `
          <div style="font-family: sans-serif; background: #000; color: #fff; padding: 24px; border-radius: 12px; max-width: 480px; margin: 0 auto; border: 1px solid #333;">
            <h2 style="color: #FACC15; margin-top: 0;">Kampus Verification</h2>
            <p style="font-size: 15px; color: #e4e4e7;">Use the verification code below to complete your registration:</p>
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 6px; color: #FACC15; background: #18181b; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0;">
              ${code}
            </div>
            <p style="color: #71717a; font-size: 13px; margin-bottom: 0;">If you didn't request this code, you can safely ignore this email.</p>
          </div>
        `
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Failed to send email');
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Email API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to send verification code' }, { status: 500 });
  }
}
