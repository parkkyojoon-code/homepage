import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { loadClasses, classesRevision, saveClasses } from '@/lib/classes'
import {catalogFailure} from '@/lib/catalog-http'

// PUT: 수업 카드 순서 변경
// body: { ids: string[] }  — 원하는 순서대로 나열된 class id 배열
export async function PUT(req: NextRequest) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try{
  const body = await req.json()
  const ids: unknown = body?.ids

  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) {
    return NextResponse.json({ error: 'ids는 문자열 배열이어야 합니다.' }, { status: 400 })
  }

  const classes=loadClasses(),revision=classesRevision(classes),expected=req.headers.get('X-Catalog-Revision')
  if(expected!==null&&expected!==revision)return NextResponse.json({error:'수업 정보가 변경되었습니다. 다시 불러와주세요.',code:'CATALOG_CONFLICT'},{status:409})
  const byId=new Map(classes.map(item=>[item.id,item])),reordered=[]
  for(const id of ids as string[]){const item=byId.get(id);if(item){reordered.push(item);byId.delete(id)}}
  for(const item of classes)if(byId.has(item.id))reordered.push(item)
  saveClasses(reordered,revision)
  return NextResponse.json(reordered,{headers:{'X-Catalog-Revision':classesRevision(reordered)??''}})
  }catch(error){return catalogFailure(error)}
}
