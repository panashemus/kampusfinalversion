import { NextResponse } from 'next/server';

// Finance is paused. Never send a claim that money is secured based on a client request.
export async function POST() {
  return NextResponse.json({ error: 'Kampus payment and escrow services are paused.' }, { status: 410 });
}
