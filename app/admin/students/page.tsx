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
}

export default function AdminStudentsPage() {
  const router = useRouter()
  const [students, setStudents] = useState<StudentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('전체')

  useEffect(() => {
    fetch('/api/admin/students', { cache: 'no-store' })
      .then(r => { if (r.status === 401) router.push('/admin'); return r.json() })
      .then(data => { setStudents(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const classes = ['전체', ...Array.from(new Set(students.map(s => s.class))).sort()]

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

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 80px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '36px 20px 0' }}>

        {/* 상단 */}
        <div style={{ marginBottom: 28 }}>
          <button onClick={() => router.push('/admin/dashboard')} style={{
            fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'none',
            border: 'none', cursor: 'pointer', padding: 0, marginBottom: 12,
          }}>← 대시보드</button>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 6 }}>👤 학생 관리</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>
            학생을 클릭하면 과제를 직접 수정할 수 있습니다.
          </p>
        </div>

        {/* 검색 + 필터 */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름 또는 전화번호 검색"
            style={{
              flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 10,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', fontSize: 13, outline: 'none',
            }}
          />
        </div>

        {/* 반 탭 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {classes.map(c => (
            <button key={c} onClick={() => setClassFilter(c)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', border: 'none',
              background: classFilter === c ? '#4d8bf5' : 'rgba(255,255,255,0.07)',
              color: classFilter === c ? '#fff' : 'rgba(255,255,255,0.5)',
            }}>{c}</button>
          ))}
        </div>

        {/* 카운트 */}
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 14 }}>
          {loading ? '불러오는 중…' : `${filtered.length}명`}
        </div>

        {/* 학생 목록 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}>불러오는 중…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.2)' }}>
            {students.length === 0 ? '엑셀을 먼저 업로드해주세요.' : '검색 결과가 없습니다.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(s => (
              <div
                key={s.id}
                onClick={() => router.push(`/admin/students/${s.id}`)}
                style={{
                  ...card, padding: '16px 20px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 16,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              >
                {/* 이름 + 반 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{s.class}</div>
                </div>

                {/* 제출률 */}
                <div style={{ textAlign: 'center', minWidth: 60 }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: rateColor(s.submission_rate), fontFamily: "'DM Mono',monospace", lineHeight: 1 }}>
                    {s.submission_rate}%
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>제출률</div>
                </div>

                {/* A/B/C */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['A', '#4d8bf5', s.a_count], ['B', '#34d17e', s.b_count], ['C', '#f5a623', s.c_count]].map(([label, color, count]) => (
                    <div key={label as string} style={{
                      padding: '3px 8px', borderRadius: 6,
                      background: `${color}18`,
                      border: `1px solid ${color}30`,
                      fontSize: 11, fontWeight: 700,
                      color: color as string,
                    }}>{label} {count as number}</div>
                  ))}
                </div>

                {/* 과제수 */}
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', minWidth: 50, textAlign: 'right' }}>
                  {s.submitted_count}/{s.total_hw}
                </div>

                <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.2)' }}>›</div>
              </div>
            ))}
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: 48, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          © 2026 박교준 수리논술 · 관리자 전용
        </p>
      </div>
    </div>
  )
}
