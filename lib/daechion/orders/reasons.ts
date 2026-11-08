import {reviewReasonLabel} from '../review-reasons'

const reasons:Record<string,string>={billing_preflight_review:'청구 전 학생·상품 확인 필요',bill_collision:'청구 번호 중복 확인 필요',billing_account_mismatch:'결제선생 계정 연결 불일치',
  admin_hold:'관리자가 자동 처리를 보류함',
  worker_execution_unknown:'주문 작업자 처리 결과 확인 필요 — 자동 재실행 보류',
  identity_unknown:'학생 조회·생성 처리 결과 확인 필요',identity_create_unknown:'학생 생성 결과 확인 필요 — 재생성 금지',identity_review:'학생·보호자 번호와 기존 수강 여부 대조 필요',identity_phone_busy:'같은 번호의 다른 등록 처리 확인 필요',
  grant_unknown:'강의 등록·영상·자료 권한 확인 필요',order_held:'주문 보류로 권한 처리 중단',payment_regressed:'기존 결제와 현재 조회 결과가 다름',
  message_result_unknown:'안내 문자 발송 결과 확인 필요 — 재발송 금지',message_lease_expired:'안내 문자 처리 중단·발송 결과 확인 필요',
  sheet_publish_unknown:'시트 반영 결과 확인 필요',sheet_read_retry:'시트 조회 재확인 대기',sheet_headers_changed:'시트 열 제목 변경 확인 필요',sheet_not_initialized:'주문 전용 탭 초기 설정 필요'}
export function orderReason(code:unknown){
  if(typeof code!=='string'||!code)return ''
  if(reasons[code])return reasons[code]
  const known=reviewReasonLabel(code)
  return known==='담당자 확인 필요'?`담당자 확인 필요 (${/^[a-z_]{1,64}$/.test(code)?code:'unknown'})`:known
}
