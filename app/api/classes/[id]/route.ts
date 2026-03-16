import { NextRequest, NextResponse } from 'next/server'
import { getClassById } from '@/lib/classes'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cls = getClassById(id)
  if (!cls || !cls.visible) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json(cls)
}
