import { NextResponse } from 'next/server'
import { getMyStudent } from '@/lib/my-auth'

export async function GET() {
  const student = await getMyStudent()
  if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(student.assignments)
}
