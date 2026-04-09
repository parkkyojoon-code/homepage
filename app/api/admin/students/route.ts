import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { loadStudents, saveStudents, INITIAL_PASSWORD_HASH } from '@/lib/homework'
import { randomUUID } from 'crypto'

export async function GET() {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const students = loadStudents()
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
    enrolledAt: s.enrolledAt ?? null,
  }))
  return NextResponse.json(summary)
}

export async function POST(req: Request) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, student_phone, parent_phone, class: className, enrolledAt } = await req.json()

  if (!name?.trim()) return NextResponse.json({ error: '이름은 필수입니다' }, { status: 400 })
  if (!student_phone?.trim() && !parent_phone?.trim())
    return NextResponse.json({ error: '학생 또는 학부모 연락처 중 하나는 필수입니다' }, { status: 400 })

  // 중복 확인
  const students = loadStudents()
  const normalizePhone = (p: string) => p.replace(/\D/g, '')
  const sPhone = student_phone ? normalizePhone(student_phone) : null
  const pPhone = parent_phone  ? normalizePhone(parent_phone)  : null

  const duplicate = students.find(s =>
    (sPhone && s.student_phone && normalizePhone(s.student_phone) === sPhone) ||
    (pPhone && s.parent_phone  && normalizePhone(s.parent_phone)  === pPhone)
  )
  if (duplicate) return NextResponse.json({ error: `이미 등록된 번호입니다 (${duplicate.name})` }, { status: 409 })

  const newStudent = {
    id: randomUUID(),
    class: className?.trim() || '',
    name: name.trim(),
    student_phone: sPhone && sPhone.length >= 10 ? (sPhone.length === 10 && sPhone.startsWith('10') ? '0' + sPhone : sPhone) : null,
    parent_phone:  pPhone && pPhone.length  >= 10 ? (pPhone.length  === 10 && pPhone.startsWith('10')  ? '0' + pPhone  : pPhone)  : null,
    password: INITIAL_PASSWORD_HASH,
    password_plain: '84431621',
    address: '', address_detail: '', zipcode: '',
    total_hw: 0, submitted_count: 0, submission_rate: 0,
    a_count: 0, b_count: 0, c_count: 0,
    assignments: [],
    lectureIds: [],
    enrolledAt: enrolledAt || new Date().toISOString().slice(0, 10),
  }

  saveStudents([...students, newStudent])
  return NextResponse.json(newStudent, { status: 201 })
}