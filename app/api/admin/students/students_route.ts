import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { loadStudents } from '@/lib/homework'

function isAuthed() {
  const cookieStore = cookies()
  return cookieStore.get('admin_token')?.value === process.env.ADMIN_SECRET
}

export async function GET() {
  if (!isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const students = loadStudents()
  // 목록용: assignments 제외하고 요약만
  const summary = students.map(s => ({
    id: s.id,
    name: s.name,
    class: s.class,
    student_phone: s.student_phone,
    parent_phone: s.parent_phone,
    total_hw: s.total_hw,
    submitted_count: s.submitted_count,
    submission_rate: s.submission_rate,
    a_count: s.a_count,
    b_count: s.b_count,
    c_count: s.c_count,
  }))
  return NextResponse.json(summary)
}
