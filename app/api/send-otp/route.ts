import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Enforces Node.js runtime to fix module bundling issues with Next.js 13
export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();

    const data = await resend.emails.send({
      from: 'Kampus <onboarding@resend.dev>',
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
      `,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Resend Error:', error);
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
  }
}
