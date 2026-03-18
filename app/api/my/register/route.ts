import { NextRequest, NextResponse } from 'next/server'
import { loadStudents, saveStudents, hashPassword, INITIAL_PASSWORD_HASH } from '@/lib/homework'
import { setMySession } from '@/lib/my-auth'
import { randomUUID } from 'crypto'

function normalizePhone(val: string): string | null {
  const digits = val.replace(/\D/g, '')
  const normalized = digits.length === 10 && digits.startsWith('10') ? '0' + digits : digits
  return normalized.length === 11 && normalized.startsWith('010') ? normalized : null
}

export async function POST(req: NextRequest) {
  const { name, student_phone, parent_phone, password } = await req.json()

  if (!name || !name.trim()) {
    return NextResponse.json({ error: '이름을 입력해주세요.' }, { status: 400 })
  }

  const studentPhone = student_phone ? normalizePhone(String(student_phone)) : null
  const parentPhone  = parent_phone  ? normalizePhone(String(parent_phone))  : null

  if (!studentPhone && !parentPhone) {
    return NextResponse.json({ error: '학생 번호 또는 학부모 번호 중 하나는 필수입니다.' }, { status: 400 })
  }

  if (!password || String(password).length < 6) {
    return NextResponse.json({ error: '비밀번호는 6자 이상이어야 합니다.' }, { status: 400 })
  }

  const students = loadStudents()

  // 중복 체크 — 번호가 이미 등록되어 있으면 거부
  const duplicate = students.find(s =>
    (studentPhone && (s.student_phone === studentPhone || s.parent_phone === studentPhone)) ||
    (parentPhone  && (s.student_phone === parentPhone  || s.parent_phone === parentPhone))
  )

  if (duplicate) {
    return NextResponse.json({
      error: '이미 등록된 번호입니다. 초기 비밀번호(84431621)로 로그인하거나 관리자에게 문의하세요.',
      already_registered: true,
    }, { status: 409 })
  }

  // 신규 학생 생성
  const newStudent = {
    id:              randomUUID(),
    class:           '',
    name:            name.trim(),
    student_phone:   studentPhone,
    parent_phone:    parentPhone,
    password:        hashPassword(String(password)),
    address:         '',
    address_detail:  '',
    total_hw:        0,
    submitted_count: 0,
    submission_rate: 0,
    a_count:         0,
    b_count:         0,
    c_count:         0,
    assignments:     [],
  }

  students.push(newStudent)
  saveStudents(students)

  await setMySession(newStudent.id)
  return NextResponse.json({ ok: true, name: newStudent.name })
}
