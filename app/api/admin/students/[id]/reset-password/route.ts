import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { loadStudents, saveStudents, INITIAL_PASSWORD_HASH } from '@/lib/homework'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const students = loadStudents()
  const idx = students.findIndex(s => s.id === params.id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  students[idx].password = INITIAL_PASSWORD_HASH
  students[idx].password_plain = '84431621'
  saveStudents(students)

  return NextResponse.json({ ok: true })
}
