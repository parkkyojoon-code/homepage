'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface LectureAssignment { id: string; title: string; description: string; dueDate: string }
interface Lecture { id: string; name: string; assignments: LectureAssignment[] }

export default function MyAssignmentsPage() {
  const router = useRouter()
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [loading, setLoading] = useState(true)
  const [lectureFilter, setLectureFilter] = useState('')

  useEffect(() => {
    fetch('/api/my/lectures', { cache: 'no-store' })
      .then(r => { if (r.status === 401) { router.push('/my'); return null } return r.json() })
      .then(data => { if (data) setLectures(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const allAssignments = lectures
    .filter(l => !lectureFilter || l.id === lectureFilter)
    .flatMap(l => l.assignments.map(a => ({ ...a, lectureName: l.name, lectureId: l.id })))

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>과제 목록</h1>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>{allAssignments.length}개</span>
        </div>

        {/* 강의 필터 */}
        {lectures.length > 1 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button onClick={() => setLectureFilter('')} style={{
              padding: '6px 14px', borderRadius: 16, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', border: 'none',
              background: !lectureFilter ? '#4d8bf5' : 'rgba(255,255,255,0.07)',
              color: !lectureFilter ? '#fff' : 'rgba(255,255,255,0.45)',
            }}>전체</button>
            {lectures.map(l => (
              <button key={l.id} onClick={() => setLectureFilter(l.id)} style={{
                padding: '6px 14px', borderRadius: 16, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: 'none',
                background: lectureFilter === l.id ? '#4d8bf5' : 'rgba(255,255,255,0.07)',
                color: lectureFilter === l.id ? '#fff' : 'rgba(255,255,255,0.45)',
              }}>{l.name}</button>
            ))}
          </div>
        )}

        {allAssignments.length === 0 ? (
          <div style={{ ...card, padding: 48, textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
            등록된 과제가 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {allAssignments.map(a => (
              <div key={a.id} style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#4d8bf5', background: 'rgba(77,139,245,0.12)', border: '1px solid rgba(77,139,245,0.25)', borderRadius: 6, padding: '2px 8px' }}>{a.lectureName}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: a.description ? 6 : 0 }}>{a.title}</div>
                  {a.description && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>{a.description}</div>}
                  {a.dueDate && <div style={{ fontSize: 11, color: '#f5a623', marginTop: 6 }}>마감: {a.dueDate}</div>}
                </div>
                <button
                  onClick={() => router.push(`/my/submit?lectureId=${a.lectureId}&assignmentId=${a.id}`)}
                  style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    background: 'rgba(77,139,245,0.12)', border: '1px solid rgba(77,139,245,0.3)',
                    color: '#4d8bf5', cursor: 'pointer', flexShrink: 0,
                  }}
                >제출</button>
              </div>
            ))}
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: 40, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          © 2026 박교준 수리논술
        </p>
      </div>
    </div>
  )
}
