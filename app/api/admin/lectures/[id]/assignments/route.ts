import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { loadLectures, saveLectures, createAssignment } from '@/lib/lectures'

// GET /api/admin/lectures/[id]/assignments
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const lecture = loadLectures().find(l => l.id === params.id)
  if (!lecture) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(lecture.assignments)
}

// POST /api/admin/lectures/[id]/assignments — { title, description, dueDate }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const lectures = loadLectures()
  const idx = lectures.findIndex(l => l.id === params.id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { title, description, dueDate } = await req.json()
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  const assignment = createAssignment(title, description ?? '', dueDate ?? '')
  lectures[idx].assignments.push(assignment)
  saveLectures(lectures)
  return NextResponse.json(assignment, { status: 201 })
}
