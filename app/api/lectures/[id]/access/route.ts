import { NextResponse } from 'next/server'
import { z } from 'zod'
import { currentUser } from '@/lib/lectures/auth'
import { lectureDestination } from '@/lib/lectures/classroom'
import { failure } from '@/lib/lectures/http'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser()
    const id = z.string().uuid().parse((await context.params).id)
    const response = NextResponse.redirect(await lectureDestination(user.id, id), 303)
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('Referrer-Policy', 'no-referrer')
    response.headers.set('Vary', 'Cookie')
    return response
  } catch (error) {
    const response = failure(error); response.headers.set('Cache-Control', 'private, no-store'); return response
  }
}
