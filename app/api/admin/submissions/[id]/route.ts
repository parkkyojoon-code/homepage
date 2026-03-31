import { NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { loadSubmissions, getSubmissionFilePath } from '@/lib/lectures'
import fs from 'fs'

// GET /api/admin/submissions/[id] — 파일 다운로드
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const submission = loadSubmissions().find(s => s.id === params.id)
  if (!submission) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const filePath = getSubmissionFilePath(submission.filename)
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: 'File not found' }, { status: 404 })
  const buffer = fs.readFileSync(filePath)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': submission.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(submission.originalName)}`,
    },
  })
}
