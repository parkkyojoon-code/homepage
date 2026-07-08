import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { saveClassImage, deleteImage } from '@/lib/classes'

// POST: 사진 1장 업로드 → 파일만 저장하고 파일명을 돌려줌
// (media 배열의 순서/구성은 클라이언트에서 관리 후 수업 저장(PUT) 시 함께 저장됨)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const formData = await req.formData()
  const file = formData.get('image') as File | null
  if (!file) return NextResponse.json({ error: 'no_file' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif']
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: '이미지 파일만 업로드 가능합니다.' }, { status: 400 })
  }

  const filename = `${id}-media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  saveClassImage(filename, buffer)

  return NextResponse.json({ ok: true, filename, url: `/api/images/${filename}` })
}

// DELETE: 사진 파일 삭제 (best-effort, media 배열에서 빼는 건 클라이언트가 처리 후 저장)
export async function DELETE(req: NextRequest) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { filename } = await req.json()
  if (!filename) return NextResponse.json({ error: 'no_filename' }, { status: 400 })

  deleteImage(filename)
  return NextResponse.json({ ok: true })
}
