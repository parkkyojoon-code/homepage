import { NextRequest, NextResponse } from 'next/server'
import { getMyStudent } from '@/lib/my-auth'
import { loadStudents, saveStudents } from '@/lib/homework'

// GET — 내 정보 조회 (비밀번호 제외)
export async function GET() {
  const student = await getMyStudent()
  if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { password: _pw, assignments: _as, ...profile } = student
  return NextResponse.json(profile)
}

// PATCH — 전화번호·배송지 수정
// body: { student_phone?, parent_phone?, address?, address_detail? }
export async function PATCH(req: NextRequest) {
  const student = await getMyStudent()
  if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = ['student_phone', 'parent_phone', 'address', 'address_detail'] as const

  const students = loadStudents()
  const idx = students.findIndex(s => s.id === student.id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  for (const key of allowed) {
    if (key in body) {
      // @ts-expect-error dynamic key
      students[idx][key] = body[key] ?? ''
    }
  }

  saveStudents(students)

  const { password: _pw, assignments: _as, ...profile } = students[idx]
  return NextResponse.json(profile)
}
