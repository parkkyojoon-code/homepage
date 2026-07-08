import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getClassById } from '@/lib/classes'

// 환경변수에서 설정 로드
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || '1jzwafX-L-QatwQUxlv5VnLqYZIZB3GQjRKmTEUp2L3g'
const SHEET_NAME = '수업 신청'
const SHEET_NAME_TEXTBOOK = 'textbook'

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
      courseId,
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
      // 결제 금액 (클라이언트 표시값 — 서버에서 관리자 설정 기준으로 재검증/재계산함)
      totalAmount: clientTotalAmount,
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

    // 수업 데이터에서 커스텀 라벨 조회 (courseId 기반)
    let customLabel: string | null = null
    // 실제 청구 금액 — 관리자 페이지에 저장된 현재 가격 기준으로 서버에서 재계산
    // (화면에 표시된 금액과 실제 청구 금액이 어긋나는 걸 막기 위해, 클라이언트 값은 참고용으로만 두고
    //  이 값을 시트에 기록해 청구 시 항상 최신 가격을 참조하도록 함)
    let resolvedModePrice: number | null = null
    let resolvedTextbookAmount = 0
    let resolvedTotalAmount: number | null = null
    try {
      if (courseId) {
        const classData = getClassById(courseId)
        if (classData) {
          const isOnline = !courseType.includes('offline')
          customLabel = isOnline
            ? (classData.apply_label_online || null)
            : (classData.apply_label_offline || null)

          resolvedModePrice = isOnline
            ? (classData.modes?.online?.price ?? 0)
            : (classData.modes?.offline?.price ?? 0)
          resolvedTextbookAmount = classData.textbook?.included ? (classData.textbook?.price ?? 0) : 0
          resolvedTotalAmount = resolvedModePrice + resolvedTextbookAmount
        }
      }
    } catch { /* 조회 실패 시 기존 switch 사용 */ }

    let surinonseulRegular = ''
    let surinonseulTrial = ''
    let sunungSelect = ''
    let sunungRegular = ''

    const isOfflineChoice = courseType?.includes('offline')

    // 커스텀 라벨이 있으면 switch 건너뜀
    // (단, 커스텀 라벨은 관리자가 미리 써둔 고정 텍스트라 학생이 실제 고른 캠퍼스를 담고 있지 않으므로,
    //  오프라인 신청인 경우 라벨 뒤에 실제 선택 캠퍼스를 항상 붙여준다 — 안 그러면 어느 지점인지 시트에서 사라짐)
    if (customLabel) {
      surinonseulRegular = isOfflineChoice && campus
        ? `${customLabel}ㅣ${campus}`
        : customLabel
    } else switch (courseType) {
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

    const isTextbook = courseType?.includes('week10')
    const targetSheet = isTextbook ? SHEET_NAME_TEXTBOOK : SHEET_NAME

    // 최종 청구 금액 — 일반 수업은 관리자 설정 기준 서버 계산값을 우선 사용,
    // (10주차처럼 courseId가 없어 계산이 안 되는 레거시 페이지는 클라이언트 값을 대체로 사용)
    const finalTotalAmount   = resolvedTotalAmount ?? (typeof clientTotalAmount === 'number' ? clientTotalAmount : null)
    const totalAmountLabel   = finalTotalAmount !== null ? `${finalTotalAmount.toLocaleString()}원` : ''

    try {
      const sheets = await getGoogleSheetsClient()

      let rowData: string[]

      if (isTextbook) {
        // textbook 시트: A~M은 기존 신청/추적 컬럼(J~M: 결제상태/문자발송/청구서발송/청구서ID)이라 건드리지 않고,
        // 청구 금액 관련 값은 그 뒤(N, O)에 새로 추가
        rowData = [
          formattedTimestamp,   // A: 타임스탬프
          studentName,          // B: 학생 이름
          studentPhone,         // C: 학생 연락처
          parentPhone,          // D: 학부모님 연락처 (결제)
          campus || '',         // E: 캠퍼스
          textbookOption || '', // F: 교재 선택
          zipCode || '',        // G: 우편번호
          address || '',        // H: 주소
          addressDetail || '',  // I: 상세주소
          '',                   // J: 결제 상태 (apply_checker가 기록)
          '',                   // K: 문자 발송 (apply_checker가 기록)
          '',                   // L: 청구서 발송 (apply_checker가 기록)
          '',                   // M: 청구서 ID (apply_checker가 기록)
          totalAmountLabel,      // N: 청구 금액 (신규)
        ]
      } else {
        // 수업 신청 시트: A~U
        // (M~P는 apply_checker.py가 결제상태/문자발송/청구서발송/청구서ID 기록용으로 쓰는 고정 위치라 손대지 않음.
        //  Q,R,T는 10주차 교재신청 전용 예비 컬럼이라 일반 신청에선 항상 비어있어서 S를 "청구 금액"으로 사용.
        //  U열에 학생이 실제 선택한 캠퍼스를 별도로 기록 — 라벨 텍스트 안에 묻혀서 안 보이는 문제 방지)
        rowData = [
          formattedTimestamp,
          userType === '학생' ? '학생 본인' : (userType || '학생 본인'),
          studentName,
          parentPhone,
          studentPhone,
          birthYear || '',
          surinonseulRegular,
          surinonseulTrial,
          sunungSelect,
          sunungRegular,
          confirmPayment ? '넵, 확인하였습니다.' : '',
          agreePrivacy ? '넵, 동의합니다.' : '',
          '', '', '', '',
          textbookOption || '',
          zipCode || '',
          totalAmountLabel,                       // S: 청구 금액
          addressDetail || '',
          isOfflineChoice ? (campus || '') : '',   // U: 선택 캠퍼스 (오프라인일 때만)
        ]
      }

      await sheets.spreadsheets.values.append({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: `${targetSheet}!A:J`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [rowData] }
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
