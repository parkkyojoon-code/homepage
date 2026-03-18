import { NextResponse } from 'next/server'
import { clearMySession } from '@/lib/my-auth'

export async function POST() {
  await clearMySession()
  return NextResponse.json({ ok: true })
}
