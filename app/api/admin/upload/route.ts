import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthed, homeworkApiUrl, adminToken } from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  if (!await isAdminAuthed()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()

    const res = await fetch(homeworkApiUrl('/api/admin/upload'), {
      method: 'POST',
      headers: { 'X-Admin-Token': adminToken() },
      body: formData,
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
