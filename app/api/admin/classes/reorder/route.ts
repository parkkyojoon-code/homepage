import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { reorderClasses } from '@/lib/classes'

// PUT: 수업 카드 순서 변경
// body: { ids: string[] }  — 원하는 순서대로 나열된 class id 배열
export async function PUT(req: NextRequest) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const ids: unknown = body?.ids

  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) {
    return NextResponse.json({ error: 'ids는 문자열 배열이어야 합니다.' }, { status: 400 })
  }

  const classes = reorderClasses(ids as string[])
  return NextResponse.json(classes)
}
