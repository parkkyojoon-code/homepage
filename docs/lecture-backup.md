# 강의 DB 백업·복원 연습

이 도구는 신규 강의 전용 PostgreSQL 한 개의 데이터와 구조를 백업한다. 기존 Google Sheets, 학생 JSON, 업로드 파일, Railway 환경변수·DB 역할·서버 설정은 포함하지 않는다. 기존 홈페이지의 파일과 Sheets 백업은 별도로 유지한다.

## 준비

- 서버와 같은 메이저 버전의 PostgreSQL 클라이언트 pg_dump·pg_restore를 준비한다. PATH 또는 LECTURES_PG_BIN에 실행 파일 디렉터리를 설정한다. 설치된 로컬 PostgreSQL 12 클라이언트를 Railway의 더 최신 서버 백업에 사용하지 않는다.
- 백업은 LECTURES_DATABASE_URL, 복원 연습은 별도의 LECTURES_RESTORE_DATABASE_URL을 사용한다. URL은 .env.local 또는 서버 비밀 환경변수로 설정하고 명령 인자·Git·채팅에 넣지 않는다.
- 연결 URL 쿼리는 sslmode, sslrootcert, sslcert, sslkey만 지원한다. 지원하지 않는 옵션은 무시하지 않고 중단한다. 제공자의 TLS 설정을 그대로 사용한다.
- 백업 폴더에는 개인정보·인증 해시·세션이 포함된다. 접근 제한과 암호화된 저장소를 사용한다. 도구 자체는 파일을 암호화하지 않는다. GitHub Actions artifact나 공개 저장소에 올리지 않는다.

## 백업

부모 폴더를 먼저 준비하고, 아직 없는 새 하위 폴더를 지정한다.

```text
npm run db:lectures:backup -- --database 실제원본DB이름 --directory /private/backups/lectures-YYYYMMDD-HHmm
```

기존 폴더는 덮어쓰지 않는다. pg_dump의 일관된 스냅샷과 같은 시점에서 public 테이블별 건수를 읽는다. database.dump와 SHA-256·크기·건수 manifest.json을 함께 보관한다. 완료 manifest가 없거나 명령이 실패한 폴더는 유효한 백업으로 취급하지 않는다. 진단 원문을 출력하지 않으므로 실패하면 권한·공간·클라이언트 버전·연결 설정부터 확인한다. 경고가 발생해도 성공으로 처리하지 않는다.

아카이브 목록·체크섬 검사는 실제 복원을 대신하지 않는다. 백업 파일이 있다는 것만으로 복구 완료라고 판단하지 않는다.

## 빈 별도 DB에서 복원 연습

1. 별도 PostgreSQL DB를 만들고 이름을 lecture_restore_로 시작하게 정한다. 원본과 다른 이름이어야 한다.
2. 복원 DB를 웹·결제 작업자에 연결하지 않는다. 원본 서비스와 기존 register_checker는 그대로 둔다.
3. LECTURES_RESTORE_DATABASE_URL을 새 DB로 설정한다.
4. 아래 명령을 실행한다. 기존 객체가 있는 대상에는 복원하지 않는다. --clean, DROP, 원본 덮어쓰기를 사용하지 않는다.

```text
npm run db:lectures:restore-rehearsal -- --database lecture_restore_YYYYMMDD --directory /private/backups/lectures-YYYYMMDD-HHmm
```

도구는 체크섬·크기, 대상 DB 이름과 빈 상태를 확인하고 하나의 트랜잭션으로 복원한다. SQL 오류가 나면 해당 복원 트랜잭션을 되돌린다. 이후 코드와 마이그레이션 이력·필수 열·테이블별 건수를 대조한다. 검증 실패 시 원본을 건드리지 말고 별도 대상의 상태를 조사한다. 자체 백업만 복원하며, 출처 불명의 아카이브는 실행하지 않는다.

연습 후에는 격리된 웹 환경에서 로그인·주문 조회·권한 확인도 진행한다. 복원 DB에는 예전 세션과 작업 대기 정보가 있으므로 결제 worker는 계속 비활성으로 유지한다. 실제 장애 복구에서는 기존 세션 폐기, 진행 중·미확정 청구 건의 결제선생 대조, 웹 전환, 중복 발송 방지, 재가동 시점을 별도로 결정한다. 복원했다고 곧바로 worker를 가동하지 않는다.

## 운영 적용 전 남은 확인

- Railway 자동 백업 주기·보존 기간·외부 사본 보관·복원 권한을 실제 설정하고 확인한다.
- 운영 전 변경과 DB 마이그레이션 직전에 수동 백업을 확보한다.
- 복원 시간과 마지막 복구 가능 시점을 기록하고, 실패 알림과 정기 복원 연습을 운영 절차에 포함한다.
- 이 도구 추가와 로컬/CI 연습은 Railway 실제 데이터 백업·자동 백업 설정 완료를 뜻하지 않는다.

근거: [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html), [PostgreSQL pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html).
