import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { parseExcel, saveStudents, saveMeta, saveUploadedFile } from '@/lib/homework'

export async function POST(req: NextRequest) {
  if (!await isAdminAuthed()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('excel') as File | null

  if (!file) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
  }

  const filename = file.name
  if (!filename.endsWith('.xlsx') && !filename.endsWith('.xls')) {
    return NextResponse.json({ error: '.xlsx 파일만 업로드 가능합니다.' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())

    // 원본 파일 저장
    saveUploadedFile(filename, buffer)

    // 파싱
    const students = parseExcel(buffer)
    saveStudents(students)

    const now = new Date()
    const uploaded_at = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`

    saveMeta({ filename, uploaded_at, count: students.length })

    return NextResponse.json({
      ok:      true,
      message: `✅ ${students.length}명의 데이터가 업데이트됐습니다.`,
      count:   students.length,
    })
  } catch (err) {
    console.error('Excel parse error:', err)
    return NextResponse.json({ error: `파싱 오류: ${err}` }, { status: 500 })
  }
}
