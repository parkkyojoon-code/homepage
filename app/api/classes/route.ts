import { NextResponse } from 'next/server'
import { loadClasses } from '@/lib/classes'

export async function GET() {
  const classes = loadClasses()
  // 공개 API: visible=true인 것만
  return NextResponse.json(classes.filter(c => c.visible))
}
