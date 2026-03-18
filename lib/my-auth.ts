import { cookies } from 'next/headers'
import { createHash } from 'crypto'
import { loadStudents } from './homework'
import type { Student } from './homework'

const COOKIE = 'my_session'

// 세션 토큰: studentId|hmac(studentId)
function makeToken(studentId: string): string {
  const secret = process.env.ADMIN_SECRET || 'pkjmath'
  const hmac = createHash('sha256').update(studentId + secret).digest('hex')
  return `${studentId}|${hmac}`
}

function verifyToken(token: string): string | null {
  const [id, hmac] = token.split('|')
  if (!id || !hmac) return null
  const expected = makeToken(id)
  return expected === token ? id : null
}

export async function setMySession(studentId: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE, makeToken(studentId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30일
    path: '/',
  })
}

export async function clearMySession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE)
}

export async function getMyStudent(): Promise<Student | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE)?.value
  if (!token) return null
  const id = verifyToken(token)
  if (!id) return null
  const students = loadStudents()
  return students.find(s => s.id === id) ?? null
}
