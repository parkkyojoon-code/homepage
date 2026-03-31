import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { loadSubmissions } from '@/lib/lectures'

// GET /api/admin/submissions?lectureId=...&studentId=...
export async function GET(req: Request) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const lectureId = searchParams.get('lectureId')
  const studentId = searchParams.get('studentId')
  let submissions = loadSubmissions()
  if (lectureId) submissions = submissions.filter(s => s.lectureId === lectureId)
  if (studentId) submissions = submissions.filter(s => s.studentId === studentId)
  return NextResponse.json(submissions)
}
