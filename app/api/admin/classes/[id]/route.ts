import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { loadClasses, saveClasses, deleteImage } from '@/lib/classes'

// PUT: 수업 수정
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const classes = loadClasses()
  const idx = classes.findIndex(c => c.id === id)
  if (idx === -1) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  classes[idx] = {
    ...classes[idx],
    ...body,
    id,                             // id 변경 불가
    image: body.image ?? classes[idx].image,  // 이미지는 별도 엔드포인트로
    updatedAt: new Date().toISOString(),
  }
  saveClasses(classes)

  return NextResponse.json(classes[idx])
}

// DELETE: 수업 삭제
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const classes = loadClasses()
  const idx = classes.findIndex(c => c.id === id)
  if (idx === -1) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // 이미지도 같이 삭제
  if (classes[idx].image) deleteImage(classes[idx].image!)

  classes.splice(idx, 1)
  saveClasses(classes)

  return NextResponse.json({ ok: true })
}
