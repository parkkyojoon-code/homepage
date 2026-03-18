import { NextRequest, NextResponse } from 'next/server'
import { loadStudents, hashPassword } from '@/lib/homework'
import { setMySession } from '@/lib/my-auth'

export async function POST(req: NextRequest) {
  const { phone, password } = await req.json()

  if (!phone || !password) {
    return NextResponse.json({ error: '전화번호와 비밀번호를 입력해주세요.' }, { status: 400 })
  }

  const digits = String(phone).replace(/\D/g, '')
  if (digits.length < 9) {
    return NextResponse.json({ error: '올바른 전화번호를 입력해주세요.' }, { status: 400 })
  }

  const suffix = digits.slice(-9)
  const students = loadStudents()
  const student = students.find(s =>
    (s.student_phone && s.student_phone.endsWith(suffix)) ||
    (s.parent_phone  && s.parent_phone.endsWith(suffix))
  )

  if (!student) {
    return NextResponse.json({ error: '등록된 번호가 없습니다.' }, { status: 401 })
  }

  const hashed = hashPassword(String(password))
  if (hashed !== student.password) {
    return NextResponse.json({ error: '비밀번호가 틀렸습니다.' }, { status: 401 })
  }

  await setMySession(student.id)
  return NextResponse.json({ ok: true, name: student.name })
}
