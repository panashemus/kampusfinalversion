import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { sellerEmail, buyerEmail, itemName, amount } = await req.json();

    const apiKey =
      process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Kampus Vault <verify@kampusbw.site>',
        to: sellerEmail,
        subject: `P ${amount} Locked in Kampus Escrow`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #15241C; border-radius: 16px; overflow: hidden; background-color: #0B1611; color: #ffffff;">
            <div style="background-color: #FFDE4D; padding: 24px; text-align: center;">
              <h2 style="color: #000000; margin: 0; font-weight: 900; letter-spacing: -0.5px;">KAMPUS ESCROW</h2>
            </div>
            <div style="padding: 32px;">
              <h3 style="margin-top: 0; font-size: 20px; color: #ffffff;">Funds Secured &amp; Pending Verification</h3>
              <p style="color: #8BA396; font-size: 15px; line-height: 1.6;">Hello,</p>
              <p style="color: #8BA396; font-size: 15px; line-height: 1.6;">
                <strong style="color: #ffffff;">${buyerEmail}</strong> has initiated a trade and deposited <strong style="color: #FFDE4D;">P ${amount}</strong> into the Kampus Vault for: <strong style="color: #ffffff;">${itemName}</strong>.
              </p>
              <p style="color: #8BA396; font-size: 15px; line-height: 1.6;">
                Once our team verifies the payment reference, we will confirm release so you can safely hand over the item in a public campus spot.
              </p>
              <p style="color: #8BA396; font-size: 14px; margin-top: 28px;">Stay safe,<br>The Kampus Team</p>
            </div>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      throw new Error('Failed to send email via Resend');
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
