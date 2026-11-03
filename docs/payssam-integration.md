# PaySsam V2 시제품 기록 (현재 출시 경로는 V1)

현재 결정: DB와 앱은 사용자와 이 작업에서 함께 개발한다. 별도 DB 담당자/010~019 예약 파일을 기다리지 않는다. 출시 경로는 검증된 기존 V1 조회를 재사용하며, 아래 V2 시제품은 운영에 연결하지 않는다. 취소·파기·만료 예외는 관리자 직접 확인 후 수동 오픈/회수한다.

공식 명세 확인일: 2026-11-03.
https://developers.payssam.kr/api/api-v2/send
https://developers.payssam.kr/api/api-v2/bill.md
https://developers.payssam.kr/api/api-v2/call-back.md
https://developers.payssam.kr/preparation/environment.md
https://developers.payssam.kr/api/api-v2/error-code.md

## 구현
`lib/lectures/payssam.ts`: TALK 청구서 생성(/bill), 단건 상태 조회(/bill/read), 공급자 응답 검증. 실제 계정 정보·URL은 포함하지 않는다. enabled가 false면 네트워크 요청을 하지 않는다. 테스트는 가짜 transport로만 실행한다.

`lib/lectures/payment-policy.ts`: 서버 조회로 만든 receipt만 수락하고 주문별 청구서 ID와 정확한 금액을 대조한다. 이전 대기 통보로 결제·환불 상태를 되돌리지 않는다. 불일치는 자동 처리하지 않는다.

HTTP 성공만으로 청구서 성공으로 간주하지 않는다. 공급자 성공 코드·반환 청구서·계정·hash를 확인한다. timeout·중복 ID·확인 불가 응답은 UNKNOWN이며 새 ID로 무조건 다시 발송하지 않는다. 요청·응답에는 비밀정보가 있으므로 로그에 출력하지 않는다.

## 아직 연결하지 않은 부분
현재 앱 라우트에서 이 모듈을 호출하지 않는다. 청구서 발송·결제 상태 갱신·자동 권한 부여는 아직 작동하지 않는다. 이 작업에서 구성할 결제 원장과 개발 DB에 연결해야 한다.

필요한 DB 계약(제안, 미적용): 주문에 연결된 고유 billId, 발송 전 저장된 청구 금액·수신 번호, PENDING/SENT/FAILED/UNKNOWN 발송 상태, 결제 처리 기록, 공급자 처리 결과. 새 결제 마이그레이션은 현재 파일 이후 번호로 추가하며 기존 적용 파일을 수정하지 않는다.

통합 순서:
1. 주문·가격을 확정하고 청구 ID와 발송 작업을 DB에 먼저 저장한다.
2. 작업자가 해당 ID로 발송한다. 응답 유실은 UNKNOWN으로 두고 동일 ID 조회로 조정한다.
3. 콜백 API는 크기·형식·apiKey 검증과 요청 제한 후, 저장된 billId를 서버 측 /bill/read로 다시 확인한다. 콜백의 금액·상태만 믿지 않는다.
4. 외부 조회 완료 후 DB 트랜잭션에서 주문을 잠그고 billId·금액·현재 상태를 재검증한다.
5. PAID와 해당 주문 항목별 권한을 같은 트랜잭션에서 기록한다. 취소 시 해당 구매 근거만 회수한다. 처리 기록의 중복 제약도 적용한다.
6. DB 커밋 후에만 콜백에 {"code":"0000"}을 반환한다. 실패 시 성공 응답을 보내지 않는다.
7. 정기 조회로 콜백 누락·환불 상태도 조정한다. 현재 승인 콜백 명세는 F만 통보한다고 설명한다.

필요한 외부 설정: Sandbox API Key, member, merchant, HTTPS 콜백 URL, 운영 시 공급자가 제공하는 V2 base URL, 계정 TALK 사용 가능 여부. 키는 채팅에 붙여넣지 말고 서버 환경변수로 설정한다. Sandbox V2 base URL은 https://sandbox.paymint.co.kr/partner 이다. 문서상 Sandbox 20,000원 미만 청구는 제한되고 운영 기본 최소 청구는 100원이다. 실제 가격을 테스트 편의를 위해 자동 변경하면 안 된다.

현재 read 파서는 apprPrice가 없는 미결제·파기 응답을 UNKNOWN으로 처리한다. Sandbox에서 실제 W/D 응답의 금액 필드 유무를 확인하고, 공급자 계약에 맞춰 상태별 검증을 확정해야 한다. 부분 취소·나눠서 결제는 지원하지 않는다. 모듈은 운영 활성화 전 공급자 Sandbox 검수가 필요하다.
