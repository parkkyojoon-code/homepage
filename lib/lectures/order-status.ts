export function orderStatus(status: string) {
  switch (status) {
    case 'CREATED': return { label: '주문 접수', detail: '주문이 저장되었습니다. 청구서 발송을 준비하고 있습니다.' }
    case 'AWAITING_PAYMENT': return { label: '결제 대기', detail: '받으신 결제선생 청구서에서 결제를 진행해주세요.' }
    case 'PAID': return { label: '결제 완료', detail: '결제가 확인되었습니다.' }
    case 'CANCELLED': return { label: '주문 취소', detail: '취소된 주문입니다.' }
    case 'EXPIRED': return { label: '결제 기한 만료', detail: '결제 기한이 지났습니다.' }
    case 'REFUNDED': return { label: '환불 완료', detail: '환불된 주문입니다.' }
    default: return { label: '상태 확인 필요', detail: '주문 상태를 확인할 수 없습니다. 관리자에게 문의해주세요.' }
  }
}
