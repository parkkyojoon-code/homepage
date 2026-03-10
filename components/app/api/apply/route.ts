import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

// 환경변수에서 설정 로드
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || '1jzwafX-L-QatwQUxlv5VnLqYZIZB3GQjRKmTEUp2L3g'
const SHEET_NAME = '수업 신청'  // Python apply_checker.py와 같은 시트 사용

// Google Sheets API 인증
async function getGoogleSheetsClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}')
  
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  const sheets = google.sheets({ version: 'v4', auth })
  return sheets
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      userType,
      studentName,
      parentPhone,
      studentPhone,
      birthYear,
      courseType,
      campus,
      confirmPayment,
      agreePrivacy,
      timestamp,
      // 10주차 추가 필드
      textbookOption,
      zipCode,
      address,
      addressDetail,
    } = body

    // 유효성 검사
    if (!studentName || !parentPhone || !studentPhone || !courseType) {
      return NextResponse.json(
        { success: false, error: '필수 항목을 모두 입력해주세요' },
        { status: 400 }
      )
    }

    // 타임스탬프 포맷
    const formattedTimestamp = new Date(timestamp).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })

    let surinonseulRegular = ''
    let surinonseulTrial = ''
    let sunungSelect = ''
    let sunungRegular = ''

    switch (courseType) {
      case 'surinonseul-online':
        surinonseulRegular = '【수리논술 온라인】 정규 수업 신청'
        break
      case 'surinonseul-offline':
        surinonseulRegular = `【수리논술 현강】 ${campus || '서울 대치'}ㅣ개강일정 추후 안내`
        break
      case 'surinonseul':
        surinonseulRegular = '【수리논술 현강】 서울 대치ㅣ개강일정 추후 안내'
        break
      case 'surinonseul-trial':
        surinonseulTrial = '【수리논술 체험수업】 서울 대치ㅣ체험수업 일정 추후 안내'
        break
      case 'sunung-blueprint-online':
        sunungSelect = '【블루프린트】 수업ㅣ1~3등급 대상 학생'
        sunungRegular = '【수능수학 온라인】ㅣ개강일정 추후 안내'
        break
      case 'sunung-blueprint-offline':
        sunungSelect = '【블루프린트】 수업ㅣ1~3등급 대상 학생'
        sunungRegular = `【수능수학 현강】 ${campus || '인천 송도'}ㅣ개강일정 추후 안내`
        break
      case 'sunung-blueprint':
        sunungSelect = '【블루프린트】 수업ㅣ1~3등급 대상 학생'
        sunungRegular = '【수능수학 온라인】ㅣ개강일정 추후 안내'
        break
      case 'sunung-escape-online':
        sunungSelect = '【노베탈출】 수업ㅣ3등급 이하 학생'
        sunungRegular = '【수능수학 온라인】ㅣ개강일정 추후 안내'
        break
      case 'sunung-escape-offline':
        sunungSelect = '【노베탈출】 수업ㅣ3등급 이하 학생'
        sunungRegular = `【수능수학 현강】 ${campus || '인천 송도'}ㅣ개강일정 추후 안내`
        break
      case 'sunung-escape':
        sunungSelect = '【노베탈출】 수업ㅣ3등급 이하 학생'
        sunungRegular = '【수능수학 온라인】ㅣ개강일정 추후 안내'
        break
      // ── 10주차 수리논술 (미분과 부등식 + 확통 선택) ──
      case 'surinonseul-week10-online-mibbun':
        surinonseulRegular = '【수리논술 10주차 온라인】 미분과 부등식ㅣ교재비 38,000원'
        break
      case 'surinonseul-week10-online-mibbun-hwakto':
        surinonseulRegular = '【수리논술 10주차 온라인】 미분+확통과 경우의 수ㅣ교재비 76,000원'
        break
      case 'surinonseul-week10-offline-mibbun':
        surinonseulRegular = `【수리논술 10주차 현강】 ${campus || '서울 대치'}ㅣ미분과 부등식ㅣ교재비 38,000원`
        break
      case 'surinonseul-week10-offline-mibbun-hwakto':
        surinonseulRegular = `【수리논술 10주차 현강】 ${campus || '서울 대치'}ㅣ미분+확통과 경우의 수ㅣ교재비 76,000원`
        break
    }

    let sheetSuccess = false

    try {
      const sheets = await getGoogleSheetsClient()
      
      // A~T 컬럼 (Q~T: 10주차 추가 필드)
      const rowData = [
        formattedTimestamp,                                        // A: 타임스탬프
        userType === '학생' ? '학생 본인' : (userType || '학생 본인'), // B: 신청자
        studentName,                                               // C: 학생 이름
        parentPhone,                                               // D: 학부모님 연락처
        studentPhone,                                              // E: 학생 연락처
        birthYear || '',                                           // F: 학생 출생년도
        surinonseulRegular,                                        // G: [수리논술] 정규 수업 신청
        surinonseulTrial,                                          // H: [수리논술] 체험 수업 신청
        sunungSelect,                                              // I: [수능 수학] 수업 선택
        sunungRegular,                                             // J: [수능 수학] 정규 수업 신청
        confirmPayment ? '넵, 확인하였습니다.' : '',               // K: 원비 납부 확인
        agreePrivacy ? '넵, 동의합니다.' : '',                     // L: 개인정보 수집 동의
        '',                                                        // M: 결제 상태
        '',                                                        // N: 문자 발송 (Python이 기록)
        '',                                                        // O: 청구서 발송
        '',                                                        // P: 청구서 ID
        textbookOption || '',                                      // Q: 교재 선택 (10주차)
        zipCode || '',                                             // R: 우편번호
        address || '',                                             // S: 주소
        addressDetail || '',                                       // T: 상세주소
      ]

      await sheets.spreadsheets.values.append({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${SHEET_NAME}!A:T`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowData]
        }
      })
      
      sheetSuccess = true
    } catch (sheetError) {
      console.error('구글 시트 저장 오류:', sheetError)
    }

    if (!sheetSuccess && process.env.NODE_ENV === 'development') {
      console.log('개발 모드: 구글 시트 연동 스킵')
      sheetSuccess = true
    }

    if (sheetSuccess) {
      return NextResponse.json({ 
        success: true, 
        message: '신청이 완료되었습니다. 곧 안내 문자가 발송됩니다.'
      })
    } else {
      return NextResponse.json(
        { success: false, error: '신청 저장 중 오류가 발생했습니다' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('수강 신청 처리 오류:', error)
    
    return NextResponse.json(
      { success: false, error: '신청 처리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
