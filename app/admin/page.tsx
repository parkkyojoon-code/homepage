'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin() {
    if (!password) return
    setLoading(true); setError('')

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push('/admin/dashboard')
    } else {
      const d = await res.json()
      setError(d.error || '로그인 실패')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* 로고 */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'inline-block', background: 'rgba(0,102,255,0.12)',
            border: '1px solid rgba(0,102,255,0.3)', borderRadius: 20,
            padding: '4px 16px', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: '#4d8bf5', marginBottom: 16,
          }}>Administrator</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: 8 }}>
            관리자 로그인
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>박교준 수리논술 관리자 전용</p>
        </div>

        {/* 로그인 카드 */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: 28,
        }}>
          <label style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
            display: 'block', marginBottom: 10,
          }}>비밀번호</label>

          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="관리자 비밀번호 입력"
            autoFocus
            style={{
              width: '100%', background: 'rgba(0,0,0,0.4)',
              border: '1.5px solid rgba(255,255,255,0.1)',
              borderRadius: 12, padding: '14px 18px',
              fontSize: 15, color: '#fff', outline: 'none',
              marginBottom: 12,
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#4d8bf5'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(77,139,245,0.12)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
          />

          {error && (
            <div style={{
              background: 'rgba(239,84,84,0.08)', border: '1px solid rgba(239,84,84,0.22)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 12,
              fontSize: 13, color: '#f08888',
            }}>{error}</div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !password}
            style={{
              width: '100%', padding: '14px',
              background: loading || !password ? 'rgba(0,102,255,0.3)' : 'linear-gradient(135deg, #0066FF, #4d8bf5)',
              border: 'none', borderRadius: 12,
              color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: loading || !password ? 'not-allowed' : 'pointer',
              boxShadow: loading || !password ? 'none' : '0 4px 20px rgba(0,102,255,0.3)',
            }}
          >
            {loading ? '로그인 중…' : '로그인'}
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          © 2026 박교준 수리논술
        </p>
      </div>
    </div>
  )
}
