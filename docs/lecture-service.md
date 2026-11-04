# 강의 서비스 개발 현황

2026-11-04. 코드와 별도 Railway 검증 환경에서 확인한 상태를 기록한다. 기존 운영 홈페이지 master의 병합·배포 완료를 뜻하지 않는다.

## 현재 출시 우선순위

2026-11-04 사용자 결정: 11월 중순부터 12월 초까지 약 2~3주 집중 운영을 기준으로 한다. Railway Pro 전환·기본 자동 백업 도입은 보류하고 Hobby로 개발을 이어간다. 기존 수업 신청 화면에 맞춘 현재 UI·폰트는 승인된 기준으로 유지한다. 실제 영상과 결제선생 연결, 수동 권한 대응, 출시 점검을 우선한다. 백업 도구는 보존하지만 유료 요금제 전환을 출시의 필수 조건으로 삼지 않는다. 운영 종료 후 데이터 보관·서비스 정지는 별도 결정한다.

결제 작업자 연결은 먼저 `python workers/lectures/worker.py --check`로 확인한다. 이 점검은 인증된 내부 health API와 DB 청구 스키마만 읽으며 청구 작업 확보·외부 공급자 호출·권한 변경을 하지 않는다. 실제 결제선생 키 검증·청구 검수는 별도다.

## 기존 기능과 분리

기존 Sheets 신청/청구, 학생 JSON, 기존 관리자 환경변수와 인증 코드는 유지한다. 신규 구매자와 관리자만 신규 PostgreSQL에 저장한다. 신규 관리자 쿠키는 lectures_admin_session이며 기존 admin_session/my_session을 인정하지 않는다. LECTURES_APP_ORIGIN은 실제 웹 Origin(끝 슬래시 제외)으로 설정한다.

같은 사이트가 소유한 추가 도메인이 있으면 LECTURES_ADDITIONAL_ORIGINS에 정확한 Origin을 쉼표로 구분해 설정한다. 기본 Origin 설정 없이 추가 Origin만 설정하는 것은 허용하지 않는다. 경로·와일드카드·잘못된 값이 있으면 쓰기 요청을 거절한다. 운영 pkjmath.com/www.pkjmath.com의 동시 이용을 위한 설정이며 기본값은 추가 허용 없음이다.

## 개발 DB 준비

DB 설계·구축·연결은 사용자와 이 작업에서 함께 진행한다. 별도 DB 담당자의 결과물/예약 마이그레이션에 의존하지 않는다. 기존 Sheets/학생 파일 전체 이전은 이번 출시와 분리한다.

`.env.lectures.example`의 필요한 항목을 `.env.local`에 복사한다. 실제 PostgreSQL 연결 문자열은 LECTURES_DATABASE_URL에만 넣으며 Git/채팅에 올리지 않는다. CLI와 Next 앱이 같은 설정을 읽는다. 프로덕션은 Railway 환경변수로 설정한다. CLI의 기본 검색 경로와 앱의 검색 경로는 public이다.

신규 DB 준비 순서:
1. `npm run db:lectures:status`: 연결과 적용/대기 파일 확인. 테이블을 생성하지 않는다.
2. `npm run db:lectures:migrate -- --database 실제DB이름`: 대상 이름 대조 후 대기 SQL을 순서대로 적용한다. 앱 시작/빌드에서는 자동 실행하지 않는다.
3. `npm run db:lectures:check`: 연결 및 모든 마이그레이션 적용 상태 확인. 대기 파일이 있으면 실패한다.
4. 아래 최초 총괄 관리자 설정 후 로그인/실제 주문 흐름 검증.

현재 파일 순서는 001 → 020 → 021 → 030 → 031 → 032 → 033 → 034 → 035이다. 파일별 트랜잭션으로 구조와 이력을 함께 저장하고, 완료한 파일은 재실행하지 않는다. 체크섬은 Windows/Linux 줄바꿈에 영향을 받지 않는다. 적용 후 SQL 수정/누락/순서 충돌은 중단한다. 동시 migrate는 PostgreSQL advisory lock으로 막는다.

기존 테이블이 있는데 이력이 없는 DB에는 자동 적용하지 않는다. 수동 SQL을 이미 적용한 경우 현재 구조를 확인하고 별도 이력 정합 절차를 검토해야 한다. 이 오류를 피하려고 기존 데이터를 삭제하지 않는다. 운영에 연결하기 전 백업·권한·TLS·실제 연결 대상을 확인한다. DB 이름 일치는 서버까지 맞다는 보장이 아니므로 Railway 서비스 선택도 확인한다.

LECTURES_DATABASE_URL은 환경별로 별도 설정한다. Railway 내부 주소는 같은 프로젝트/연결 가능한 서버에서, 로컬 개발은 외부에서 접근 가능한 URL을 사용해야 할 수 있다. TLS 설정은 제공된 URL/인증서에 맞추며 인증서 검증을 임의로 끄지 않는다. 실행 도구는 URL·비밀번호·비밀키를 출력하지 않는다. 별도 검증 프로젝트에서는 PostgreSQL 18.6 연결과 035까지 마이그레이션 적용을 확인했다. 기존 운영 DATA_DIR·Volume 이전과 실제 Railway 백업·복원은 별도 확인 대상이다.

DB 연결 대기는 10초, 문장 실행 제한은 30초로 설정했다. 신규 DB 호출 실패가 무한 대기하거나 유휴 연결 오류로 기존 홈페이지 프로세스를 종료시키지 않도록 한다. 신규 기능만 DB에 의존하고 기존 로그인·신청 경로는 그대로 유지한다.

## 첫 총괄 관리자

scripts/bootstrap-lecture-admin.cjs를 서버 측에서 실행한다. 필요한 환경변수:
- LECTURES_DATABASE_URL
- LECTURES_BOOTSTRAP_USERNAME: 영문 소문자/숫자/밑줄 3~40자
- LECTURES_BOOTSTRAP_NAME: 1~50자
- LECTURES_BOOTSTRAP_PASSWORD: 12~128자

실행: npm run db:lectures:bootstrap-admin (.env.local 또는 서버 환경변수 사용)

공개 초기화 API·기본 비밀번호가 없다. 관리자가 이미 있으면 중단한다. 성공 후 BOOTSTRAP 변수는 제거한다. 실제 비밀번호를 명령줄 인자·문서·터미널 출력에 넣지 않는다. 첫 관리자 생성과 비상 복구는 배포 담당자가 직접 관리하는 서버 작업이다.

## 화면

- /lectures: 판매 강의와 내 주문
- /lectures/login: 구매자 가입/로그인
- /lectures/orders/[id]: 본인 주문 상세
- /lectures/classroom: 활성 구매 강의
- /admin/lectures/login: 개인 관리자 로그인
- /admin/lectures: 강의 관리
- /admin/lectures/orders: 주문 검색·수동 오픈/회수/복원·미납 종료·처리 이력
- /admin/lectures/accounts: OWNER의 관리자 초대·역할 변경·중지·복구
- /admin/lectures/users: 구매자 검색·본인 확인 후 비밀번호 초기화
- /lectures/change-password: 임시 비밀번호 로그인 후 새 비밀번호 설정
- /admin/lectures/activate: 초대/복구 링크로 비밀번호 직접 설정

OWNER/OPERATOR 모두 강의와 주문을 처리할 수 있다. 계정 관리는 OWNER 전용이다. 마지막 활성 OWNER 제거를 직렬화된 계정 변경으로 차단한다. 초대 대기 OWNER는 대체 OWNER로 계산하지 않는다. 역할 변경/중지/복구 발급 시 세션을 폐기한다. 관리자 세션은 8시간, 초대/복구 링크는 30분·일회용이며 해시만 저장한다. 계정 로그인 실패 제한은 15분에 10회다.

## 수동 처리 계약

POST /api/lectures/admin/orders/[id]/access:
{action: OPEN|CLOSE|RESTORE|CLOSE_UNPAID, expectedVersion, expectedTotalWon, requestKey, reason, checkedAt: ISO시각, confirmed:true}

관리자 주체는 세션으로 결정하며 본문의 임의 operatorName을 받지 않는다. 주문 잠금·버전·금액 대조 후 권한/주문/관리자 이력을 원자 저장한다. 같은 요청키/같은 본문은 재시도 가능하고 다른 내용은 409다. 네트워크 결과 불명 시 원래 요청을 유지해서 재시도한다.

자동 승인 원본도 CLOSE 가능하다. CLOSE는 원래 PAID를 유지하고 MANUAL_CLOSED 및 해당 주문의 권한 회수로 기록한다. RESTORE는 결제 재확인 후 기존 구매 항목의 권한을 복원한다. 다른 주문의 권한은 유지된다. 접근 검사에서 권한 행뿐 아니라 원본 주문의 PAID와 MANUAL_CLOSED 여부도 확인한다. 실제 환불/파기를 호출하지 않는다. CLOSE_UNPAID는 외부 미납·청구 무효화 직접 확인 후 종료다.

구형 /confirm, /revoke는 410으로 종료한다. 구형 수동 승인/정정 SQL 함수는 시제품 회귀 검사와 과거 기록 보존용으로 남아 있으나 새 HTTP 처리에서는 호출하지 않는다.

GET /api/lectures/admin/orders?status=pending|paid|corrected|all&q=...&page=... 는 20건 페이지 목록을 반환한다. GET /api/lectures/admin/orders/[id]/access는 최근 관리자 처리 이력 100건을 반환한다. 학생 화면에는 관리자 메모를 반환하지 않는다.

## 구매자 비밀번호 초기화

OWNER/OPERATOR 모두 /admin/lectures/users에서 아이디·이름·전화번호로 구매자를 검색한 뒤 대상과 본인 확인 근거를 입력해 초기화한다. 이 기능은 기존 학생 JSON 계정과 무관하며 신규 강의 구매자만 대상으로 한다.

POST /api/lectures/admin/users/[id]/reset-password:
{expectedCredentialVersion, requestKey, reason, confirmed:true}

서버가 무작위 임시 비밀번호를 생성한다. 해시만 저장하고 발급 응답에 한 번만 표시한다. 30분간 유효하며 관리자가 본인 확인한 학생에게 직접 전달한다. 재시도한 같은 요청은 새로 초기화하지 않고 비밀번호도 다시 표시하지 않는다. 전달하지 못했다면 계정을 새로 조회하고 새 요청으로 재발급한다.

초기화 시 비밀번호 버전 증가·기존 세션 폐기·확인 근거 이력을 원자 처리한다. 로그인 때 해시 검증 이후 세션 생성 직전에 현재 비밀번호를 다시 대조해 초기화와 경합한 옛 로그인 요청을 차단한다. 임시 로그인은 변경 전 주문/강의 접근이 제한된다. POST /api/lectures/auth/change-password에서 새 비밀번호를 설정하면 제한을 해제하되 기존 세션은 모두 폐기하고 새 비밀번호로 재로그인한다. 임시 비밀번호와 같은 비밀번호는 거절한다.

초기화 후 다시 정상 비밀번호를 설정한 뒤에도 이전 인증 버전의 진행 중 주문 요청은 주문 저장 직전 버전 검사로 거절한다. 다른 계정·기존 주문·수강 권한은 초기화 때문에 변경하지 않는다.

## 청구 발송·자동 확인 구현

현재 출시 경로는 V1이며 lib/lectures/payssam.ts의 과거 V2 시제품은 호출하지 않는다. 별도 Python worker는 workers/lectures에 있다. 별도 Railway 검증 환경에서 연결 점검과 사용자 승인에 따른 실제 1,200원 청구·결제·자동 권한 부여를 확인했다. 운영 홈페이지 연결은 별도다. 설정과 배포 방법은 workers/lectures/README.md를 따른다. 기본 비활성이고 별도 SEND 활성화 값도 필요하다.

주문 계약은 아래 형식으로 변경했다. 화면·API·DB·테스트를 함께 반영했으므로 예전 lectureIds 요청을 혼합 배포하지 않는다.
{items:[{lectureId,expectedPriceWon}],requestKey,expectedTotalWon,billingRecipient:{type:SELF|GUARDIAN,name,phone}}

서버가 개별 가격·합계·SELF 본인 정보를 대조하고 주문/항목/수신자/고정 청구 ID/발송 요청을 원자 저장한다. 같은 키의 다른 수신자·가격은 거절한다. checkout은 첫 요청 내용을 보관해 응답 유실/재접속 시 같은 본문으로 재시도한다. 실제 결제·수강 권한은 보호자가 아닌 구매자에게 연결된다. 과거 주문에는 자동 청구 요청을 소급 생성하지 않는다.

worker API: POST /api/lectures/internal/billing/claim 및 /result. 별도 기계용 Bearer 토큰과 작업 토큰을 검사한다. SEND claim은 PENDING만, READ claim은 발송 확인/결과 불명/발송 lease 만료 건을 처리한다. DB 트랜잭션 밖에서 공급자를 호출하고 결과 반영 직전 주문 잠금·현재 버전·수동 보호를 확인한다. 금융 상태/권한/조회 이벤트는 원자 반영한다. 결과 이벤트는 동일 claim 재보고를 멱등 처리한다.

F는 정확한 ID/금액이 맞고 AUTO이며 열린 미납 주문일 때만 자동 승인한다. MANUAL_CLOSED는 F가 반복돼도 자동으로 열리지 않는다. 미해결 C는 유지하고 권한은 관리자가 회수한다. 7일 후 W/오류는 관리자 검토이며 외부 파기는 자동 실행하지 않는다. 확인된 D의 기한 경과 미납만 종료하고 늦은 F는 검토한다.

관리자 수동 처리는 미시작 PENDING 발송을 STOPPED로 바꾸고 기존 검토를 처리한다. 이미 외부 발송이 시작된 것을 취소할 수 있다고 보장하지 않는다. 변경된 주문의 늦은 결과는 상태를 되돌리지 않는다. 실제 취소/환불/파기는 결제선생에서 직접 처리한다.

## 관리자 재조회·자동 처리 복귀

관리자 주문 화면에서 결제 상태 다시 조회를 요청한다. POST /api/lectures/admin/orders/[id]/billing은 {expectedVersion,requestKey}를 받아 현재 주문 버전을 확인하고 재조회 요청·처리자를 저장한다. 실제 외부 조회는 worker가 수행한다. 요청 도중 진행 중이던 이전 READ는 해당 요청을 완료 처리하지 않고, 다음 READ로 확인한다. 대기 중인 관리자 요청은 일반 주기 조회보다 우선한다. 같은 요청 재시도는 같은 기록을 반환한다.

GET 같은 경로는 최근 발송/조회 이벤트와 관리자 재조회 요청을 각각 최대 50건 반환한다. 키·claim 토큰·응답 원문은 반환하지 않는다. 요청 결과 수신과 결제 완료는 다른 상태다. 조회 오류도 결과 수신으로 표시되며 자동 복귀 근거로 사용할 수 없다.

RESUME_AUTO는 기존 /access 명령에 추가했다. 현재 PAID이고 수동 보호 중인 주문에만 허용한다. 수동 결정 이후 현재 주문 버전에 대해 받은 F·동일 청구 ID·정확한 금액의 이벤트가 필요하다. 5분 이내의 유효한 결과, 진행 중 작업 없음, 대기 재조회 없음도 확인한다. 목록의 버튼 조건과 서버 검사에 같은 SQL을 사용한다. 조회 오류·금액/ID 불일치·기한 경과·오래된 작업 결과는 수동 보호를 풀지 못한다.

MANUAL_CLOSED에서 복귀하면 해당 구매의 권한을 복원하고 AUTO로 전환하므로, 화면에 다시 열린다는 안내와 명시 확인을 제공한다. MANUAL_OPEN에서는 접근을 유지한다. 변경·권한·처리자·사유·복귀 근거 조회 이벤트 ID를 원자 저장한다. 실제 결제 취소/환불/청구 재발송은 실행하지 않는다. 미납/종료 주문을 자동 복귀로 재결제시키지 않으며, 연결된 조회 가능한 청구서가 없는 수동 주문은 수동 관리를 유지한다.

홈페이지의 workerEnabled는 API 활성화 설정 여부이며 작업자 실제 가동을 보장하는 health check가 아니다. 비활성일 때 재조회/자동 복귀를 막고 수동 처리는 허용한다. 요청 후 화면은 최대 약 50초 동안 5초 간격으로 확인하고, 대기가 계속되면 새로고침 또는 직접 확인을 안내한다.

034 적용과 이 코드 배포는 같은 변경 단위다. 기존 데이터가 있는 신규 강의 서비스에 업그레이드한다면 worker를 정지하고 진행 중 작업을 확인한 뒤 마이그레이션·웹 코드 전환·검증 후 재가동한다. 034 이전 웹 코드와 혼합 운영하지 않는다. 기존 register_checker/Sheets 서비스는 정지하거나 수정하지 않는다. 검증 환경에는 035까지 적용돼 있다.

## 강의 수정·변경 이력과 구매자 주문 목록

035는 lectures.version과 lecture_catalog_changes를 추가한다. 강의 등록/수정은 개인별 관리자 세션을 트랜잭션 안에서 재검증하고 변경 이력과 함께 저장한다. 수정 요청에는 expectedVersion이 필수이며 최신 값과 다르면 409 LECTURE_VERSION_CONFLICT다. 입력 내용을 보존하고 최신 내용 비교·다시 불러오기를 제공하며 자동으로 덮어쓰지 않는다. 변경 이력은 최근 50건까지 전후 값·실제 관리자·시각을 보여 준다. 이력 수집 이전 작업자를 임의로 추정하지 않는다. 기존 주문의 가격 스냅샷은 변경하지 않는다.

GET /api/lectures/orders?page=1은 {orders,total,page,pageSize}로 변경했다. 20건씩 본인 주문만 조회하며 100건 이후도 페이지로 접근한다. 같은 생성 시각에도 id 내림차순으로 고정하고, 총수/목록은 같은 SQL 스냅샷에서 얻는다. 기존 배열 응답을 쓰는 클라이언트와 혼합 배포하지 않고 /lectures 화면도 함께 반영한다.

## 첫 개발 브랜치 업로드

사용자가 제공한 2026-11-04 Railway 홈페이지 설정 화면에서 source=parkkyojoon-code/homepage, production branch=master, GitHub 자동 배포 활성, Wait for CI 비활성을 확인했다. 개발 업로드 대상은 codex/lecture-service이며 master에는 push/merge하지 않는다. 개발 브랜치 push에도 검사 workflow가 실행되도록 했다. GitHub 검사 통과와 운영 배포 승인은 별개다.

업로드 전 scripts/check-lecture-secrets.cjs로 비밀값 패턴/민감 파일을 검사한다. 실제 .env/인증키/업로드 ZIP은 포함하지 않는다. 패턴 검사는 알려지지 않은 모든 비밀값 부재를 보증하는 검사는 아니다.

로컬에 기존 설치된 PostgreSQL 12로 별도의 테스트 클러스터를 만들어 업무 흐름과 다중 연결 잠금을 추가 확인했다. 운영 엔진으로 선택/권장한 것이 아니며 GitHub CI에서는 PostgreSQL 16으로 같은 검사를 수행한다. Railway DB·실제 결제 검수 결과는 아래와 구분해 기록한다.

실제 PostgreSQL 테스트는 LECTURES_TEST_POSTGRES_URL에 loopback의 lecture_test_* 또는 lecture_ci DB만 허용한다. 테스트마다 임의의 전용 스키마를 만들고 끝나면 그 스키마만 제거한다. 운영 DB URL을 이 환경변수에 넣지 않는다. 새 테스트 DB의 공개 테이블을 지우거나 초기화하지 않는다.

## 아직 필요한 구현과 운영 검증

2026-11-04 검증 환경에서 Railway DB 연결·마이그레이션·최초 OWNER 생성, 관리자 실제 로그인, 구매자 가입·보호자 수신 주문·수동 오픈/회수/복원·판매 종료 후 기존 권한 유지·로그아웃/재로그인을 확인했다. 신규 구매자의 초기화·임시 로그인·새 비밀번호 설정 후 주문과 강의실 이용도 확인했다. 운영 환경 적용은 별도다.

실결제 검수에서는 기존 검수 계정의 1,200원 주문에 사용자 지정 수신자를 연결했다. 20:00:33 KST 발송 성공 → 20:00:34 미납 조회 → 20:02:26 결제 완료·정확한 금액 반영·자동 강의 오픈을 이력에서 확인했다. 수동 승인 없이 구매자 계정의 강의실에 해당 강의가 표시됐다. 이후 사용자 지정 YouTube 영상을 등록하고 강의실 링크로 '원서상담 공지' 영상 진입·실제 재생(0:00 → 0:11)을 확인했다. 판매 종료와 기존 구매 권한은 유지되며 비로그인 영상 접근은 401로 차단된다. 비밀번호·실제 전화번호·API 키는 이 문서에 기록하지 않는다.

현재 검증 작업자는 SEND_ENABLED=false로 추가 발송을 막고 조회만 지속 실행한다. 이 설정은 운영 전체 발송 활성화가 아니다. 검수 강의는 판매 종료이며 기존 구매 권한은 유지한다. 실제 환불·청구 파기는 실행하지 않았다.

DB 백업·빈 별도 DB 복원 연습 명령과 보관 범위는 [lecture-backup.md](lecture-backup.md)를 따른다. 백업 체크섬·스냅샷 기준 건수·복원 후 스키마와 건수 대조를 제공한다. Railway 자동 백업 설정 및 실제 Railway 데이터 복원은 별도로 확인해야 한다.

- 실제 영상의 구매자 재생·비로그인 차단·권한 회수 상태의 접근 거절·복원·관리자 재조회·자동 복귀를 확인했다. 현재 핵심 기능 검수는 통과했으며 아래 운영 준비는 남아 있다.
- 운영에 사용할 강의명·가격·영상과 관리자 계정 확정. 검수 데이터를 실제 판매로 전환하지 않는다.
- 기존 홈페이지 브라우저 회귀, 기존 저장소/볼륨 보존, 운영 DB·웹·worker 연결과 배포·되돌리기 절차 최종 확인.
- 실제 HTTP 세션 만료/관리자 역할 변경 등 남은 운영 점검. 다중 worker claim 잠금은 실제 PostgreSQL 자동 검사로 확인했으며, 실공급자 중복 발송을 유발하는 부하 검수는 이번 단건 성공에 포함하지 않는다.
- 실제 Railway 백업·복원 검증은 미완료다. Pro 자동 백업은 사용자 결정으로 보류이며 고객 안내와 수동 장애 대응 절차를 준비한다.

UI 동선 개선(판매 목록과 내 강의실 구분)은 사용자 결정으로 기능 마무리 이후로 보류한다. 현재 화면 스타일은 유지한다.

설문·분류·추천은 요구사항 수신 후 별도 범위다. 기존 데이터 전체 DB 통합은 이번 신규 출시와 분리한다. 실제 환불 API는 이번 범위에 없다. 코드 연결과 실제 운영 활성화를 구분한다.

## GitHub 병합 및 검사

브랜치 codex/lecture-service. 기존 인증·신청 경로 수정 없이 신규 경로로 분리한다. 공통 package.json/package-lock.json과 CI 파일은 병합 시 함께 확인한다. 잠금 파일을 덮어쓰기보다 package.json 충돌 해결 후 npm install --package-lock-only로 맞춘다. 대상 브랜치 최신 변경은 병합 직전에 다시 확인한다.

검사:
- node scripts/check-lecture-secrets.cjs
- node node_modules/typescript/bin/tsc -p tsconfig.lectures.json --noEmit
- npm run test:lectures
- npm run test:lectures:integration
- npm run test:lectures:migrations
- python -m unittest discover -s tests -p test_lecture_worker.py
- node node_modules/eslint/bin/eslint.js lib/lectures app/api/lectures app/admin/lectures app/lectures tests/lectures.test.ts

PGlite 검사는 실제 업무 함수를 사용하지만 별도 PostgreSQL 연결들의 동시성·Railway·실제 외부 API·브라우저 검증을 대체하지 않는다. 기존 원본 프로젝트는 전체 타입/린트 검사를 빌드에서 무시하므로 새 기능의 검사 통과와 전체 운영 검증을 구분한다.

GitHub Actions는 임시 PostgreSQL 16 서비스에 migrate → check → migrate(변경 없음)를 실행하도록 구성했다. 임시 DB의 CI 전용 계정은 운영 계정과 무관하다. 2026-11-04 개발 브랜치 업로드 후 이 workflow가 실행된다. 실행 결과는 GitHub Actions에서 해당 커밋 기준으로 확인하며, 로컬 검사 결과와 구분한다.

실제 PostgreSQL 업무 흐름: LECTURES_TEST_POSTGRES_URL을 전용 테스트 DB로 설정한 뒤 npm run test:lectures:integration. 실제 동시성: node --test tests/lecture-postgres-concurrency.mjs. PostgreSQL 대상 없이 기본 실행하면 업무 흐름은 PGlite를 사용하며 동시성 검사는 skip한다.
