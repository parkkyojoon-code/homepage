import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { loadStudents } from '@/lib/homework'

export async function GET() {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const students = loadStudents()
  // 목록용: assignments 제외하고 요약만
  const summary = students.map(s => ({
    id: s.id,
    name: s.name,
    class: s.class,
    student_phone: s.student_phone,
    parent_phone: s.parent_phone,
    password_plain: s.password_plain ?? '84431621',
    is_default_password: !s.password_plain || s.password_plain === '84431621',
    total_hw: s.total_hw,
    submitted_count: s.submitted_count,
    submission_rate: s.submission_rate,
    a_count: s.a_count,
    b_count: s.b_count,
    c_count: s.c_count,
  }))
  return NextResponse.json(summary)
}
