import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { loadClasses, saveClasses, saveClassImage, deleteImage } from '@/lib/classes'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  let classes = loadClasses()
  let idx = classes.findIndex(c => c.id === id)
  if (idx === -1) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const before=JSON.stringify(classes[idx])

  const formData = await req.formData()
  const file = formData.get('image') as File | null
  if (!file) return NextResponse.json({ error: 'no_file' }, { status: 400 })
  if(classes[idx].saleKind==='BUNDLE'&&formData.get('expectedUpdatedAt')!==classes[idx].updatedAt)return NextResponse.json({error:'상품 정보가 변경되었습니다. 다시 불러와주세요.'},{status:409})

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif']
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: '이미지 파일만 업로드 가능합니다.' }, { status: 400 })
  }

  const filename = `${id}-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  if(classes[idx].saleKind==='BUNDLE'){
    classes=loadClasses();idx=classes.findIndex(c=>c.id===id)
    if(idx===-1||JSON.stringify(classes[idx])!==before)return NextResponse.json({error:'상품 정보가 변경되었습니다. 다시 불러와주세요.'},{status:409})
  }
  // Only delete the old image after the bundle edit fence has passed.
  if (classes[idx].image) deleteImage(classes[idx].image!)
  saveClassImage(filename, buffer)

  classes[idx].image = filename
  classes[idx].updatedAt = new Date(classes[idx].saleKind==='BUNDLE'?Math.max(Date.now(),(Date.parse(classes[idx].updatedAt)||0)+1):Date.now()).toISOString()
  saveClasses(classes)

  return NextResponse.json({ ok: true, filename, url: `/api/images/${filename}`,updatedAt:classes[idx].updatedAt })
}
