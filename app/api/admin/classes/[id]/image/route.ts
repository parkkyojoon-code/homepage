import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { loadClasses, saveClasses, saveClassImage, deleteImage, CatalogStoreError } from '@/lib/classes'
import {randomUUID} from 'node:crypto'
import {catalogFailure} from '@/lib/catalog-http'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try{
  const { id } = await params
  let classes = loadClasses()
  let idx = classes.findIndex(c => c.id === id)
  if (idx === -1) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const before=JSON.stringify(classes[idx])

  const formData = await req.formData()
  const file = formData.get('image') as File | null
  if (!file) return NextResponse.json({ error: 'no_file' }, { status: 400 })
  const expected=formData.get('expectedUpdatedAt')
  if((expected!==null||classes[idx].saleKind==='BUNDLE')&&expected!==classes[idx].updatedAt)return NextResponse.json({error:'상품 정보가 변경되었습니다. 다시 불러와주세요.',code:'CATALOG_CONFLICT'},{status:409})

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif']
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: '이미지 파일만 업로드 가능합니다.' }, { status: 400 })
  }

  const filename = `${id}-${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  classes=loadClasses();idx=classes.findIndex(c=>c.id===id)
  if(idx===-1||JSON.stringify(classes[idx])!==before)return NextResponse.json({error:'상품 정보가 변경되었습니다. 다시 불러와주세요.',code:'CATALOG_CONFLICT'},{status:409})
  saveClassImage(filename, buffer)

  classes[idx].image = filename
  classes[idx].updatedAt = new Date(Math.max(Date.now(),(Date.parse(classes[idx].updatedAt)||0)+1)).toISOString()
  try{saveClasses(classes)}catch(error){
    // An I/O error after rename may already have committed this filename.
    if(error instanceof CatalogStoreError&&error.code==='CATALOG_CONFLICT')try{deleteImage(filename)}catch{}
    throw error
  }
  // Retain the prior image: the last-known-valid backup may still reference it.

  return NextResponse.json({ ok: true, filename, url: `/api/images/${filename}`,updatedAt:classes[idx].updatedAt })
  }catch(error){return catalogFailure(error)}
}
