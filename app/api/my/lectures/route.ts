import { NextResponse } from 'next/server'
import { getMyStudent } from '@/lib/my-auth'
import { loadLectures } from '@/lib/lectures'

// GET /api/my/lectures — 내가 수강 중인 강의 목록
export async function GET() {
  const student = await getMyStudent()
  if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const lectureIds: string[] = (student as { lectureIds?: string[] }).lectureIds ?? []
  const all = loadLectures()
  const enrolled = all.filter(l => lectureIds.includes(l.id))
  return NextResponse.json(enrolled)
}
