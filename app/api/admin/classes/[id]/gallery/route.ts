import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { loadClasses, saveClasses, saveClassImage, deleteImage } from '@/lib/classes'

// POST: 갤러리 사진 추가 (기존 사진은 유지, 여러 장 누적 가능)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const classes = loadClasses()
  const idx = classes.findIndex(c => c.id === id)
  if (idx === -1) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('image') as File | null
  if (!file) return NextResponse.json({ error: 'no_file' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif']
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: '이미지 파일만 업로드 가능합니다.' }, { status: 400 })
  }

  const filename = `${id}-gallery-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  saveClassImage(filename, buffer)

  const gallery = classes[idx].gallery ?? []
  gallery.push(filename)
  classes[idx].gallery = gallery
  classes[idx].updatedAt = new Date().toISOString()
  saveClasses(classes)

  return NextResponse.json({ ok: true, filename, gallery })
}

// DELETE: 갤러리 사진 한 장 삭제  (body: { filename: string })
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const { filename } = await req.json()
  if (!filename) return NextResponse.json({ error: 'no_filename' }, { status: 400 })

  const classes = loadClasses()
  const idx = classes.findIndex(c => c.id === id)
  if (idx === -1) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const gallery = (classes[idx].gallery ?? []).filter(f => f !== filename)
  classes[idx].gallery = gallery
  classes[idx].updatedAt = new Date().toISOString()
  saveClasses(classes)
  deleteImage(filename)

  return NextResponse.json({ ok: true, gallery })
}
