import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { loadLectures, saveLectures, createNotice } from '@/lib/lectures'

// GET /api/admin/lectures/[id]/notices
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const lecture = loadLectures().find(l => l.id === params.id)
  if (!lecture) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(lecture.notices)
}

// POST /api/admin/lectures/[id]/notices — { title, content }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const lectures = loadLectures()
  const idx = lectures.findIndex(l => l.id === params.id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { title, content } = await req.json()
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  const notice = createNotice(title, content ?? '')
  lectures[idx].notices.unshift(notice)
  saveLectures(lectures)
  return NextResponse.json(notice, { status: 201 })
}
