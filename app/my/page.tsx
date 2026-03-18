'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MyLoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!phone || !password) { setError('전화번호와 비밀번호를 입력해주세요.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/my/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      })
      const data = await res.json()
      if (res.ok) router.push('/my/dashboard')
      else setError(data.error || '로그인 실패')
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 10, boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff', fontSize: 15, outline: 'none',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', marginBottom: 6 }}>마이페이지</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>
            학생·학부모 번호로 로그인하세요
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: '32px 28px',
        }}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              전화번호
            </label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              비밀번호
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="초기 비밀번호: 84431621"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
          </div>

          {error && (
            <div style={{
              borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13,
              background: 'rgba(239,84,84,0.08)', border: '1px solid rgba(239,84,84,0.22)',
              color: '#f08888',
            }}>{error}</div>
          )}

          <button onClick={handleLogin} disabled={loading} style={{
            width: '100%', padding: '14px',
            background: loading ? 'rgba(0,102,255,0.25)' : 'linear-gradient(135deg, #0066FF, #4d8bf5)',
            border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 20px rgba(0,102,255,0.3)',
          }}>
            {loading ? '로그인 중…' : '로그인'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 18, display: 'flex', justifyContent: 'center', gap: 4 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>처음 오셨나요?</span>
          <button onClick={() => router.push('/my/register')} style={{
            background: 'none', border: 'none', color: '#4d8bf5',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0,
          }}>신규 가입</button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          기존 수강생은 초기 비밀번호(84431621)로 바로 로그인하세요
        </div>
      </div>
    </div>
  )
}
