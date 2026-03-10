import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || '1jzwafX-L-QatwQUxlv5VnLqYZIZB3GQjRKmTEUp2L3g'
const SHEET_NAME = '수업 신청'

async function getGoogleSheetsClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}')
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  return google.sheets({ version: 'v4', auth })
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const phone = searchParams.get('phone') || ''
  const sheetType = searchParams.get('type') || 'nextcurriculum' // nextcurriculum | general

  if (!phone || phone.replace(/\D/g, '').length < 10) {
    return NextResponse.json({ duplicate: false })
  }

  const normalizedInput = normalizePhone(phone)

  try {
    const sheets = await getGoogleSheetsClient()

    // D열(학부모), E열(학생) 전화번호 + G열(수업명) 조회
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${SHEET_NAME}!D:G`,
    })

    const rows = result.data.values || []

    for (const row of rows.slice(1)) { // 헤더 제외
      const parentPhone = normalizePhone(row[0] || '')
      const studentPhone = normalizePhone(row[1] || '')
      const courseText = row[3] || '' // G열: 수업명

      const phoneMatch = parentPhone === normalizedInput || studentPhone === normalizedInput

      if (!phoneMatch) continue

      // nextcurriculum 타입이면 10주차 교재 신청 여부만 체크
      if (sheetType === 'nextcurriculum') {
        if (courseText.includes('10주차')) {
          return NextResponse.json({ duplicate: true, message: '이미 교재 신청이 완료된 번호입니다.' })
        }
      } else {
        // 일반 수업 신청 중복 체크
        if (courseText) {
          return NextResponse.json({ duplicate: true, message: '이미 신청된 번호입니다.' })
        }
      }
    }

    return NextResponse.json({ duplicate: false })
  } catch (error) {
    console.error('중복 확인 오류:', error)
    // API 오류 시 중복 아님으로 처리 (신청 막지 않음)
    return NextResponse.json({ duplicate: false })
  }
}
