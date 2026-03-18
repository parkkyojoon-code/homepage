import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthed } from '@/lib/admin-auth'
import { loadStudents } from '@/lib/homework'

export async function GET(req: NextRequest) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const students = loadStudents()
  const fmt = req.nextUrl.searchParams.get('format')

  // 배송지가 있는 학생만 (없는 것도 포함하려면 filter 제거)
  const rows = students.map(s => ({
    id:             s.id,
    name:           s.name,
    class:          s.class,
    student_phone:  s.student_phone ?? '',
    parent_phone:   s.parent_phone ?? '',
    zipcode:        s.zipcode ?? '',
    address:        s.address ?? '',
    address_detail: s.address_detail ?? '',
    has_address:    !!(s.address),
  }))

  // JSON 응답
  if (fmt !== 'xlsx') {
    return NextResponse.json(rows)
  }

  // 엑셀 응답 — xlsx 라이브러리 사용
  const XLSX = await import('xlsx')
  const sheetData = [
    ['이름', '반', '학생 번호', '학부모 번호', '우편번호', '기본 주소', '상세 주소'],
    ...rows.map(r => [r.name, r.class, r.student_phone, r.parent_phone, r.zipcode, r.address, r.address_detail]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(sheetData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '배송지')

  // 열 너비 설정
  ws['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 36 }, { wch: 24 }]

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="addresses_${new Date().toISOString().slice(0,10)}.xlsx"`,
    },
  })
}
