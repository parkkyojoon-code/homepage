import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { loadLectures, saveLectures, createVideo } from '@/lib/lectures'

// GET /api/admin/lectures/[id]/videos
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const lecture = loadLectures().find(l => l.id === params.id)
  if (!lecture) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(lecture.videos)
}

// POST /api/admin/lectures/[id]/videos — { title, youtubeUrl, week }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const lectures = loadLectures()
  const idx = lectures.findIndex(l => l.id === params.id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { title, youtubeUrl, week } = await req.json()
  if (!title || !youtubeUrl) return NextResponse.json({ error: 'title, youtubeUrl required' }, { status: 400 })
  const video = createVideo(title, youtubeUrl, week ?? 0)
  lectures[idx].videos.push(video)
  saveLectures(lectures)
  return NextResponse.json(video, { status: 201 })
}
