# 신규 신청 화면의 로컬 검수

이 도구는 임시 상품과 메모리 DB를 사용하는 개발용 화면 검수다. Railway 서비스나 운영 Sheets에 연결하지 않는다. 실제 PostgreSQL의 HTTP 통합 검사는 `tests/daechion-http.integration.mjs`, 실제 Google 쓰기 검수는 `scripts/daechion-sheets-verify.cjs`로 별도 수행한다.

준비: `npm ci`, `npm run build:daechion-worker`, `npm run build`.

실행: `node tests/daechion-browser-preview.mjs --local-only`.

- 브라우저: http://127.0.0.1:3102/apply/browser-preview-process-two
- 가상 저장 결과: http://127.0.0.1:3102/__preview/status
- 3102와 3103은 이 도구 전용이며 둘 다 loopback에만 바인딩한다.
- 실재 학생 대신 검수 이름과 010-0000-xxxx 가상 번호만 입력한다.
- 화면은 실제 ApplicationForm을 사용한다. 접수는 실제 intake 모듈, 저장은 PGlite, Sheets는 실제 publisher와 모의 API다.
- 상품 파일은 임시 디렉터리에 생성하며 원래 classes.json은 읽거나 변경하지 않는다.
- 공급자 자격 증명을 비우고 외부 발송을 실행하지 않는다. 접수 완료 문구가 표시되어도 실제 청구서나 문자는 오지 않는다.
- 종료 시 Ctrl+C로 웹 서버·메모리 DB를 닫고 도구 전용 임시 상품 파일을 제거한다.

2026-11-07 브라우저 확인: 기존·신규 초기 미선택, 상호 배타 선택, 학부모 신청, 학생/보호자/결제 번호 구분, 동의 항목, 접수 완료 화면, DB 1건 및 SHEETS DONE, 제출 값과 업무 행 일치. 실제 서비스 전체 연결 및 모바일 화면 검수까지 완료했다는 의미는 아니다.
