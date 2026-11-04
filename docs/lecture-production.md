# 기존 홈페이지에 신규 강의 기능 연결

2026-11-04 Railway 운영 설정의 읽기 전용 확인 결과를 기준으로 작성했다. 아래 추가 작업은 아직 적용하지 않았다. 배포 진행표는 [lecture-release.md](lecture-release.md)를 따른다.

## 현재 운영 기준

- 운영 주소: https://pkjmath.com 및 https://www.pkjmath.com
- 기존 홈페이지 서비스 하나와 homepage-volume이 연결돼 있다.
- 소스: parkkyojoon-code/homepage, master 자동 배포, Wait for CI 꺼짐.
- 기존 런타임: Railpack Node 22.23.1, 포트 8080. 사용자 지정 빌드·시작 명령 및 pre-deploy 명령은 설정돼 있지 않다.
- 기존 volume mount와 DATA_DIR 값은 모두 /app/data다. 이를 바꾸거나 신규 PostgreSQL 저장 경로로 사용하지 않는다.
- 기존 관리자·Google Sheets·문자·기존 결제선생 변수는 보존한다. 운영 홈페이지에 신규 LECTURES_* 변수는 아직 없다.

## 준비할 연결

검증 환경의 DB는 실결제 검수 기록을 포함해 그대로 보존한다. 운영에는 같은 운영 프로젝트 안에 별도 신규 PostgreSQL과 신규 강의 worker를 추가하는 방식으로 준비한다. 검수 계정·임시 강의·테스트 주문을 운영 고객 데이터로 복사하지 않는다. 기존 Google Sheets와 학생 JSON 전체 이전은 수행하지 않는다.

| 대상 | 추가·확인할 설정 | 보존할 설정 |
|---|---|---|
| 신규 운영 PostgreSQL | 검증 환경과 같은 PostgreSQL 18 계열, 전용 DB volume, 035까지 마이그레이션 | 기존 homepage-volume 및 /app/data |
| 기존 운영 웹 | LECTURES_DATABASE_URL은 새 운영 DB의 내부 연결 참조, LECTURES_APP_ORIGIN=https://pkjmath.com, LECTURES_ADDITIONAL_ORIGINS=https://www.pkjmath.com, LECTURES_MIGRATION_DATABASE는 새 DB 이름 참조 | 기존 15개 서비스 변수, source master, 기존 도메인·포트·volume |
| 웹·신규 worker | 동일한 새 운영 전용 LECTURES_WORKER_TOKEN, LECTURES_WORKER_ENABLED=true | 검증용 토큰과 혼용하지 않음 |
| 신규 worker | root /workers/lectures, Dockerfile, LECTURES_WEB_ORIGIN=https://pkjmath.com, PAYSSAM_API_KEY/MEMBER/MERCHANT 비공개 설정 | 기존 register_checker·기존 수강생 청구 프로그램은 변경하지 않음 |
| 초기 연결 검수 | SEND_ENABLED=false, python -u worker.py --check, Restart Never | 점검 과정에서 청구 작업 확보·발송·조회 없음 |

정식 변수 이름은 worker의 env.example을 따른다. 표의 SEND_ENABLED는 LECTURES_WORKER_SEND_ENABLED를 줄여 적은 것이다. 실제 비밀값을 Git·문서·채팅·로그에 넣지 않는다. 새 DB 생성과 운영 전용 인증 연결은 검토 후 적용한다.

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
