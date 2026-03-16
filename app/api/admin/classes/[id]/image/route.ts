import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { loadClasses, saveClasses, saveClassImage, deleteImage } from '@/lib/classes'

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

  // 기존 이미지 삭제
  if (classes[idx].image) deleteImage(classes[idx].image!)

  const filename = `${id}-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  saveClassImage(filename, buffer)

  classes[idx].image = filename
  classes[idx].updatedAt = new Date().toISOString()
  saveClasses(classes)

  return NextResponse.json({ ok: true, filename, url: `/api/images/${filename}` })
}
