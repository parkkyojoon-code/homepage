import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { loadLectures, saveLectures } from '@/lib/lectures'

// GET /api/admin/lectures/[id]
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const lecture = loadLectures().find(l => l.id === params.id)
  if (!lecture) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(lecture)
}

// PATCH /api/admin/lectures/[id] — { name?, description? }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const lectures = loadLectures()
  const idx = lectures.findIndex(l => l.id === params.id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json()
  if (body.name !== undefined) lectures[idx].name = body.name
  if (body.description !== undefined) lectures[idx].description = body.description
  saveLectures(lectures)
  return NextResponse.json(lectures[idx])
}

// DELETE /api/admin/lectures/[id]
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const lectures = loadLectures()
  const idx = lectures.findIndex(l => l.id === params.id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  lectures.splice(idx, 1)
  saveLectures(lectures)
  return NextResponse.json({ ok: true })
}
