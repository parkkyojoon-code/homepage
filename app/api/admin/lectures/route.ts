import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { loadLectures, saveLectures, createLecture } from '@/lib/lectures'

// GET /api/admin/lectures
export async function GET() {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(loadLectures())
}

// POST /api/admin/lectures — { name, description }
export async function POST(req: Request) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, description } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const lectures = loadLectures()
  const lecture = createLecture(name, description ?? '')
  lectures.push(lecture)
  saveLectures(lectures)
  return NextResponse.json(lecture, { status: 201 })
}
