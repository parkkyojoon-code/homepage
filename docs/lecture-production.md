# 기존 홈페이지에 신규 강의 기능 연결

2026-11-04 운영 기준을 확인하고, 2026-11-05 사용자 승인 후 신규 운영 DB·관리자·웹 연결 배포와 worker 연결 검사를 완료했다. 실제 판매·청구서 발송·상시 결제 조회는 아직 시작하지 않았다. 배포 진행표는 [lecture-release.md](lecture-release.md)를 따른다.

## 2026-11-05 운영 반영 완료

- PR #2를 fast-forward로 master에 반영했다. 운영 코드 SHA는 `9c2893af7759a0895df182d0154883c9e6e51f37`이며 최신 PR 검사 run `41865130418`이 성공했다. 이후 이 문서의 기록 보완은 개발 브랜치에서 별도로 관리한다.
- 운영 웹 배포 `ebadb5ea-575b-452a-a3d6-14a852d71a06`에 신규 변수 6개와 pre-deploy DB 검사 명령만 추가했다. 기존 15개 변수·도메인·기본 build/start·volume·`/app/data`는 유지했다. master 자동 배포는 원래 상태인 활성으로 복원했다.
- 운영 DB 마이그레이션과 구조 검사에 미적용 항목이 없음을 확인했다. 기존 데이터 volume 연결 중 기동이 지연되고 HTTP 점검 1회가 시간 초과됐으나, 이후 Next Ready 로그와 정상 운영 응답을 확인했다. 장애 원인을 확정한 것으로 기록하지 않는다.
- 두 운영 도메인의 신규 API 접근 보호 검사 각 12건(총 24건), 기존 페이지 익명 HTML GET 각 7건(총 14건)이 통과했다. 기존 학생 로그인·Sheets 쓰기의 전체 회귀 검수를 대신하지 않는다.
- 사용자가 직접 비밀번호를 설정한 운영 첫 OWNER `pkjmath_admin`을 생성했다. 실제 운영 로그인, 총괄·활성 상태, 주문 0건, 등록 강의 0개를 브라우저에서 확인했다. 임시 bootstrap 변수 3개는 별도 승인 후 삭제했다.
- 초기화 서비스는 검사 전용 `npm run db:lectures:check`, 자동 배포 비활성, Restart Never다.
- 운영 worker 배포 `209b380c-21aa-4939-9191-f452c8ce4189`에서 `Lecture billing connection check passed. No jobs claimed or provider requests made.`를 확인했다. 웹과 worker가 운영 전용 토큰 참조로 연결됐으며 실제 DB 준비 상태 검사까지 통과했다.
- worker의 시작 명령은 `python -u worker.py --check`, 실행 플래그 true, 발송 플래그 false, Restart Never, 자동 배포 비활성이다. 정상 종료한 일회 검사이며 **상시 결제 조회나 청구서 발송을 수행하는 상태가 아니다**.
- 운영 주소: https://pkjmath.com/lectures / https://pkjmath.com/admin/lectures . 검증용 구매자·강의·주문은 복사하지 않았다. 실제 판매 항목 등록과 승인된 운영 활성화는 다음 단계다.

## 현재 운영 기준

아래는 2026-11-04 변경 전 기준이다. 현재 적용 상태는 위 완료 기록을 우선한다.

- 운영 주소: https://pkjmath.com 및 https://www.pkjmath.com
- 기존 홈페이지 서비스 하나와 homepage-volume이 연결돼 있다.
- 소스: parkkyojoon-code/homepage, master 자동 배포, Wait for CI 꺼짐.
- 기존 런타임: Railpack Node 22.23.1, 포트 8080. 사용자 지정 빌드·시작 명령 및 pre-deploy 명령은 설정돼 있지 않다.
- 기존 volume mount와 DATA_DIR 값은 모두 /app/data다. 이를 바꾸거나 신규 PostgreSQL 저장 경로로 사용하지 않는다.
- 기존 관리자·Google Sheets·문자·기존 결제선생 변수는 보존한다. 운영 홈페이지에 신규 LECTURES_* 변수는 아직 없다.

## 준비할 연결

### 2026-11-05 운영 배포 전 준비 기록

- 운영 프로젝트에 별도 Postgres와 전용 volume을 생성했다. `lectures-db-setup`에서 9개 마이그레이션을 적용했으며 `reachable: true`, `pending: []`, `schemaChecked: true`를 확인했다. Railway Data 화면에서도 신규 21개 테이블을 확인했다.
- 초기화 서비스는 `codex/lecture-service`의 검증된 코드로 일회 실행 후 종료했다. 공개 주소·기존 홈페이지 volume 연결이 없으며 Restart Never, 자동 배포 비활성 상태다.
- `lectures-worker`는 같은 브랜치의 `/workers/lectures`와 자동 감지 Dockerfile로 배포했다. 운영 전용 토큰과 기존 결제선생 설정 3개는 비공개 변수로 저장했다. 변수 7개를 원본과 대조해 일치를 확인했다.
- worker는 `LECTURES_WORKER_ENABLED=false`, `LECTURES_WORKER_SEND_ENABLED=false`, 시작 명령 `python -u worker.py`, Restart Never, 자동 배포 비활성이다. 로그의 `Lecture billing worker is disabled.`와 정상 종료를 확인했다. 공개 주소와 DB 직접 접근 권한은 추가하지 않았다.
- 기존 homepage의 master·도메인·15개 변수·`/app/data`·volume은 변경하지 않았다. 운영 웹에는 아직 신규 API가 없으므로 **운영 웹↔worker 인증·DB 준비 상태를 확인하는 `--check`는 미실행**이다. 비활성 종료를 연결 검사 성공으로 간주하지 않는다.
- 운영 웹 배포 시 `LECTURES_WORKER_TOKEN`은 `${{lectures-worker.LECTURES_WORKER_TOKEN}}` 참조로 연결할 수 있다. 토큰을 문서나 로컬 파일로 복사하지 않는다. 그 후 웹·worker를 준비하고 `--check`를 실행한다.

검증 환경의 DB는 실결제 검수 기록을 포함해 그대로 보존한다. 운영에는 같은 운영 프로젝트 안에 별도 신규 PostgreSQL과 신규 강의 worker를 추가하는 방식으로 준비한다. 검수 계정·임시 강의·테스트 주문을 운영 고객 데이터로 복사하지 않는다. 기존 Google Sheets와 학생 JSON 전체 이전은 수행하지 않는다.

| 대상 | 추가·확인할 설정 | 보존할 설정 |
|---|---|---|
| 신규 운영 PostgreSQL | 검증 환경과 같은 PostgreSQL 18 계열, 전용 DB volume, 035까지 마이그레이션 | 기존 homepage-volume 및 /app/data |
| 기존 운영 웹 | LECTURES_DATABASE_URL은 새 운영 DB의 내부 연결 참조, LECTURES_APP_ORIGIN=https://pkjmath.com, LECTURES_ADDITIONAL_ORIGINS=https://www.pkjmath.com, LECTURES_MIGRATION_DATABASE는 새 DB 이름 참조 | 기존 15개 서비스 변수, source master, 기존 도메인·포트·volume |
| 웹·신규 worker | 동일한 새 운영 전용 LECTURES_WORKER_TOKEN, LECTURES_WORKER_ENABLED=true | 검증용 토큰과 혼용하지 않음 |
| 신규 worker | root /workers/lectures, Dockerfile, LECTURES_WEB_ORIGIN=https://pkjmath.com, PAYSSAM_API_KEY/MEMBER/MERCHANT 비공개 설정 | 기존 register_checker·기존 수강생 청구 프로그램은 변경하지 않음 |
| 초기 연결 검수 | SEND_ENABLED=false, python -u worker.py --check, Restart Never | 점검 과정에서 청구 작업 확보·발송·조회 없음 |

정식 변수 이름은 worker의 env.example을 따른다. 표의 SEND_ENABLED는 LECTURES_WORKER_SEND_ENABLED를 줄여 적은 것이다. 표는 최종 연결 목표이며 위 적용 상태와 구분한다. 실제 비밀값을 Git·문서·채팅·로그에 넣지 않는다.

두 운영 도메인은 실제로 각각 접속되므로 신규 쓰기 API에서도 두 Origin을 명시적으로 허용한다. 추가 주소는 쉼표로 구분한 정확한 Origin만 사용하며 와일드카드·경로·끝 슬래시·잘못된 설정은 거절한다. 설정한 기본 주소가 있을 때 Host/forwarded 헤더로 허용 범위를 넓히지 않는다. 검증 환경의 추가 Origin은 비워 둔다.

## 코드 배포 전 준비

1. 새 운영 DB를 준비하고 별도 migration 실행 환경에서 001부터 035까지 적용·check한다. 기존 master에는 신규 CLI가 없으므로 master를 그대로 둔 상태에서 신규 명령을 기존 웹의 pre-deploy에 먼저 넣지 않는다.
2. 신규 웹 코드의 운영 배포 단위에 아래 pre-deploy를 설정한다. DB 연결·DB 이름 검증이 실패하면 웹이 교체되지 않도록 한다.

   `npm run db:lectures:migrate -- --database "$LECTURES_MIGRATION_DATABASE" && npm run db:lectures:check`

3. master의 자동 배포를 고려해 병합과 운영 변수·명령 적용 순서를 한 번의 배포 계획으로 검토한다. 코드 병합만 먼저 해 놓고 DB 연결이 완료된 것으로 간주하지 않는다.
4. 새 DB에 첫 OWNER를 만들 때만 bootstrap 변수를 사용한다. 비밀번호는 사용자가 직접 설정하고 생성 확인 후 bootstrap 변수를 제거한다. 검증 관리자 계정은 운영 DB에 자동 생성되지 않는다.
5. 웹 준비 후 신규 worker --check를 실행하고 실제 판매 항목을 등록한다. 이후 승인된 운영 발송 활성화 및 조회 주기 검수를 진행한다.

## 되돌리기 기준

변경 전 정상 배포 식별자와 환경·volume 기준은 비밀값을 제외해 저장소 밖 배포 기록에 보관한다. 신규 기능 장애 시 신규 worker를 먼저 정지하고 운영 웹의 호환 버전으로 복구한다. 새 DB의 결제 원장은 삭제하지 않는다. 기존 /app/data·Google Sheets·문자·관리자 설정은 복구 과정에서도 유지한다.

## 검수의 범위

사이트는 구매 권한을 검사한 뒤 YouTube 링크로 이동한다. 이미 알려진 일부 공개 YouTube 원본 링크의 외부 공유·재생을 막는 DRM 기능은 제공하지 않는다. 이는 현재 영상 방식의 범위이며 이번 배포 준비에서 다른 영상 플랫폼이나 새 기능을 추가하지 않는다.

운영 반영 전 남은 실제 콘텐츠·운영자 확인 항목은 판매 강의명·가격·영상, 고객 문의·계정 복구 경로, 기존 홈페이지 사용 회귀와 배포 검토다. 유료 자동 백업 도입과 실제 Railway 복원 연습은 보류·미완료 상태를 유지한다.
