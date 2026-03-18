import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import fs from 'fs'
import path from 'path'

const DATA_DIR = process.env.DATA_DIR || '/app/data'

const ALLOWED_FILES: Record<string, string> = {
  students: 'students_data.json',
  classes:  'classes.json',
  meta:     'meta.json',
}

export async function GET(req: NextRequest) {
  if (!await isAdminAuthed()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const file = req.nextUrl.searchParams.get('file') ?? ''
  const filename = ALLOWED_FILES[file]

  if (!filename) {
    return NextResponse.json({ error: '허용되지 않는 파일입니다.' }, { status: 400 })
  }

  const filePath = path.join(DATA_DIR, filename)

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 404 })
  }

  const content = fs.readFileSync(filePath, 'utf-8')

  return new Response(content, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
