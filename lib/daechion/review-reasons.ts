// Shared by the administrator screen and the operational Sheets projection.
// Unknown codes stay actionable instead of exposing internal implementation names.
const reasons:Readonly<Record<string,string>>=Object.freeze({
  identity_declaration_missing:'기존·신규 선택 정보 없음',
  identity_declaration_mismatch:'신청 선택과 기존 번호 기록이 다름',
  student_identity_review:'대상 학생을 확정할 수 없음',
  guardian_identity_review:'보호자 연결 확인 필요',
  identity_lookup_failed:'대치온 조회 실패',
  identity_lookup_invalid:'번호 조회 결과 확인 필요',
  identity_lookup_changed:'조회 도중 학생 정보 변경',
  identity_binding_changed:'기존 확정 계정과 조회 결과가 다름',
  identity_phone_busy:'같은 번호의 다른 신청 확인 필요',
  identity_create_unknown:'계정 생성 결과 확인 필요',
  bill_send_unknown:'청구서 발송 결과 확인 필요',
  payment_query_unknown:'결제선생에서 결제 여부를 확인하지 못함',
  unpaid_wait_closed:'미납 확인 후 7일 자동 등록 대기 종료',
  payment_cancelled:'결제 취소·파기 확인',
  payment_state_regressed:'기존 결제 기록과 현재 조회 결과가 다름',
  payment_amount_mismatch:'청구 금액과 결제 금액이 다름',
  payment_time_unknown:'결제 승인일시 확인 필요',
  payment_evidence_changed:'기존 결제 승인 기록과 조회 결과가 다름',
  late_payment:'자동 등록 대기 기한 이후 결제',
  enrollment_unknown:'대치온 등록 결과 확인 필요',
  enrollment_fence_changed:'등록 도중 결제·보류 상태가 변경됨',
  enrollment_tenant_mismatch:'대치온 학원 연결 정보 불일치',
  manual_hold:'관리자가 자동 처리를 보류함',
  manual_access_revoked:'대치온 수동 권한 회수 완료 기록',
  admin_payment_confirmed:'관리자가 결제 확인을 기록함 — 등록은 보류 중',
  manual_access_recorded:'대치온 수동 등록 완료 기록',
})

export function reviewReasonLabel(code:string|null|undefined):string {
  return code?(Object.prototype.hasOwnProperty.call(reasons,code)?reasons[code]:'담당자 확인 필요'):''
}
