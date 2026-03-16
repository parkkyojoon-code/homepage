import { NextRequest, NextResponse } from 'next/server'
import { lookupByPhone } from '@/lib/homework'

export async function POST(req: NextRequest) {
  const { phone } = await req.json()
  if (!phone || String(phone).replace(/\D/g, '').length < 9) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const matches = lookupByPhone(String(phone))
  if (matches.length === 0) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json(matches)
}
