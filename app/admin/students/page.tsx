'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface StudentSummary {
  id: string
  name: string
  class: string
  student_phone: string | null
  parent_phone: string | null
  total_hw: number
  submitted_count: number
  submission_rate: number
  a_count: number
  b_count: number
  c_count: number
  password_plain: string
  is_default_password: boolean
  enrolledAt: string | null
}

const INPUT: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 9, boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#fff', fontSize: 14, outline: 'none',
}

export default function AdminStudentsPage() {
  const router = useRouter()
  const [students, setStudents] = useState<StudentSummary[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [classFilter, setClassFilter] = useState('전체')

  // 학생 추가 모달
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', student_phone: '', parent_phone: '', class: '', enrolledAt: '' })
  const [adding, setAdding]   = useState(false)
  const [addError, setAddError] = useState('')
  const [addedId, setAddedId]  = useState<string | null>(null)  // 추가 직후 성적표 이동용

  useEffect(() => {
    fetch('/api/admin/students', { cache: 'no-store' })
      .then(r => { if (r.status === 401) router.push('/admin'); return r.json() })
      .then(data => { setStudents(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const classes = ['전체', ...Array.from(new Set(students.map(s => s.class).filter(Boolean))).sort()]

  const filtered = students.filter(s => {
    const matchClass = classFilter === '전체' || s.class === classFilter
    const matchSearch = !search || s.name.includes(search) ||
      (s.student_phone ?? '').includes(search) ||
      (s.parent_phone ?? '').includes(search)
    return matchClass && matchSearch
  })

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
  }

  function rateColor(rate: number) {
    if (rate >= 80) return '#34d17e'
    if (rate >= 50) return '#f5c842'
    return '#ef5454'
  }

  async function handleAdd() {
    if (!form.name.trim()) { setAddError('이름을 입력해주세요'); return }
    if (!form.student_phone.trim() && !form.parent_phone.trim()) {
      setAddError('학생 또는 학부모 연락처 중 하나는 필수입니다'); return
    }
    setAdding(true); setAddError('')
    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setAdding(false)
    if (!res.ok) { setAddError(data.error ?? '오류 발생'); return }

    setStudents(p => [...p, {
      ...data,
      total_hw: 0, submitted_count: 0, submission_rate: 0,
      a_count: 0, b_count: 0, c_count: 0,
      password_plain: '84431621', is_default_password: true,
    }])
    setAddedId(data.id)
    setForm({ name: '', student_phone: '', parent_phone: '', class: '', enrolledAt: '' })
  }

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 80px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '36px 20px 0' }}>

        {/* 상단 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <button onClick={() => router.push('/admin/dashboard')} style={{
              fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'none',
              border: 'none', cursor: 'pointer', padding: 0, marginBottom: 12,
            }}>← 대시보드</button>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 6 }}>👤 학생 관리</h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>
              학생을 클릭하면 과제를 직접 수정할 수 있습니다.
            </p>
          </div>
          <button onClick={() => { setShowModal(true); setAddedId(null); setAddError('') }} style={{
            background: 'linear-gradient(135deg,#0066FF,#4d8bf5)', border: 'none',
            borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', padding: '10px 20px', marginTop: 28,
          }}>+ 학생 추가</button>
        </div>

        {/* 검색 */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' as const }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="이름 또는 전화번호 검색"
            style={{
              flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 10,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', fontSize: 13, outline: 'none',
            }} />
        </div>

        {/* 반 탭 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' as const }}>
          {classes.map(c => (
            <button key={c} onClick={() => setClassFilter(c)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', border: 'none',
              background: classFilter === c ? '#4d8bf5' : 'rgba(255,255,255,0.07)',
              color: classFilter === c ? '#fff' : 'rgba(255,255,255,0.5)',
            }}>{c}</button>
          ))}
        </div>

        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 14 }}>
          {loading ? '불러오는 중…' : `${filtered.length}명`}
        </div>

        {/* 학생 목록 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}>불러오는 중…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.2)' }}>
            {students.length === 0 ? '학생을 추가하거나 엑셀을 업로드해주세요.' : '검색 결과가 없습니다.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(s => (
              <div key={s.id} onClick={() => router.push(`/admin/students/${s.id}`)}
                style={{ ...card, padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{s.name}</span>
                    {s.class && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: 4 }}>{s.class}</span>}
                    {s.enrolledAt && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{s.enrolledAt} 등록</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                    {s.student_phone ?? '—'} · 학부모 {s.parent_phone ?? '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: rateColor(s.submission_rate), fontFamily: 'monospace' }}>{s.submission_rate}%</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>제출률</div>
                  </div>
                  {[['A', '#4d8bf5', s.a_count], ['B', '#34d17e', s.b_count], ['C', '#f5a623', s.c_count]].map(([label, color, count]) => (
                    <div key={label as string} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: color as string, fontFamily: 'monospace' }}>{count as number}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{label}등급</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 학생 추가 모달 */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: '20px',
        }} onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setAddedId(null) } }}>
          <div style={{
            background: '#181c27', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 440,
          }}>
            {addedId ? (
              /* 추가 완료 화면 */
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
                  {students.find(s => s.id === addedId)?.name} 학생 추가 완료
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 28 }}>
                  초기 비밀번호: 84431621
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => router.push(`/admin/students/${addedId}`)} style={{
                    flex: 1, padding: '12px', borderRadius: 10, fontWeight: 700, fontSize: 14,
                    background: 'linear-gradient(135deg,#0066FF,#4d8bf5)', border: 'none',
                    color: '#fff', cursor: 'pointer',
                  }}>성적표 바로 가기 →</button>
                  <button onClick={() => { setAddedId(null) }} style={{
                    flex: 1, padding: '12px', borderRadius: 10, fontWeight: 600, fontSize: 14,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                  }}>학생 더 추가</button>
                </div>
                <button onClick={() => { setShowModal(false); setAddedId(null) }} style={{
                  width: '100%', marginTop: 10, padding: '10px', borderRadius: 10, fontSize: 13,
                  background: 'none', border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
                }}>닫기</button>
              </div>
            ) : (
              /* 입력 폼 */
              <>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 24 }}>학생 추가</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      이름 <span style={{ color: '#ef5454' }}>*</span>
                    </label>
                    <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="홍길동" style={INPUT}
                      onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      학생 연락처 <span style={{ color: '#ef5454' }}>*</span>
                    </label>
                    <input value={form.student_phone} onChange={e => setForm(p => ({ ...p, student_phone: e.target.value }))}
                      placeholder="01012345678" type="tel" style={INPUT}
                      onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      학부모 연락처 <span style={{ color: '#ef5454' }}>*</span>
                    </label>
                    <input value={form.parent_phone} onChange={e => setForm(p => ({ ...p, parent_phone: e.target.value }))}
                      placeholder="01087654321" type="tel" style={INPUT}
                      onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.07em' }}>반</label>
                      <select value={form.class} onChange={e => setForm(p => ({ ...p, class: e.target.value }))}
                        style={{ ...INPUT, cursor: 'pointer', colorScheme: 'dark' }}>
                        <option value="">-- 선택 --</option>
                        {classes.filter(c => c !== '전체').map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.07em' }}>등록일</label>
                      <input type="date" value={form.enrolledAt} onChange={e => setForm(p => ({ ...p, enrolledAt: e.target.value }))}
                        style={{ ...INPUT, colorScheme: 'dark' }}
                        onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
                        onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 12 }}>
                  * 학생·학부모 연락처 중 하나는 필수 · 초기 비밀번호: 84431621
                </div>

                {addError && (
                  <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, fontSize: 13,
                    background: 'rgba(239,84,84,0.08)', border: '1px solid rgba(239,84,84,0.2)', color: '#f08888' }}>
                    {addError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                  <button onClick={handleAdd} disabled={adding} style={{
                    flex: 1, padding: '13px', borderRadius: 10, fontWeight: 700, fontSize: 15,
                    background: adding ? 'rgba(0,102,255,0.3)' : 'linear-gradient(135deg,#0066FF,#4d8bf5)',
                    border: 'none', color: '#fff', cursor: adding ? 'not-allowed' : 'pointer',
                    boxShadow: adding ? 'none' : '0 4px 20px rgba(0,102,255,0.3)',
                  }}>{adding ? '추가 중…' : '학생 추가'}</button>
                  <button onClick={() => { setShowModal(false); setAddError('') }} style={{
                    padding: '13px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                  }}>취소</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
