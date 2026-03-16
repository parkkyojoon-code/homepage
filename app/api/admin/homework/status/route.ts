import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { loadStudents, loadMeta } from '@/lib/homework'

export async function GET() {
  if (!await isAdminAuthed()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const meta     = loadMeta()
  const students = loadStudents()

  return NextResponse.json({
    count:       students.length,
    filename:    meta?.filename ?? null,
    uploaded_at: meta?.uploaded_at ?? null,
  })
}
