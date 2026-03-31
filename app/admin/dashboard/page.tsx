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

  function downloadFile(file: string, filename: string) {
    const a = document.createElement('a')
    a.href = `/api/admin/download?file=${file}`
    a.download = filename
    a.click()
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
      desc: '학생별 과제 직접 조회 및 수정',
      href: '/admin/students',
      accent: '#34d17e',
      accentDim: 'rgba(52,209,126,0.12)',
      accentBorder: 'rgba(52,209,126,0.25)',
      badge: null,
      badgeLabel: null,
      sub: '과제 추가·수정·삭제',
    },
    {
      key: 'addresses',
      icon: '📦',
      label: '배송지 관리',
      desc: '학생별 배송지 일괄 조회 및 엑셀 다운로드',
      href: '/admin/addresses',
      accent: '#f5a623',
      accentDim: 'rgba(245,166,35,0.12)',
      accentBorder: 'rgba(245,166,35,0.25)',
      badge: null,
      badgeLabel: null,
      sub: '이름·번호·주소 검색 · 반별 필터',
    },
    {
      key: 'lectures',
      icon: '🎬',
      label: '강의 관리',
      desc: '강의 영상·공지·과제 관리',
      href: '/admin/lectures',
      accent: '#4d8bf5',
      accentDim: 'rgba(77,139,245,0.12)',
      accentBorder: 'rgba(77,139,245,0.25)',
      badge: null,
      badgeLabel: null,
      sub: '유튜브 영상 · 공지사항 · 주차별 과제',
    },
    {
      key: 'submissions',
      icon: '📥',
      label: '제출 파일',
      desc: '학생 과제 제출 파일 확인',
      href: '/admin/submissions',
      accent: '#34d17e',
      accentDim: 'rgba(52,209,126,0.12)',
      accentBorder: 'rgba(52,209,126,0.25)',
      badge: null,
      badgeLabel: null,
      sub: '제출 파일 열기 · 강의/학생별 필터',
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
          <button onClick={handleLogout} style={{
            fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)',
            background: 'none', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
          }}>로그아웃</button>
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
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 20,
                transition: 'border-color 0.2s, background 0.2s',
              }}
              onMouseEnter={e => {
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
                <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{sec.label}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{sec.desc}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: "'DM Mono',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sec.sub}
                </div>
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

              <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 18, flexShrink: 0 }}>›</div>
            </div>
          ))}
        </div>

        {/* 데이터 다운로드 */}
        <div style={{
          marginTop: 28,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14,
          padding: '18px 22px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
            📥 데이터 백업
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { file: 'students', label: '학생 데이터', filename: 'students_data.json' },
              { file: 'classes',  label: '수업 데이터', filename: 'classes.json' },
              { file: 'meta',     label: '업로드 정보', filename: 'meta.json' },
            ].map(({ file, label, filename }) => (
              <button
                key={file}
                onClick={e => { e.stopPropagation(); downloadFile(file, filename) }}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
              >
                ↓ {label}
              </button>
            ))}
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 40, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          © 2026 박교준 수리논술 · 관리자 전용
        </p>
      </div>
    </div>
  )
}
