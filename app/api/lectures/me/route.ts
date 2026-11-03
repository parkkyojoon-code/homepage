import { NextResponse } from 'next/server'
import { currentUser } from '@/lib/lectures/auth'
import { failure } from '@/lib/lectures/http'
export const runtime = 'nodejs'
export async function GET() {
  try { const {id,username,name,phone}=await currentUser(); return NextResponse.json({id,username,name,phone}, { headers: { 'Cache-Control': 'no-store' } }) }
  catch (error) { return failure(error) }
}
