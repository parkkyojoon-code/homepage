import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { loadStudents, saveStudents, recalcStats } from '@/lib/homework'
import type { Assignment } from '@/lib/homework'

function isAuthed() {
  const cookieStore = cookies()
  return cookieStore.get('admin_session')?.value === process.env.ADMIN_SECRET
}

// GET /api/admin/students/[id] — 학생 전체 상세
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const students = loadStudents()
  const student = students.find(s => s.id === params.id)
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(student)
}

// PATCH /api/admin/students/[id] — 학생 정보 또는 과제 수정/추가/삭제
// body 예시:
//   { field: 'name', value: '홍길동' }
//   { field: 'student_phone', value: '01012345678' }
//   { field: 'class', value: '파이널A' }
//   { field: 'assignment_update', index: 2, assignment: { ...Assignment } }
//   { field: 'assignment_add', assignment: { ...Assignment } }
//   { field: 'assignment_delete', index: 2 }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const students = loadStudents()
  const idx = students.findIndex(s => s.id === params.id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  let student = { ...students[idx] }

  const { field } = body

  if (field === 'name' || field === 'class' || field === 'student_phone' || field === 'parent_phone') {
    student = { ...student, [field]: body.value ?? null }

  } else if (field === 'assignment_update') {
    const { index, assignment } = body as { index: number; assignment: Assignment }
    if (index < 0 || index >= student.assignments.length) {
      return NextResponse.json({ error: 'Invalid index' }, { status: 400 })
    }
    const updated = [...student.assignments]
    updated[index] = {
      ...updated[index],
      ...assignment,
      // 타입 강제
      submitted: assignment.submitted === 'O' ? 'O' : 'X',
      completeness: typeof assignment.completeness === 'number' ? assignment.completeness : null,
    }
    student = { ...student, assignments: updated }

  } else if (field === 'assignment_add') {
    const { assignment } = body as { assignment: Assignment }
    student = {
      ...student,
      assignments: [
        ...student.assignments,
        {
          type: assignment.type ?? 'homework',
          date: assignment.date ?? '',
          name: assignment.name ?? '',
          submitted: assignment.submitted === 'O' ? 'O' : 'X',
          grade: assignment.grade ?? '-',
          completeness: typeof assignment.completeness === 'number' ? assignment.completeness : null,
        },
      ],
    }

  } else if (field === 'assignment_delete') {
    const { index } = body as { index: number }
    if (index < 0 || index >= student.assignments.length) {
      return NextResponse.json({ error: 'Invalid index' }, { status: 400 })
    }
    const updated = [...student.assignments]
    updated.splice(index, 1)
    student = { ...student, assignments: updated }

  } else {
    return NextResponse.json({ error: 'Unknown field' }, { status: 400 })
  }

  // 집계 재계산
  student = recalcStats(student)
  students[idx] = student
  saveStudents(students)

  return NextResponse.json(student)
}