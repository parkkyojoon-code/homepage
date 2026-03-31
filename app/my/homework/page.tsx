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

export default function MyHomeworkPage() {
  const router = useRouter()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('전체')
  const [submitFilter, setSubmitFilter] = useState('전체')

  useEffect(() => {
    fetch('/api/my/assignments', { cache: 'no-store' })
      .then(r => { if (r.status === 401) { router.push('/my'); return null } return r.json() })
      .then(data => { if (data) { setAssignments(data); setLoading(false) } })
      .catch(() => setLoading(false))
  }, [])

  const filteredAssignments = assignments.filter(a => {
    if (typeFilter !== '전체' && TYPE_LABEL[a.type] !== typeFilter) return false
    if (submitFilter === '제출' && a.submitted !== 'O') return false
    if (submitFilter === '미제출' && a.submitted !== 'X') return false
    return true
  })

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
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '36px 20px 0' }}>

        <button onClick={() => router.push('/my/dashboard')} style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 16, display: 'block' }}>← 대시보드</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 20 }}>과제 현황</h1>

        {assignments.length === 0 ? (
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

        <p style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          © 2026 박교준 수리논술
        </p>
      </div>
    </div>
  )
}
