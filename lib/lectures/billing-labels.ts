export function billingStateLabel(value:string|null){
 return ({PENDING:'발송 대기',SENDING:'발송 결과 확인 중',SENT:'발송 확인',UNKNOWN:'발송 확인 필요',STOPPED:'자동 발송 중지'} as Record<string,string>)[value??'']??'청구서 없음'
}
export function externalStateLabel(value:string|null){
 return ({F:'결제 완료',W:'미납',C:'외부 취소',D:'청구 무효',ERROR:'조회 실패'} as Record<string,string>)[value??'']??'조회 전'
}
export function billingReviewLabel(value:string|null){
 return ({STALE_RESULT:'주문 변경 또는 작업 기한 경과로 이전 결과를 반영하지 않았습니다.',SEND_UNKNOWN:'발송 결과를 확인할 수 없습니다.',LATE_SEND_RESULT:'처리 도중 주문이 변경됐거나 발송 결과가 늦게 도착했습니다.',
 LOOKUP_ERROR:'외부 조회에 실패했습니다.',BILL_MISMATCH:'조회된 청구 ID가 다릅니다.',AMOUNT_MISMATCH:'조회 금액이 주문 금액과 다릅니다.',
 EXTERNAL_CANCEL:'결제선생에서 취소가 확인됐습니다. 권한 회수 여부를 판단해주세요.',EXTERNAL_VOID:'청구서가 무효 상태입니다.',
 PAYMENT_AFTER_MANUAL_CLOSE:'수동 회수·종료한 주문에 결제 완료가 조회됐습니다. 자동으로 다시 열지 않았습니다.',
 PAID_EXTERNAL_DIFFERENCE:'결제 완료 기록과 현재 외부 미납 상태가 다릅니다.',
 MANUAL_EXTERNAL_DIFFERENCE:'수동 승인과 외부 조회 상태가 다릅니다.',LATE_PAYMENT:'종료한 주문에 결제 완료가 조회됐습니다.',
 ITEMS_MISMATCH:'주문 명세와 금액을 대조해주세요.',RIGHTS_CONFLICT:'기존 수강 권한과 구매 근거를 대조해주세요.',
 OVERDUE_REVIEW:'7일이 지났으나 외부 청구가 유효합니다. 직접 확인 후 정리해주세요.',
 SEND_TIME_UNKNOWN:'청구서 발송 시각이 확인되지 않아 결제 기한을 확정하지 않았습니다.'} as Record<string,string>)[value??'']??'결제선생 내역과 주문을 직접 확인해주세요.'
}
