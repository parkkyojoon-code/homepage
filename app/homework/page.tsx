'use client'

import { useState, useRef, useEffect } from 'react'

/* ── 타입 ── */
interface Assignment {
  type: 'homework' | 'basic_math' | 'mock'
  date: string
  name: string
  submitted: string
  grade: string
  completeness: number | null
}

interface Student {
  class: string
  name: string
  total_hw: number
  submitted_count: number
  submission_rate: number
  a_count: number
  b_count: number
  c_count: number
  assignments: Assignment[]
}

/* ── 유틸 ── */
function gradeColor(g: string) {
  if (g === 'A') return '#34d17e'
  if (g === 'B') return '#f0c040'
  if (g === 'C') return '#ef5454'
  return '#5c637a'
}

function gradeStyle(g: string): React.CSSProperties {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    A: { bg: 'rgba(52,209,126,0.12)', color: '#34d17e', border: 'rgba(52,209,126,0.25)' },
    B: { bg: 'rgba(240,192,64,0.10)', color: '#f0c040', border: 'rgba(240,192,64,0.25)' },
    C: { bg: 'rgba(239,84,84,0.10)',  color: '#ef5454', border: 'rgba(239,84,84,0.20)' },
  }
  const m = map[g]
  if (m) return { background: m.bg, color: m.color, border: `1px solid ${m.border}` }
  if (g && g.includes('상위')) return { background: 'rgba(123,88,239,0.12)', color: '#9d84f5', border: '1px solid rgba(123,88,239,0.25)' }
  return { background: 'rgba(255,255,255,0.05)', color: '#5c637a', border: '1px solid rgba(255,255,255,0.08)' }
}

/* ── 메인 컴포넌트 ── */
export default function HomeworkPage() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [students, setStudents] = useState<Student[] | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  /* 번호 포맷 */
  function handlePhoneInput(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    let f = d
    if (d.length > 7) f = d.slice(0,3) + '-' + d.slice(3,7) + '-' + d.slice(7)
    else if (d.length > 3) f = d.slice(0,3) + '-' + d.slice(3)
    setPhone(f)
  }

  /* 조회 */
  async function lookup() {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 9) { setError('올바른 번호를 입력해 주세요.'); return }
    setError(''); setLoading(true); setStudents(null)

    try {
      const res = await fetch('/api/homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (res.status === 404) { setError('등록된 번호를 찾을 수 없습니다. 번호를 다시 확인해 주세요.'); return }
      if (!res.ok) { setError('오류가 발생했습니다. 다시 시도해 주세요.'); return }
      setStudents(data)
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (students) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [students])

  const faqs = [
    { q: 'Q. "등록된 번호를 찾을 수 없습니다"라는 메시지가 나옵니다.', a: '입력한 번호가 등록된 번호와 다를 때 발생합니다. 학생 번호와 학부모 번호를 모두 시도해 보세요. 그래도 조회되지 않으면 카카오 채널로 문의해 주세요!' },
    { q: 'Q. 과제를 제출했는데 미제출로 떠요.', a: '과제 내역은 매달 말일 기준으로 확인하여 매월 초에 업데이트됩니다. 제출하셨더라도 아직 반영 전일 수 있으니 조금 기다려 주세요.' },
    { q: 'Q. 과제를 늦게 제출해도 반영되나요?', a: '늦게 제출한 과제도 확인 후 반영됩니다. 필요한 경우 디스코드를 통해 조교 선생님께 업데이트 요청해 주세요.' },
    { q: 'Q. 한 번호로 여러 학생이 함께 조회됩니다.', a: '학부모 번호로 조회할 경우 형제·자매가 함께 수강 중이면 여러 학생의 과제 내역이 함께 표시될 수 있습니다. 이는 정상적인 동작입니다.' },
    { q: 'Q. 학생 번호와 학부모 번호 모두 조회 가능한가요?', a: '네. 학생 번호와 학부모 번호 모두 조회 가능합니다. 둘 중 하나만 입력해도 동일한 결과가 표시됩니다.' },
    { q: 'Q. 과제 등급(A, B, C)은 무엇을 의미하나요?', a: 'A: 과제를 성실하게 수행하고 내용과 분량이 충분한 경우\nB: 과제를 제출했지만 내용이 부족하거나 미완성에 가까운 경우\nC: 과제를 제출하지 않았거나 내용이 거의 없는 경우' },
    { q: 'Q. 모의논술 결과는 어떻게 표시되나요?', a: '모의논술은 일반 과제와 별도로 표시되며, 학생이 받은 실제 점수 또는 백분위 결과가 표시됩니다.' },
    { q: 'Q. 스마트폰에서 글씨가 너무 작게 보입니다.', a: '화면을 두 손가락으로 벌려 확대(핀치줌)하거나, 브라우저 설정에서 글씨 크기를 조절해 사용하실 수 있습니다.' },
  ]

  /* ── CSS 변수 (인라인) ── */
  const s = {
    // 공통 카드
    card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16 } as React.CSSProperties,
    // 섹션 구분선 레이블
    divider: { display: 'flex', alignItems: 'center', gap: 14, margin: '36px 0 16px' } as React.CSSProperties,
  }

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 80px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 20px 0' }}>

        {/* ── 헤더 ── */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            display: 'inline-block', background: 'rgba(0,102,255,0.12)',
            border: '1px solid rgba(0,102,255,0.3)', borderRadius: 20,
            padding: '4px 16px', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: '#4d8bf5', marginBottom: 20,
          }}>재학생 전용 서비스</div>
          <h1 style={{ fontSize: 'clamp(28px,6vw,42px)', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff', marginBottom: 10 }}>
            과제 내역 조회
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>등록된 학생 또는 학부모 번호로 조회하세요</p>
        </div>

        {/* ── 검색 카드 ── */}
        <div style={{ ...s.card, padding: 28, marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 10 }}>
            휴대폰 번호
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="tel"
              value={phone}
              onChange={e => handlePhoneInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookup()}
              placeholder="010-0000-0000"
              maxLength={13}
              style={{
                flex: 1,
                background: 'rgba(0,0,0,0.4)',
                border: '1.5px solid rgba(255,255,255,0.1)',
                borderRadius: 12, padding: '15px 18px',
                fontFamily: "'DM Mono', monospace",
                fontSize: 17, letterSpacing: '0.06em', color: '#fff',
                outline: 'none',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#4d8bf5'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(77,139,245,0.12)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
            />
            <button
              onClick={lookup}
              disabled={loading}
              style={{
                padding: '15px 22px',
                background: loading ? 'rgba(77,139,245,0.4)' : 'linear-gradient(135deg, #0066FF, #4d8bf5)',
                border: 'none', borderRadius: 12,
                color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 20px rgba(0,102,255,0.3)',
                transition: 'opacity 0.2s',
              }}
            >
              {loading ? '조회 중…' : '조회하기'}
            </button>
          </div>
          <p style={{ marginTop: 9, fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>- 없이 숫자만 입력하셔도 됩니다</p>
          {error && (
            <div style={{
              background: 'rgba(239,84,84,0.08)', border: '1px solid rgba(239,84,84,0.22)',
              borderRadius: 10, padding: '12px 16px', marginTop: 12,
              fontSize: 13, color: '#f08888',
            }}>{error}</div>
          )}
        </div>

        {/* ── 결과 ── */}
        {students && (
          <div ref={resultRef} style={{ marginBottom: 32 }}>
            {students.map((s2, si) => {
              const rateColor = s2.submission_rate >= 80 ? '#34d17e' : s2.submission_rate >= 50 ? '#f0c040' : '#ef5454'
              return (
                <div key={si}>
                  {/* 학생 카드 */}
                  <div style={{
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 20, padding: '24px 26px', marginBottom: 10,
                    position: 'relative', overflow: 'hidden',
                  }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #0066FF, #4d8bf5)' }} />
                    {s2.class && (
                      <div style={{
                        display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                        color: '#4d8bf5', background: 'rgba(77,139,245,0.1)', border: '1px solid rgba(77,139,245,0.2)',
                        borderRadius: 20, padding: '3px 10px', marginBottom: 10,
                      }}>{s2.class}</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>{s2.name}</span>
                      <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.3)' }}>학생</span>
                    </div>
                  </div>

                  {/* 스탯 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 10 }}>
                    {[
                      { label: '제출률', value: `${s2.submission_rate}%`, color: rateColor },
                      { label: 'A등급', value: s2.a_count, color: '#34d17e' },
                      { label: 'B·C등급', value: s2.b_count + s2.c_count, color: '#f0c040' },
                    ].map((st, i) => (
                      <div key={i} style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 16, padding: '18px 14px', textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 30, fontWeight: 800, fontFamily: "'DM Mono',monospace", color: st.color, lineHeight: 1, marginBottom: 7 }}>{st.value}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>{st.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* 프로그레스 */}
                  <ProgressCard submitted={s2.submitted_count} total={s2.total_hw} rate={s2.submission_rate} />

                  {/* 과제 목록 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '20px 0 10px', padding: '0 2px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>전체 과제 내역</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono',monospace",
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 20, padding: '1px 8px', color: 'rgba(255,255,255,0.3)',
                    }}>{s2.assignments.length}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 32 }}>
                    {s2.assignments.map((a, ai) => <AssignmentItem key={ai} a={a} />)}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── 유의사항 ── */}
        <SectionDivider label="유의사항" />
        <div style={{
          ...s.card, padding: '20px 20px 20px 18px',
          borderLeft: '3px solid rgba(0,102,255,0.5)', marginBottom: 12,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4d8bf5', marginBottom: 14 }}>
            📋 이용 전 확인해 주세요
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[
              <>본 사이트는 <strong style={{ color: '#fff' }}>재학생 및 학부모 전용</strong>입니다. 타인의 번호로 무단 조회하지 마세요.</>,
              <>조회된 <strong style={{ color: '#fff' }}>성적·과제 정보는 외부에 공유하지 마세요.</strong></>,
              <>과제 내역은 <strong style={{ color: '#fff' }}>매달 말일 기준으로 확인</strong>하여 <strong style={{ color: '#fff' }}>매월 초에 업데이트</strong>됩니다.</>,
              <>사이트 이용 중 오류가 발생하면{' '}
                <a href="http://pf.kakao.com/_YFDjn/chat" target="_blank" rel="noreferrer"
                  style={{ color: '#f9d000', background: 'rgba(249,208,0,0.1)', border: '1px solid rgba(249,208,0,0.25)', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                  💬 카카오 채널
                </a>{' '}로 문의해 주세요.</>,
            ].map((text, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', marginTop: 8, flexShrink: 0 }} />
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQ ── */}
        <SectionDivider label="자주 묻는 질문" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {faqs.map((faq, i) => (
            <div key={i} style={{
              ...s.card,
              borderColor: openFaq === i ? 'rgba(0,102,255,0.3)' : 'rgba(255,255,255,0.08)',
              overflow: 'hidden', transition: 'border-color 0.2s',
            }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: '100%', background: 'none', border: 'none',
                  padding: '16px 18px', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 12, cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: '#dde1f0', lineHeight: 1.4 }}>{faq.q}</span>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  background: openFaq === i ? 'rgba(0,102,255,0.15)' : 'rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transform: openFaq === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.25s, background 0.2s',
                  fontSize: 14, color: openFaq === i ? '#4d8bf5' : 'rgba(255,255,255,0.3)', fontWeight: 300,
                }}>+</span>
              </button>
              {openFaq === i && (
                <div style={{ padding: '0 18px 16px' }}>
                  <p style={{
                    fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.75,
                    borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12,
                    whiteSpace: 'pre-line',
                  }}>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', marginTop: 48, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          © 2026 박교준 수리논술 · 재학생 전용
        </p>
      </div>
    </div>
  )
}

/* ── 서브 컴포넌트 ── */

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '36px 0 16px' }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
    </div>
  )
}

function ProgressCard({ submitted, total, rate }: { submitted: number; total: number; rate: number }) {
  const [width, setWidth] = useState(0)
  useEffect(() => { setTimeout(() => setWidth(rate), 80) }, [rate])

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, padding: '18px 22px', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>과제 제출 현황</span>
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace", color: '#dde1f0' }}>{submitted} / {total}회</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3,
          background: 'linear-gradient(90deg, #0066FF, #4d8bf5)',
          width: `${width}%`, transition: 'width 0.9s cubic-bezier(0.16,1,0.3,1)',
        }} />
      </div>
    </div>
  )
}

function AssignmentItem({ a }: { a: Assignment }) {
  const isMock  = a.type === 'mock'
  const isBasic = a.type === 'basic_math'
  const isSub   = a.submitted === 'O'

  const barColor = isMock  ? (isSub ? '#7b58ef' : 'rgba(123,88,239,0.25)')
                 : isBasic ? (isSub ? '#f59e0b' : 'rgba(245,158,11,0.3)')
                 : (isSub ? '#34d17e' : 'rgba(239,84,84,0.35)')

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 14,
      opacity: !isMock && !isBasic && !isSub ? 0.6 : 1,
    }}>
      <div style={{ width: 3, borderRadius: 2, alignSelf: 'stretch', minHeight: 36, background: barColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: "'DM Mono',monospace", marginBottom: 3 }}>{a.date}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: isSub ? '#dde1f0' : 'rgba(255,255,255,0.4)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isMock && <span style={{ fontSize: 9, fontWeight: 800, color: '#9d84f5', background: 'rgba(123,88,239,0.12)', borderRadius: 4, padding: '2px 5px', marginRight: 5 }}>모의논술</span>}
          {isBasic && <span style={{ fontSize: 9, fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', borderRadius: 4, padding: '2px 5px', marginRight: 5 }}>기초수학</span>}
          {a.name}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
        <span style={{
          fontSize: isMock ? 10 : 11, fontWeight: 800,
          fontFamily: "'DM Mono',monospace",
          padding: '4px 11px', borderRadius: 20,
          ...gradeStyle(a.grade),
        }}>
          {a.grade !== '-' ? a.grade : (isMock ? '미응시' : '미제출')}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: isSub ? '#34d17e' : 'rgba(239,84,84,0.6)' }}>
          {isSub ? '✓ 제출' : '✗ 미제출'}
        </span>
      </div>
    </div>
  )
}
