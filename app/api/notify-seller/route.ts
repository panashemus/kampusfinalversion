import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { sellerEmail, buyerEmail, itemName, amount } = await req.json();

    // THE FIX: Grabbing the exact API key that your OTP route uses
    const apiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Kampus Vault <verify@kampusbw.site>',
        to: sellerEmail,
        subject: `Action Required: P ${amount} Locked in Escrow 🔒`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #334155; border-radius: 16px; overflow: hidden; background-color: #020617; color: #f1f5f9;">
            
            <div style="background-color: #f97316; padding: 24px; text-align: center;">
              <h2 style="color: #000000; margin: 0; font-weight: 900; letter-spacing: -0.5px;">KAMPUS ESCROW</h2>
            </div>
            
            <div style="padding: 32px;">
              <h3 style="margin-top: 0; font-size: 20px; color: #ffffff;">Funds Secured & Pending Verification</h3>
              <p style="color: #94a3b8; font-size: 15px; line-height: 1.6;">Hello,</p>
              <p style="color: #94a3b8; font-size: 15px; line-height: 1.6;">
                <strong style="color: #ffffff;">${buyerEmail}</strong> has initiated a trade and deposited <strong style="color: #10b981;">P ${amount}</strong> into the Kampus Vault for: <strong style="color: #ffffff;">${itemName}</strong>.
              </p>
              <p style="color: #94a3b8; font-size: 15px; line-height: 1.6;">
                This email serves as a confirmation that the buyer has sent the funds and you are safe to hand over the product.
              </p>
              
              <div style="background-color: #450a0a; border: 1px solid #ef4444; padding: 16px; border-radius: 12px; margin: 32px 0; text-align: center;">
                <p style="color: #fca5a5; margin: 0; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                  stay safe - Panashe Musungwa,
                </p>
              </div>
              
              <p style="color: #94a3b8; font-size: 14px;">Stay safe,<br>The Kampus Team</p>
            </div>
            
          </div>
        `
      })
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error('[Escrow] Resend API Error:', errorData);
      throw new Error('Failed to send email via Resend');
    }

    console.log(`[Escrow] Notification email sent successfully to ${sellerEmail}`);
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('[Escrow] Error sending seller notification:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
