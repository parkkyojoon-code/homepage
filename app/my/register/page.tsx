'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', student_phone: '', parent_phone: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(key: string, val: string) {
    setForm(p => ({ ...p, [key]: val }))
    setError('')
  }

  async function handleRegister() {
    if (!form.name) { setError('이름을 입력해주세요.'); return }
    if (!form.student_phone && !form.parent_phone) { setError('학생 또는 학부모 번호 중 하나는 필수입니다.'); return }
    if (!form.password) { setError('비밀번호를 입력해주세요.'); return }
    if (form.password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return }
    if (form.password !== form.confirm) { setError('비밀번호가 일치하지 않습니다.'); return }

    setLoading(true); setError('')
    try {
      const res = await fetch('/api/my/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          student_phone: form.student_phone || null,
          parent_phone: form.parent_phone || null,
          password: form.password,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push('/my/dashboard')
      } else if (res.status === 409) {
        setError(data.error)
      } else {
        setError(data.error || '가입 실패')
      }
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 10, boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff', fontSize: 14, outline: 'none',
  }
  const label: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: 'rgba(255,255,255,0.4)', marginBottom: 7,
    textTransform: 'uppercase', letterSpacing: '0.06em',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', marginBottom: 6 }}>신규 가입</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            기존 수강생은 초기 비밀번호로 바로 로그인하세요
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: '28px 24px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>

          <div>
            <label style={label}>이름 <span style={{ color: '#ef5454' }}>*</span></label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="홍길동" style={inputStyle}
              onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={label}>학생 번호</label>
              <input value={form.student_phone} onChange={e => set('student_phone', e.target.value)}
                placeholder="010-0000-0000" style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
            </div>
            <div>
              <label style={label}>학부모 번호</label>
              <input value={form.parent_phone} onChange={e => set('parent_phone', e.target.value)}
                placeholder="010-0000-0000" style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: -8 }}>
            둘 중 하나 이상 필수 · 두 번호로 모두 로그인 가능
          </div>

          <div>
            <label style={label}>비밀번호 <span style={{ color: '#ef5454' }}>*</span></label>
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
              placeholder="6자 이상" style={inputStyle}
              onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
          </div>

          <div>
            <label style={label}>비밀번호 확인 <span style={{ color: '#ef5454' }}>*</span></label>
            <input type="password" value={form.confirm} onChange={e => set('confirm', e.target.value)}
              placeholder="비밀번호 다시 입력"
              onKeyDown={e => e.key === 'Enter' && handleRegister()}
              style={{
                ...inputStyle,
                borderColor: form.confirm && form.confirm !== form.password
                  ? 'rgba(239,84,84,0.5)' : 'rgba(255,255,255,0.1)',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
              onBlur={e => (e.target.style.borderColor =
                form.confirm && form.confirm !== form.password
                  ? 'rgba(239,84,84,0.5)' : 'rgba(255,255,255,0.1)'
              )} />
          </div>

          {error && (
            <div style={{
              borderRadius: 8, padding: '10px 14px', fontSize: 13,
              background: 'rgba(239,84,84,0.08)', border: '1px solid rgba(239,84,84,0.22)',
              color: '#f08888',
            }}>{error}</div>
          )}

          <button onClick={handleRegister} disabled={loading} style={{
            width: '100%', padding: '14px', marginTop: 4,
            background: loading ? 'rgba(0,102,255,0.25)' : 'linear-gradient(135deg, #0066FF, #4d8bf5)',
            border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 20px rgba(0,102,255,0.3)',
          }}>
            {loading ? '가입 중…' : '가입하기'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <button onClick={() => router.push('/my')} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)',
            fontSize: 13, cursor: 'pointer',
          }}>이미 계정이 있으신가요? 로그인</button>
        </div>
      </div>
    </div>
  )
}
