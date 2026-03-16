'use client'

import { useRouter } from 'next/navigation'

const COL_STYLE: React.CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  fontSize: 13,
  color: 'rgba(255,255,255,0.75)',
  verticalAlign: 'top',
}
const COL_HEAD: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase' as const,
  color: 'rgba(255,255,255,0.35)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.03)',
}

export default function AdminGuidePage() {
  const router = useRouter()

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
  }
  const sectionTitle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    padding: '18px 22px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  }
  const badge = (color: string, text: string) => (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 6,
      background: color,
      fontSize: 11,
      fontWeight: 700,
      color: '#fff',
      marginLeft: 6,
    }}>{text}</span>
  )

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 80px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '36px 20px 0' }}>

        {/* 상단 */}
        <div style={{ marginBottom: 32 }}>
          <button onClick={() => router.push('/admin/homework')} style={{
            fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'none',
            border: 'none', cursor: 'pointer', padding: 0, marginBottom: 12,
          }}>← 과제 관리</button>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 6 }}>📖 엑셀 업로드 가이드</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>
            과제 조회 시스템이 읽는 엑셀 파일 형식을 정확하게 안내합니다.
          </p>
        </div>

        {/* ① 파일 규칙 */}
        <div style={card}>
          <div style={sectionTitle}>① 파일 기본 규칙</div>
          <div style={{ padding: '14px 22px 18px' }}>
            {[
              ['파일 형식', '.xlsx 또는 .xls'],
              ['시트', '첫 번째 시트만 읽습니다'],
              ['1행 (Row 1)', '컬럼 분류 헤더 — 시스템이 무시합니다 (있어도 없어도 무방)'],
              ['2행 (Row 2)', '블록 이름 헤더 — 과제 타입을 자동 감지하는 핵심 행'],
              ['3행 이후', '학생 데이터 (한 학생 = 한 행)'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 12, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.04)', marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#4d8bf5', minWidth: 140 }}>{k}</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ② 열 구조 */}
        <div style={card}>
          <div style={sectionTitle}>② 열 구조 (고정 열 A~D)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={COL_HEAD}>열</th>
                <th style={COL_HEAD}>내용</th>
                <th style={COL_HEAD}>비고</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['A열 (1번째)', '반이름', '예) 파이널A, 기초반'],
                ['B열 (2번째)', '학생이름', '비어있으면 해당 행 전체 무시'],
                ['C열 (3번째)', '학부모 번호', '010으로 시작하는 11자리 (하이픈 무관)'],
                ['D열 (4번째)', '학생 번호', '010으로 시작하는 11자리 (하이픈 무관)'],
                ['E열 ~', '과제 블록 (5열씩 반복)', '아래 ③ 참고'],
              ].map(([col, name, note]) => (
                <tr key={col}>
                  <td style={{ ...COL_STYLE, fontFamily: "'DM Mono',monospace", color: '#f5c842', fontWeight: 700 }}>{col}</td>
                  <td style={COL_STYLE}>{name}</td>
                  <td style={{ ...COL_STYLE, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px 22px 16px', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            ※ 학부모·학생 번호 모두 유효하지 않으면 해당 학생은 등록되지 않습니다.
          </div>
        </div>

        {/* ③ 과제 블록 */}
        <div style={card}>
          <div style={sectionTitle}>③ 과제 블록 구조 (E열부터 5열씩 반복)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={COL_HEAD}>블록 내 순서</th>
                <th style={COL_HEAD}>내용</th>
                <th style={COL_HEAD}>예시 / 규칙</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['1번째 열', '발행일', '2025-03-10 또는 텍스트 자유'],
                ['2번째 열', '과제 내용', '예) 미적분 개념 정리 1-3'],
                ['3번째 열', '제출 여부', 'O 또는 X 만 인식 (소문자 불가)'],
                ['4번째 열', '등급', 'A / B / C — 모의논술 블록은 집계 안 함'],
                ['5번째 열', '완성도', '숫자 입력 (퍼센트 등)'],
              ].map(([order, name, ex]) => (
                <tr key={order}>
                  <td style={{ ...COL_STYLE, fontFamily: "'DM Mono',monospace", color: '#34d17e', fontWeight: 700, whiteSpace: 'nowrap' }}>{order}</td>
                  <td style={COL_STYLE}>{name}</td>
                  <td style={{ ...COL_STYLE, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{ex}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px 22px 16px', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            ※ 발행일·과제내용이 모두 비어있으면 해당 블록은 건너뜁니다.
          </div>
        </div>

        {/* ④ 과제 타입 감지 */}
        <div style={card}>
          <div style={sectionTitle}>④ 과제 타입 자동 감지 (2행 헤더 기준)</div>
          <div style={{ padding: '14px 22px 4px' }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
              각 과제 블록 시작 열(E, J, O…)의 <strong style={{ color: '#fff' }}>2행 셀 텍스트</strong>에 따라 타입이 결정됩니다.
            </p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={COL_HEAD}>2행 헤더에 포함된 텍스트</th>
                <th style={COL_HEAD}>감지 타입</th>
                <th style={COL_HEAD}>특이사항</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...COL_STYLE, fontWeight: 700, color: '#f5a623' }}>모의논술</td>
                <td style={COL_STYLE}>mock {badge('rgba(245,166,35,0.3)', 'MOCK')}</td>
                <td style={{ ...COL_STYLE, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>등급(A/B/C) 집계 없음. 과제명으로 헤더명 사용</td>
              </tr>
              <tr>
                <td style={{ ...COL_STYLE, fontWeight: 700, color: '#4d8bf5' }}>기초수학</td>
                <td style={COL_STYLE}>basic_math {badge('rgba(77,139,245,0.3)', 'BASIC')}</td>
                <td style={{ ...COL_STYLE, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>등급(A/B/C) 집계 있음</td>
              </tr>
              <tr>
                <td style={{ ...COL_STYLE, color: 'rgba(255,255,255,0.4)' }}>그 외 모든 텍스트</td>
                <td style={COL_STYLE}>homework {badge('rgba(52,209,126,0.3)', 'HW')}</td>
                <td style={{ ...COL_STYLE, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>등급(A/B/C) 집계 있음</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ⑤ 전화번호 규칙 */}
        <div style={card}>
          <div style={sectionTitle}>⑤ 전화번호 유효성 규칙</div>
          <div style={{ padding: '14px 22px 18px' }}>
            {[
              ['저장 형식', '숫자만 추출 후 11자리 010XXXXXXXX 형태로 정규화'],
              ['10자리 입력 시', '"10"으로 시작하면 앞에 0 자동 추가 → 010XXXXXXXX'],
              ['하이픈(-)', '있어도 없어도 됩니다 — 자동 제거'],
              ['유효하지 않은 번호', '학생·학부모 번호 모두 없으면 해당 학생 미등록'],
              ['조회 방식', '뒷 9자리 일치로 검색 (앞 두 자리 오타 허용)'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 12, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.04)', marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#4d8bf5', minWidth: 150 }}>{k}</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ⑥ 예시 레이아웃 */}
        <div style={card}>
          <div style={sectionTitle}>⑥ 예시 레이아웃 (최소 구조)</div>
          <div style={{ overflowX: 'auto', padding: '0 0 4px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640, fontSize: 11 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {['행', 'A (반)', 'B (이름)', 'C (학부모)', 'D (학생)', 'E (발행일)', 'F (과제)', 'G (제출)', 'H (등급)', 'I (완성도)', 'J~ (모의논술블록)'].map(h => (
                    <th key={h} style={{ ...COL_HEAD, fontSize: 10, padding: '8px 8px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...COL_STYLE, color: 'rgba(255,255,255,0.3)', fontSize: 11, padding: '8px 8px' }}>1행</td>
                  <td colSpan={9} style={{ ...COL_STYLE, fontSize: 11, padding: '8px 8px', color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>분류 헤더 (시스템 무시)</td>
                  <td style={{ ...COL_STYLE, fontSize: 11, padding: '8px 8px', color: 'rgba(255,255,255,0.2)' }}></td>
                </tr>
                <tr style={{ background: 'rgba(77,139,245,0.05)' }}>
                  <td style={{ ...COL_STYLE, color: '#4d8bf5', fontSize: 11, padding: '8px 8px', fontWeight: 700 }}>2행 ★</td>
                  <td style={{ ...COL_STYLE, fontSize: 11, padding: '8px 8px', color: 'rgba(255,255,255,0.2)' }}></td>
                  <td style={{ ...COL_STYLE, fontSize: 11, padding: '8px 8px', color: 'rgba(255,255,255,0.2)' }}></td>
                  <td style={{ ...COL_STYLE, fontSize: 11, padding: '8px 8px', color: 'rgba(255,255,255,0.2)' }}></td>
                  <td style={{ ...COL_STYLE, fontSize: 11, padding: '8px 8px', color: 'rgba(255,255,255,0.2)' }}></td>
                  <td style={{ ...COL_STYLE, fontSize: 11, padding: '8px 8px', color: '#f5c842', fontWeight: 700 }}>수Ⅱ 과제</td>
                  <td colSpan={4} style={{ ...COL_STYLE, fontSize: 11, padding: '8px 8px', color: 'rgba(255,255,255,0.15)' }}></td>
                  <td style={{ ...COL_STYLE, fontSize: 11, padding: '8px 8px', color: '#f5a623', fontWeight: 700 }}>모의논술 1회</td>
                </tr>
                <tr>
                  <td style={{ ...COL_STYLE, color: 'rgba(255,255,255,0.3)', fontSize: 11, padding: '8px 8px' }}>3행~</td>
                  <td style={{ ...COL_STYLE, fontSize: 11, padding: '8px 8px' }}>파이널A</td>
                  <td style={{ ...COL_STYLE, fontSize: 11, padding: '8px 8px' }}>홍길동</td>
                  <td style={{ ...COL_STYLE, fontSize: 11, padding: '8px 8px' }}>01012345678</td>
                  <td style={{ ...COL_STYLE, fontSize: 11, padding: '8px 8px' }}>01087654321</td>
                  <td style={{ ...COL_STYLE, fontSize: 11, padding: '8px 8px' }}>2025-03-10</td>
                  <td style={{ ...COL_STYLE, fontSize: 11, padding: '8px 8px' }}>수Ⅱ 1단원</td>
                  <td style={{ ...COL_STYLE, fontSize: 11, padding: '8px 8px' }}>O</td>
                  <td style={{ ...COL_STYLE, fontSize: 11, padding: '8px 8px' }}>A</td>
                  <td style={{ ...COL_STYLE, fontSize: 11, padding: '8px 8px' }}>85</td>
                  <td style={{ ...COL_STYLE, fontSize: 11, padding: '8px 8px', color: 'rgba(255,255,255,0.3)' }}>…</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <button onClick={() => router.push('/admin/homework')} style={{
          width: '100%', padding: '14px',
          background: 'linear-gradient(135deg, #0066FF, #4d8bf5)',
          border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700,
          cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,102,255,0.3)',
          marginBottom: 8,
        }}>
          ← 과제 관리로 돌아가기
        </button>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          © 2026 박교준 수리논술 · 관리자 전용
        </p>
      </div>
    </div>
  )
}
