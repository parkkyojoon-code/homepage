import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { loadClasses, saveClasses, deleteImage } from '@/lib/classes'
import { isOriginalProduct, parsePurchaseProcess, purchaseProcessOf } from '@/lib/purchase-process'
import { resolveClassBinding, ClassBindingError } from '@/lib/daechion/class-binding'
import { saleKindForWrite, validateBundle, SalePolicyError } from '@/lib/daechion/orders/sale-policy'

// PUT: 수업 수정
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  let classes = loadClasses()
  let idx = classes.findIndex(c => c.id === id)
  if (idx === -1) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  let purchaseProcess
  try { purchaseProcess = parsePurchaseProcess(body.purchaseProcess, purchaseProcessOf(classes[idx])) } catch {
    return NextResponse.json({ error: '프로세스를 선택해주세요.' }, { status: 400 })
  }
  if (isOriginalProduct(id) && purchaseProcess === 'PROCESS_2') {
    return NextResponse.json({ error: '기존 수업은 프로세스1을 유지합니다.' }, { status: 400 })
  }

  let saleKind
  try{
    saleKind=saleKindForWrite(body.saleKind,classes[idx])
    if(saleKind==='BUNDLE'&&body.expectedUpdatedAt!==classes[idx].updatedAt)return NextResponse.json({error:'상품 정보가 변경되었습니다. 다시 불러와주세요.'},{status:409})
    validateBundle({...classes[idx],...body,purchaseProcess,saleKind},body.daechionLectureIds??classes[idx].daechionBinding?.lectures.map(l=>l.id),false)
  }catch(error){return NextResponse.json({error:error instanceof SalePolicyError?error.message:'상품 설정을 확인해주세요.'},{status:400})}

  const before=JSON.stringify(classes[idx])
  if(purchaseProcess==='PROCESS_2'&&body.expectedDaechionBindingAt!==undefined&&body.expectedDaechionBindingAt!==(classes[idx].daechionBinding?.verifiedAt??null))return NextResponse.json({error:'강의 연결이 변경되었습니다. 다시 불러와주세요.'},{status:409})
  let daechionBinding
  try{daechionBinding=await resolveClassBinding(body,purchaseProcess,classes[idx].daechionBinding,process.env)}catch(error){
    return NextResponse.json({error:error instanceof ClassBindingError?error.message:'대치온 연결을 확인하지 못했습니다.'},{status:400})
  }
  // API lookup yields: preserve other edits and reject an intervening edit of this product.
  classes=loadClasses();idx=classes.findIndex(c=>c.id===id)
  if(idx===-1||JSON.stringify(classes[idx])!==before)return NextResponse.json({error:'수업 정보가 변경되었습니다. 다시 불러와주세요.'},{status:409})
  const fields={...body};delete fields.daechionLectureIds;delete fields.daechionBinding;delete fields.expectedDaechionBindingAt;delete fields.expectedUpdatedAt
  classes[idx] = {
    ...classes[idx],
    ...fields,
    id,                             // id 변경 불가
    purchaseProcess,
    saleKind,
    daechionBinding,
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
