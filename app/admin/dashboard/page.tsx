'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface StatusData {
  count: number
  filename: string | null
  uploaded_at: string | null
}

export default function AdminDashboard() {
  const [status, setStatus] = useState<StatusData | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/admin/homework/status', { cache: 'no-store' })
      .then(res => {
        if (res.status === 401) { router.push('/admin'); return null }
        return res.json()
      })
      .then(data => { if (data) setStatus(data) })
      .catch(() => {})
      .finally(() => setStatusLoading(false))
  }, [])

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin')
  }

  const sections = [
    {
      key: 'homework',
      icon: '📋',
      label: '과제 관리',
      desc: '엑셀 업로드로 학생 과제 데이터 교체',
      href: '/admin/homework',
      accent: '#4d8bf5',
      accentDim: 'rgba(77,139,245,0.12)',
      accentBorder: 'rgba(77,139,245,0.25)',
      badge: statusLoading ? '…' : `${status?.count ?? 0}명`,
      badgeLabel: '등록 학생',
      sub: statusLoading ? '불러오는 중…' : (status?.filename ? `${status.filename}` : '업로드 파일 없음'),
    },
    {
      key: 'classes',
      icon: '📚',
      label: '수업 관리',
      desc: '수업 추가·수정·삭제 및 공개 설정',
      href: '/admin/classes',
      accent: '#7b58ef',
      accentDim: 'rgba(123,88,239,0.12)',
      accentBorder: 'rgba(123,88,239,0.25)',
      badge: null,
      badgeLabel: null,
      sub: '수업 카드 이미지, 금액, 캠퍼스 설정',
    },
    {
      key: 'students',
      icon: '👥',
      label: '학생 관리',
      desc: '캠퍼스별 학생·학부모 연락처, 결제 기록',
      href: '/admin/students',
      accent: '#34d17e',
      accentDim: 'rgba(52,209,126,0.12)',
      accentBorder: 'rgba(52,209,126,0.25)',
      badge: null,
      badgeLabel: null,
      sub: '준비 중',
    },
  ]

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 80px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '36px 20px 0' }}>

        {/* 상단 바 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="logo" style={{ width: 28, height: 28, borderRadius: 8, background: '#000' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em' }}>
              박교준 수리논술 · 관리자
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/admin/guide" style={{
              fontSize: 12, fontWeight: 600, color: '#4d8bf5',
              border: '1px solid rgba(77,139,245,0.3)', borderRadius: 8,
              padding: '7px 14px', textDecoration: 'none',
            }}>📖 입력 가이드</a>
            <button onClick={handleLogout} style={{
              fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)',
              background: 'none', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
            }}>로그아웃</button>
          </div>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 6 }}>대시보드</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', marginBottom: 36 }}>
          관리할 항목을 선택하세요
        </p>

        {/* 관리 섹션 카드 3개 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sections.map(sec => (
            <div
              key={sec.key}
              onClick={() => router.push(sec.href)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 18,
                padding: '24px 28px',
                cursor: sec.sub === '준비 중' ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 20,
                transition: 'border-color 0.2s, background 0.2s',
                opacity: sec.sub === '준비 중' ? 0.5 : 1,
              }}
              onMouseEnter={e => {
                if (sec.sub === '준비 중') return
                const el = e.currentTarget as HTMLDivElement
                el.style.borderColor = sec.accentBorder
                el.style.background = sec.accentDim
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.borderColor = 'rgba(255,255,255,0.08)'
                el.style.background = 'rgba(255,255,255,0.04)'
              }}
            >
              {/* 아이콘 */}
              <div style={{
                width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                background: sec.accentDim, border: `1px solid ${sec.accentBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>{sec.icon}</div>

              {/* 텍스트 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>{sec.label}</span>
                  {sec.sub === '준비 중' && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: '2px 8px' }}>준비 중</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{sec.desc}</div>
                {sec.sub !== '준비 중' && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: "'DM Mono',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sec.sub}
                  </div>
                )}
              </div>

              {/* 배지 */}
              {sec.badge !== null && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: sec.accent, fontFamily: "'DM Mono',monospace", lineHeight: 1, marginBottom: 4 }}>
                    {sec.badge}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
                    {sec.badgeLabel}
                  </div>
                </div>
              )}

              {/* 화살표 */}
              {sec.sub !== '준비 중' && (
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 18, flexShrink: 0 }}>›</div>
              )}
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', marginTop: 48, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          © 2026 박교준 수리논술 · 관리자 전용
        </p>
      </div>
    </div>
  )
}
