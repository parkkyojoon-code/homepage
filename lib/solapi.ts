import crypto from 'crypto'

// 환경변수
const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY || ''
const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET || ''
const SOLAPI_SENDER = process.env.SOLAPI_SENDER || '01084431621'
const SOLAPI_PFID = process.env.SOLAPI_PFID || '@박교준'

// 알림톡 템플릿 ID
const TEMPLATE_APPLY = process.env.SOLAPI_TEMPLATE_APPLY || 'UWglTOEtfO'      // 신청 확인
const TEMPLATE_CONFIRM = process.env.SOLAPI_TEMPLATE_CONFIRM || '17MH3TR9sM'  // 결제 확정

/**
 * HMAC-SHA256 시그니처 생성
 */
function generateSignature(apiSecret: string, dateTime: string, salt: string): string {
  const data = dateTime + salt
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(data)
    .digest('hex')
  return signature
}

/**
 * Authorization 헤더 생성
 */
function createAuthHeader(apiKey: string, apiSecret: string): string {
  const dateTime = new Date().toISOString()
  const salt = crypto.randomBytes(16).toString('hex')
  const signature = generateSignature(apiSecret, dateTime, salt)
  
  return `HMAC-SHA256 apiKey=${apiKey}, date=${dateTime}, salt=${salt}, signature=${signature}`
}

/**
 * 솔라피 SMS 발송
 */
export async function sendSMS(
  to: string,
  text: string,
  from?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const authHeader = createAuthHeader(SOLAPI_API_KEY, SOLAPI_API_SECRET)
    
    const response = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        message: {
          to: to.replace(/-/g, ''),
          from: from || SOLAPI_SENDER,
          text: text
        }
      })
    })

    const result = await response.json()

    if (response.ok && result.groupId) {
      return { success: true, messageId: result.groupId }
    } else {
      return { success: false, error: result.errorMessage || '발송 실패' }
    }
  } catch (error) {
    console.error('SMS 발송 오류:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * 솔라피 알림톡 발송
 */
export async function sendAlimtalk(
  to: string,
  templateId: string,
  variables: Record<string, string>,
  from?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const authHeader = createAuthHeader(SOLAPI_API_KEY, SOLAPI_API_SECRET)
    
    const response = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        message: {
          to: to.replace(/-/g, ''),
          from: from || SOLAPI_SENDER,
          kakaoOptions: {
            pfId: SOLAPI_PFID,
            templateId: templateId,
            variables: variables
          }
        }
      })
    })

    const result = await response.json()

    if (response.ok && result.groupId) {
      return { success: true, messageId: result.groupId }
    } else {
      return { success: false, error: result.errorMessage || '발송 실패' }
    }
  } catch (error) {
    console.error('알림톡 발송 오류:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * 수강신청 확인 알림톡 발송
 * 변수: #{수업명}, #{이름}
 */
export async function sendApplyAlimtalk(
  studentName: string,
  parentPhone: string,
  courseName: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendAlimtalk(parentPhone, TEMPLATE_APPLY, {
    '#{수업명}': courseName,
    '#{이름}': studentName
  })
}

/**
 * 결제 확정 알림톡 발송
 * 변수: #{수업명}, #{이름}, #{개강일정}
 */
export async function sendConfirmAlimtalk(
  studentName: string,
  parentPhone: string,
  courseName: string,
  schedule: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendAlimtalk(parentPhone, TEMPLATE_CONFIRM, {
    '#{수업명}': courseName,
    '#{이름}': studentName,
    '#{개강일정}': schedule
  })
}

/**
 * 수강신청 확인 SMS 발송 (알림톡 실패시 대체)
 */
export async function sendApplyConfirmSMS(
  studentName: string,
  parentPhone: string,
  courseName: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // 먼저 알림톡 시도
  const alimtalkResult = await sendApplyAlimtalk(studentName, parentPhone, courseName)
  
  if (alimtalkResult.success) {
    console.log('알림톡 발송 성공')
    return alimtalkResult
  }
  
  // 알림톡 실패시 SMS로 대체
  console.log('알림톡 실패, SMS로 대체 발송')
  const message = `${courseName} 수업 신청

${studentName}님 안녕하세요!!

박교준 선생님의
${courseName} 수업을
신청해주셔서 감사합니다.

학부모님 카카오톡으로 결제선생이 발송되었습니다.
● 수업 확정을 위해 수강료 납부 부탁드립니다.

※ 납부 확인 즉시,
수업 확정 안내드리겠습니다.
★ 10명 중 9명이 합격한 수업

이제 다음은 ${studentName}님의 차례입니다.`

  return sendSMS(parentPhone, message)
}
