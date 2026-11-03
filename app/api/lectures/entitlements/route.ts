import { NextResponse } from 'next/server'
import { currentUser } from '@/lib/lectures/auth'
import { classroom } from '@/lib/lectures/classroom'
import { failure } from '@/lib/lectures/http'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    const user = await currentUser()
    return NextResponse.json(await classroom(user.id), { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
  } catch (error) {
    const response = failure(error); response.headers.set('Cache-Control', 'private, no-store'); return response
  }
}
