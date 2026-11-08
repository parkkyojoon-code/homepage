import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { loadClasses, saveClasses, generateId, ClassData } from '@/lib/classes'
import { isOriginalProduct, parsePurchaseProcess } from '@/lib/purchase-process'
import { resolveClassBinding, ClassBindingError } from '@/lib/daechion/class-binding'
import { saleKindForWrite, validateBundle, SalePolicyError } from '@/lib/daechion/orders/sale-policy'
import {resolveBundleComponents,bundleCompositionIssue,BundleComponentError,type BundleComponent} from '@/lib/daechion/orders/bundle-components'

// GET: 전체 수업 목록 (visible 무관)
export async function GET() {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const classes=loadClasses()
  return NextResponse.json(classes.map(item=>({...item,bundleCompositionIssue:bundleCompositionIssue(item,classes)})),{headers:{'Cache-Control':'no-store'}})
}

// POST: 새 수업 추가
export async function POST(req: NextRequest) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const now = new Date().toISOString()

  const newId = body.id?.trim() || generateId(body.name || 'class')
  let purchaseProcess
  try { purchaseProcess = parsePurchaseProcess(body.purchaseProcess) } catch {
    return NextResponse.json({ error: '프로세스를 선택해주세요.' }, { status: 400 })
  }
  if (isOriginalProduct(newId) && purchaseProcess === 'PROCESS_2') {
    return NextResponse.json({ error: '기존 수업은 프로세스1을 유지합니다.' }, { status: 400 })
  }

  let saleKind
  let bundleComponents:BundleComponent[]|undefined
  let bindingBody=body
  try{
    saleKind=saleKindForWrite(body.saleKind)
    if(saleKind==='BUNDLE'){
      bundleComponents=resolveBundleComponents(body.bundleProductIds,body.expectedBundleComponents,loadClasses(),process.env.DAECHION_TENANT_ID??'')
      bindingBody={...body,daechionLectureIds:bundleComponents.map(item=>item.lectureId)}
    }
    validateBundle({...body,purchaseProcess,saleKind},bindingBody.daechionLectureIds,false)
  }catch(error){return NextResponse.json({error:error instanceof SalePolicyError||error instanceof BundleComponentError?error.message:'상품 설정을 확인해주세요.'},{status:400})}

  let daechionBinding
  try{daechionBinding=await resolveClassBinding(bindingBody,purchaseProcess,undefined,process.env)}catch(error){
    return NextResponse.json({error:error instanceof ClassBindingError?error.message:'대치온 연결을 확인하지 못했습니다.'},{status:400})
  }
  const newClass: ClassData = {
    id:          newId,
    purchaseProcess,
    saleKind,
    bundleComponents,
    daechionBinding,
    visible:     body.visible ?? false,
    name:        body.name || '',
    category:    body.category || '수리논술',
    badge:       body.badge || '',
    image:       null,
    modes: {
      online:  { enabled: body.modes?.online?.enabled ?? true,  price: body.modes?.online?.price ?? 0, campuses: [] },
      offline: { enabled: body.modes?.offline?.enabled ?? false, price: body.modes?.offline?.price ?? 0, campuses: body.modes?.offline?.campuses ?? [] },
    },
    textbook: {
      included: body.textbook?.included ?? false,
      price:    body.textbook?.price ?? 0,
    },
    description: body.description || '',
    duration: body.duration || '',
    keywords:    body.keywords || ['', '', ''],
    createdAt:   now,
    updatedAt:   now,
  }

  const classes = loadClasses()
  if(bundleComponents){
    try{resolveBundleComponents(bundleComponents.map(item=>item.productId),bundleComponents,classes,process.env.DAECHION_TENANT_ID??'')}
    catch{return NextResponse.json({error:'구성 상품이 변경되었습니다. 다시 불러와주세요.'},{status:409})}
  }

  if (classes.some(c => c.id === newId)) {
    return NextResponse.json({ error: `이미 사용 중인 ID입니다: "${newId}"` }, { status: 409 })
  }

  classes.push(newClass)
  saveClasses(classes)

  return NextResponse.json(newClass, { status: 201 })
}
