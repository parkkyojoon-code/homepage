'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function MyProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ student_phone: '', parent_phone: '', zipcode: '', address: '', address_detail: '' })
  const [infoSave, setInfoSave] = useState<SaveState>('idle')
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [pwSaving, setPwSaving] = useState(false)

  useEffect(() => {
    fetch('/api/my/profile', { cache: 'no-store' })
      .then(r => { if (r.status === 401) { router.push('/my'); return null } return r.json() })
      .then(data => {
        if (!data) return
        setForm({ student_phone: data.student_phone ?? '', parent_phone: data.parent_phone ?? '', zipcode: data.zipcode ?? '', address: data.address ?? '', address_detail: data.address_detail ?? '' })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function saveInfo() {
    setInfoSave('saving')
    try {
      const res = await fetch('/api/my/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) { setInfoSave('saved'); setTimeout(() => setInfoSave('idle'), 2000) }
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

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
      불러오는 중…
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 80px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '36px 20px 0' }}>

        <button onClick={() => router.push('/my/dashboard')} style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 16, display: 'block' }}>← 대시보드</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 24 }}>내 정보</h1>

        {/* 연락처·배송지 */}
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
                <input value={form.zipcode} onChange={e => setForm(p => ({ ...p, zipcode: e.target.value }))}
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

        {/* 비밀번호 변경 */}
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

        <p style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          © 2026 박교준 수리논술
        </p>
      </div>
    </div>
  )
}
