import { NextRequest, NextResponse } from 'next/server'
import { getMyStudent } from '@/lib/my-auth'
import { loadStudents, saveStudents, hashPassword } from '@/lib/homework'

export async function PATCH(req: NextRequest) {
  const student = await getMyStudent()
  if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { current_password, new_password } = await req.json()

  if (!current_password || !new_password) {
    return NextResponse.json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' }, { status: 400 })
  }
  if (String(new_password).length < 6) {
    return NextResponse.json({ error: '새 비밀번호는 6자 이상이어야 합니다.' }, { status: 400 })
  }

  if (hashPassword(String(current_password)) !== student.password) {
    return NextResponse.json({ error: '현재 비밀번호가 틀렸습니다.' }, { status: 401 })
  }

  const students = loadStudents()
  const idx = students.findIndex(s => s.id === student.id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  students[idx].password = hashPassword(String(new_password))
  saveStudents(students)

  return NextResponse.json({ ok: true })
}
