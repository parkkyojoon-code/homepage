'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Profile {
  id: string
  name: string
  class: string
  submission_rate: number
  total_hw: number
  submitted_count: number
  a_count: number
  b_count: number
  c_count: number
}

export default function MyDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/my/profile', { cache: 'no-store' })
      .then(r => { if (r.status === 401) { router.push('/my'); return null } return r.json() })
      .then(data => { if (data) { setProfile(data); setLoading(false) } })
      .catch(() => setLoading(false))
  }, [])

  async function handleLogout() {
    await fetch('/api/my/logout', { method: 'POST' })
    router.push('/my')
  }

  const sections = [
    {
      icon: '📋',
      label: '과제 현황',
      desc: '제출률 · 등급 확인',
      href: '/my/homework',
      accent: '#4d8bf5',
      accentDim: 'rgba(77,139,245,0.12)',
      accentBorder: 'rgba(77,139,245,0.25)',
    },
    {
      icon: '🎬',
      label: '내 강의',
      desc: '강의 영상 · 공지 · 과제',
      href: '/my/lectures',
      accent: '#7b58ef',
      accentDim: 'rgba(123,88,239,0.12)',
      accentBorder: 'rgba(123,88,239,0.25)',
    },
    {
      icon: '📝',
      label: '과제 제출',
      desc: '파일 업로드 제출',
      href: '/my/assignments',
      accent: '#34d17e',
      accentDim: 'rgba(52,209,126,0.12)',
      accentBorder: 'rgba(52,209,126,0.25)',
    },
    {
      icon: '👤',
      label: '내 정보',
      desc: '연락처 · 배송지 · 비밀번호',
      href: '/my/profile',
      accent: '#f5a623',
      accentDim: 'rgba(245,166,35,0.12)',
      accentBorder: 'rgba(245,166,35,0.25)',
    },
  ]

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
  }

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 28 }}>
          {[
            { label: '제출률', value: `${profile?.submission_rate ?? 0}%`, color: '#4d8bf5' },
            { label: 'A등급', value: profile?.a_count ?? 0, color: '#34d17e' },
            { label: 'B등급', value: profile?.b_count ?? 0, color: '#f5c842' },
            { label: 'C등급', value: profile?.c_count ?? 0, color: '#f5a623' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...card, padding: '14px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color, fontFamily: "'DM Mono',monospace", lineHeight: 1, marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* 섹션 카드 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sections.map(sec => (
            <div
              key={sec.href}
              onClick={() => router.push(sec.href)}
              style={{
                ...card, padding: '20px 24px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16,
                transition: 'border-color 0.2s, background 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = sec.accentBorder; e.currentTarget.style.background = sec.accentDim }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
            >
              <div style={{
                width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                background: sec.accentDim, border: `1px solid ${sec.accentBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              }}>{sec.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 3 }}>{sec.label}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>{sec.desc}</div>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 18, flexShrink: 0 }}>›</div>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', marginTop: 40, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          © 2026 박교준 수리논술
        </p>
      </div>
    </div>
  )
}
