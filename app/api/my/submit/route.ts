import { NextResponse } from 'next/server'
import { getMyStudent } from '@/lib/my-auth'
import { loadLectures, loadSubmissions, saveSubmissions, saveSubmissionFile } from '@/lib/lectures'
import { randomUUID } from 'crypto'
import path from 'path'

const MAX_SIZE = 20 * 1024 * 1024 // 20MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']

// POST /api/my/submit — multipart/form-data: lectureId, assignmentId, file
export async function POST(req: Request) {
  const student = await getMyStudent()
  if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lectureIds: string[] = (student as { lectureIds?: string[] }).lectureIds ?? []

  const formData = await req.formData()
  const lectureId = formData.get('lectureId') as string
  const assignmentId = formData.get('assignmentId') as string
  const file = formData.get('file') as File | null

  if (!lectureId || !assignmentId || !file) {
    return NextResponse.json({ error: 'lectureId, assignmentId, file required' }, { status: 400 })
  }

  if (!lectureIds.includes(lectureId)) {
    return NextResponse.json({ error: '수강 권한이 없는 강의입니다.' }, { status: 403 })
  }

  const lectures = loadLectures()
  const lecture = lectures.find(l => l.id === lectureId)
  if (!lecture) return NextResponse.json({ error: 'Lecture not found' }, { status: 404 })
  const assignment = lecture.assignments.find(a => a.id === assignmentId)
  if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'PDF 또는 이미지 파일만 허용됩니다.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '파일 크기는 20MB 이하여야 합니다.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = path.extname(file.name) || '.bin'
  const submissionId = randomUUID()
  const filename = saveSubmissionFile(submissionId, buffer, ext)

  const submissions = loadSubmissions()
  const submission = {
    id: submissionId,
    studentId: student.id,
    studentName: student.name,
    lectureId,
    lectureName: lecture.name,
    assignmentId,
    assignmentTitle: assignment.title,
    filename,
    originalName: file.name,
    submittedAt: new Date().toISOString(),
    fileSize: file.size,
    mimeType: file.type,
  }
  submissions.push(submission)
  saveSubmissions(submissions)

  return NextResponse.json(submission, { status: 201 })
}
