'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Assignment {
  type: 'homework' | 'basic_math' | 'mock'
  date: string
  name: string
  submitted: 'O' | 'X'
  grade: string
  completeness: number | null
}

interface Profile {
  id: string
  name: string
  class: string
  student_phone: string | null
  parent_phone: string | null
  address: string
  address_detail: string
  submission_rate: number
  total_hw: number
  submitted_count: number
  a_count: number
  b_count: number
  c_count: number
}

type Tab = 'homework' | 'info'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const TYPE_COLOR: Record<string, string> = {
  homework: '#34d17e',
  basic_math: '#4d8bf5',
  mock: '#f5a623',
}
const TYPE_LABEL: Record<string, string> = {
  homework: '과제',
  basic_math: '기초수학',
  mock: '모의논술',
}

export default function MyDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [hwLoading, setHwLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('homework')

  const [form, setForm] = useState({ student_phone: '', parent_phone: '', zipcode: '', address: '', address_detail: '' })
  const [infoSave, setInfoSave] = useState<SaveState>('idle')

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [pwSaving, setPwSaving] = useState(false)

  const [typeFilter, setTypeFilter] = useState<string>('전체')
  const [submitFilter, setSubmitFilter] = useState<string>('전체')

  useEffect(() => {
    fetch('/api/my/profile', { cache: 'no-store' })
      .then(r => { if (r.status === 401) { router.push('/my'); return null } return r.json() })
      .then(data => {
        if (!data) return
        setProfile(data)
        setForm({ student_phone: data.student_phone ?? '', parent_phone: data.parent_phone ?? '', zipcode: data.zipcode ?? '', address: data.address ?? '', address_detail: data.address_detail ?? '' })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (tab !== 'homework' || assignments.length > 0) return
    setHwLoading(true)
    fetch('/api/my/assignments', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => { setAssignments(data); setHwLoading(false) })
      .catch(() => setHwLoading(false))
  }, [tab])

  async function handleLogout() {
    await fetch('/api/my/logout', { method: 'POST' })
    router.push('/my')
  }

  async function saveInfo() {
    setInfoSave('saving')
    try {
      const res = await fetch('/api/my/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok) { setProfile(p => p ? { ...p, ...data } : p); setInfoSave('saved'); setTimeout(() => setInfoSave('idle'), 2000) }
      else setInfoSave('error')
    } catch { setInfoSave('error') }
  }

  async function savePassword() {
    setPwMsg(null)
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) { setPwMsg({ type: 'error', text: '모든 항목을 입력해주세요.' }); return }
    if (pwForm.next !== pwForm.confirm) { setPwMsg({ type: 'error', text: '새 비밀번호가 일치하지 않습니다.' }); return }
    if (pwForm.next.length < 6) { setPwMsg({ type: 'error', text: '새 비밀번호는 6자 이상이어야 합니다.' }); return }
    setPwSaving(true)
    try {
      const res = await fetch('/api/my/password', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.next }) })
      const data = await res.json()
      if (res.ok) { setPwMsg({ type: 'success', text: '✅ 비밀번호가 변경되었습니다.' }); setPwForm({ current: '', next: '', confirm: '' }) }
      else setPwMsg({ type: 'error', text: data.error || '변경 실패' })
    } catch { setPwMsg({ type: 'error', text: '서버 오류' }) }
    finally { setPwSaving(false) }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 10, boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff', fontSize: 14, outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
    marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.06em',
  }
  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16, marginBottom: 16,
  }

  const filteredAssignments = assignments.filter(a => {
    if (typeFilter !== '전체' && TYPE_LABEL[a.type] !== typeFilter) return false
    if (submitFilter === '제출' && a.submitted !== 'O') return false
    if (submitFilter === '미제출' && a.submitted !== 'X') return false
    return true
  })

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
      불러오는 중…
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 80px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '36px 20px 0' }}>

        {/* 상단 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{profile?.name}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
              {profile?.class || '반 미배정'}
            </div>
          </div>
          <button onClick={handleLogout} style={{
            fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)',
            background: 'none', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
          }}>로그아웃</button>
        </div>

        {/* 집계 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 24 }}>
          {[
            { label: '제출률', value: `${profile?.submission_rate ?? 0}%`, color: '#4d8bf5' },
            { label: 'A등급', value: profile?.a_count ?? 0, color: '#34d17e' },
            { label: 'B등급', value: profile?.b_count ?? 0, color: '#f5c842' },
            { label: 'C등급', value: profile?.c_count ?? 0, color: '#f5a623' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...card, padding: '14px 12px', marginBottom: 0, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color, fontFamily: "'DM Mono',monospace", lineHeight: 1, marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {([['homework', '과제 목록'], ['info', '내 정보']] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', border: 'none',
              background: tab === key ? '#4d8bf5' : 'rgba(255,255,255,0.07)',
              color: tab === key ? '#fff' : 'rgba(255,255,255,0.5)',
            }}>{label}</button>
          ))}
        </div>

        {/* ─── 내 정보 탭 ─── */}
        {tab === 'info' && (
          <div>
            {/* 연락처·배송지 카드 */}
            <div style={card}>
              <div style={{ padding: '18px 22px 0', fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 18 }}>연락처 · 배송지</div>
              <div style={{ padding: '0 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>학생 번호</label>
                    <input value={form.student_phone} onChange={e => setForm(p => ({ ...p, student_phone: e.target.value }))}
                      placeholder="010-0000-0000" style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                  </div>
                  <div>
                    <label style={labelStyle}>결제 안내 번호 (학부모님)</label>
                    <input value={form.parent_phone} onChange={e => setForm(p => ({ ...p, parent_phone: e.target.value }))}
                      placeholder="010-0000-0000" style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8 }}>
                  <div>
                    <label style={labelStyle}>우편번호</label>
                    <input value={form.zipcode ?? ''} onChange={e => setForm(p => ({ ...p, zipcode: e.target.value }))}
                      placeholder="예) 03000" style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                  </div>
                  <div>
                    <label style={labelStyle}>기본 주소</label>
                    <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                      placeholder="도로명 주소를 입력하세요" style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>상세 주소</label>
                  <input value={form.address_detail} onChange={e => setForm(p => ({ ...p, address_detail: e.target.value }))}
                    placeholder="동/호수, 건물명 등" style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                </div>
                <button onClick={saveInfo} disabled={infoSave === 'saving'} style={{
                  width: '100%', padding: '13px',
                  background: infoSave === 'saved' ? 'rgba(52,209,126,0.2)' : infoSave === 'error' ? 'rgba(239,84,84,0.2)' : 'linear-gradient(135deg, #0066FF, #4d8bf5)',
                  border: infoSave === 'saved' ? '1px solid rgba(52,209,126,0.4)' : infoSave === 'error' ? '1px solid rgba(239,84,84,0.4)' : 'none',
                  borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: infoSave === 'saving' ? 'not-allowed' : 'pointer',
                }}>
                  {infoSave === 'saving' ? '저장 중…' : infoSave === 'saved' ? '✅ 저장 완료' : infoSave === 'error' ? '저장 실패 — 다시 시도' : '저장하기'}
                </button>
              </div>
            </div>

            {/* 비밀번호 변경 카드 */}
            <div style={card}>
              <div style={{ padding: '18px 22px 0', fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 18 }}>비밀번호 변경</div>
              <div style={{ padding: '0 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {([
                  ['current', '현재 비밀번호', '현재 비밀번호'],
                  ['next', '새 비밀번호', '6자 이상'],
                  ['confirm', '새 비밀번호 확인', '새 비밀번호 다시 입력'],
                ] as [string, string, string][]).map(([key, label, ph]) => (
                  <div key={key}>
                    <label style={labelStyle}>{label}</label>
                    <input type="password" value={pwForm[key as keyof typeof pwForm]}
                      onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={ph} style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                  </div>
                ))}
                {pwMsg && (
                  <div style={{
                    borderRadius: 8, padding: '10px 14px', fontSize: 13,
                    background: pwMsg.type === 'success' ? 'rgba(52,209,126,0.08)' : 'rgba(239,84,84,0.08)',
                    border: `1px solid ${pwMsg.type === 'success' ? 'rgba(52,209,126,0.25)' : 'rgba(239,84,84,0.22)'}`,
                    color: pwMsg.type === 'success' ? '#6ef5b0' : '#f08888',
                  }}>{pwMsg.text}</div>
                )}
                <button onClick={savePassword} disabled={pwSaving} style={{
                  width: '100%', padding: '13px',
                  background: pwSaving ? 'rgba(0,102,255,0.25)' : 'linear-gradient(135deg, #0066FF, #4d8bf5)',
                  border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: pwSaving ? 'not-allowed' : 'pointer',
                }}>
                  {pwSaving ? '변경 중…' : '비밀번호 변경'}
                </button>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
                  초기 비밀번호: <span style={{ fontFamily: "'DM Mono',monospace", color: 'rgba(255,255,255,0.4)' }}>84431621</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── 과제 목록 탭 ─── */}
        {tab === 'homework' && (
          <div>
            {hwLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}>불러오는 중…</div>
            ) : assignments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
                등록된 과제가 없습니다.
              </div>
            ) : (
              <>
                {/* 필터 */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  {['전체', '과제', '기초수학', '모의논술'].map(f => (
                    <button key={f} onClick={() => setTypeFilter(f)} style={{
                      padding: '5px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', border: 'none',
                      background: typeFilter === f ? '#4d8bf5' : 'rgba(255,255,255,0.07)',
                      color: typeFilter === f ? '#fff' : 'rgba(255,255,255,0.45)',
                    }}>{f}</button>
                  ))}
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    {['전체', '제출', '미제출'].map(f => (
                      <button key={f} onClick={() => setSubmitFilter(f)} style={{
                        padding: '5px 10px', borderRadius: 16, fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', border: 'none',
                        background: submitFilter === f ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                        color: submitFilter === f ? '#fff' : 'rgba(255,255,255,0.4)',
                      }}>{f}</button>
                    ))}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginBottom: 10 }}>
                  {filteredAssignments.length}개
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredAssignments.map((a, i) => (
                    <div key={i} style={{
                      ...card, marginBottom: 0, padding: '14px 18px',
                      display: 'flex', alignItems: 'center', gap: 14,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 800,
                        background: a.submitted === 'O' ? 'rgba(52,209,126,0.15)' : 'rgba(239,84,84,0.1)',
                        color: a.submitted === 'O' ? '#34d17e' : '#ef5454',
                      }}>{a.submitted}</div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.name || '—'}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                          {a.date || '날짜 없음'}
                        </div>
                      </div>

                      <div style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, flexShrink: 0,
                        background: `${TYPE_COLOR[a.type]}18`,
                        border: `1px solid ${TYPE_COLOR[a.type]}35`,
                        color: TYPE_COLOR[a.type],
                      }}>{TYPE_LABEL[a.type]}</div>

                      {a.type !== 'mock' && a.grade && a.grade !== '-' && (
                        <div style={{
                          width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 900,
                          background: a.grade === 'A' ? 'rgba(77,139,245,0.15)' : a.grade === 'B' ? 'rgba(52,209,126,0.15)' : 'rgba(245,200,66,0.15)',
                          color: a.grade === 'A' ? '#4d8bf5' : a.grade === 'B' ? '#34d17e' : '#f5c842',
                        }}>{a.grade}</div>
                      )}

                      {a.type === 'mock' && a.grade && a.grade !== '-' && (
                        <div style={{
                          padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, flexShrink: 0,
                          background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.35)',
                          color: '#f5a623',
                        }}>{a.grade}</div>
                      )}

                      {a.type !== 'mock' && a.completeness != null && (
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>
                          {Math.round(a.completeness * 100)}%
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          © 2026 박교준 수리논술
        </p>
      </div>
    </div>
  )
}
