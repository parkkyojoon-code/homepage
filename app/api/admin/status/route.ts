import { NextResponse } from 'next/server'
import { isAdminAuthed, homeworkApiUrl, adminToken } from '@/lib/admin-auth'

export async function GET() {
  if (!await isAdminAuthed()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const res = await fetch(homeworkApiUrl('/api/admin/status'), {
      headers: { 'X-Admin-Token': adminToken() },
      cache: 'no-store',
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
