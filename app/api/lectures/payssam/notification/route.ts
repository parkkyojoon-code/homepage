import { NextResponse } from 'next/server'
export const runtime='nodejs'
// V1 receipt acknowledgement only. Public callback content never creates a payment or a grant.
// The authenticated worker independently reads the fixed bill ID and amount before approval.
export async function POST(){return NextResponse.json({code:'0000'},{headers:{'Cache-Control':'no-store'}})}
