import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { loadClasses, saveClasses, generateId, ClassData } from '@/lib/classes'

// GET: 전체 수업 목록 (visible 무관)
export async function GET() {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(loadClasses())
}

// POST: 새 수업 추가
export async function POST(req: NextRequest) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const now = new Date().toISOString()

  const newId = body.id?.trim() || generateId(body.name || 'class')

  const newClass: ClassData = {
    id:          newId,
    visible:     body.visible ?? false,
    name:        body.name || '',
    category:    body.category || '수리논술',
    badge:       body.badge || '',
    image:       null,
    modes: {
      online:  { enabled: body.modes?.online?.enabled ?? true,  price: body.modes?.online?.price ?? 0 },
      offline: { enabled: body.modes?.offline?.enabled ?? false, price: body.modes?.offline?.price ?? 0, campuses: body.modes?.offline?.campuses ?? [] },
    },
    textbook: {
      included: body.textbook?.included ?? false,
      price:    body.textbook?.price ?? 0,
    },
    description: body.description || '',
    keywords:    body.keywords || ['', '', ''],
    createdAt:   now,
    updatedAt:   now,
  }

  const classes = loadClasses()

  if (classes.some(c => c.id === newId)) {
    return NextResponse.json({ error: `이미 사용 중인 ID입니다: "${newId}"` }, { status: 409 })
  }

  classes.push(newClass)
  saveClasses(classes)

  return NextResponse.json(newClass, { status: 201 })
}