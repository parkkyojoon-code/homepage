import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { loadLectures, saveLectures } from '@/lib/lectures'

// PATCH /api/admin/lectures/[id]/assignments/[aid] — { title?, description?, dueDate? }
export async function PATCH(req: Request, { params }: { params: { id: string; aid: string } }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const lectures = loadLectures()
  const lIdx = lectures.findIndex(l => l.id === params.id)
  if (lIdx === -1) return NextResponse.json({ error: 'Lecture not found' }, { status: 404 })
  const aIdx = lectures[lIdx].assignments.findIndex(a => a.id === params.aid)
  if (aIdx === -1) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  const body = await req.json()
  const a = lectures[lIdx].assignments[aIdx]
  lectures[lIdx].assignments[aIdx] = {
    ...a,
    title: body.title ?? a.title,
    description: body.description ?? a.description,
    dueDate: body.dueDate ?? a.dueDate,
  }
  saveLectures(lectures)
  return NextResponse.json(lectures[lIdx].assignments[aIdx])
}

// DELETE /api/admin/lectures/[id]/assignments/[aid]
export async function DELETE(_req: Request, { params }: { params: { id: string; aid: string } }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const lectures = loadLectures()
  const lIdx = lectures.findIndex(l => l.id === params.id)
  if (lIdx === -1) return NextResponse.json({ error: 'Lecture not found' }, { status: 404 })
  const aIdx = lectures[lIdx].assignments.findIndex(a => a.id === params.aid)
  if (aIdx === -1) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  lectures[lIdx].assignments.splice(aIdx, 1)
  saveLectures(lectures)
  return NextResponse.json({ ok: true })
}
