'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Submission {
  id: string
  studentName: string
  lectureName: string
  assignmentTitle: string
  originalName: string
  submittedAt: string
  fileSize: number
  mimeType: string
}

interface Lecture { id: string; name: string }

export default function AdminSubmissionsPage() {
  const router = useRouter()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [loading, setLoading] = useState(true)
  const [lectureFilter, setLectureFilter] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/submissions', { cache: 'no-store' }),
      fetch('/api/admin/lectures', { cache: 'no-store' }),
    ])
      .then(async ([sr, lr]) => {
        if (sr.status === 401) { router.push('/admin'); return }
        setSubmissions(await sr.json())
        setLectures(await lr.json())
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  }

  const filtered = submissions.filter(s => {
    if (lectureFilter && s.lectureName !== lectureFilter) return false
    if (search && !s.studentName.includes(search) && !s.assignmentTitle.includes(search)) return false
    return true
  })

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
  }

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 80px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '36px 20px 0' }}>

        <button onClick={() => router.push('/admin/dashboard')} style={{
          fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'none',
          border: 'none', cursor: 'pointer', padding: 0, marginBottom: 12, display: 'block',
        }}>← 대시보드</button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>제출 파일</h1>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>{filtered.length}개</span>
        </div>

        {/* 필터 */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            placeholder="학생명 · 과제명 검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, minWidth: 160,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: '#fff', fontSize: 13, padding: '9px 12px', outline: 'none',
            }}
            onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
            onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
          />
          <select value={lectureFilter} onChange={e => setLectureFilter(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: lectureFilter ? '#fff' : 'rgba(255,255,255,0.4)',
              fontSize: 13, padding: '9px 12px', outline: 'none', cursor: 'pointer',
            }}>
            <option value="">전체 강의</option>
            {lectures.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
          </select>
        </div>

        {/* 목록 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}>불러오는 중…</div>
        ) : filtered.length === 0 ? (
          <div style={{ ...card, padding: 48, textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
            제출된 파일이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.slice().reverse().map(s => (
              <div key={s.id} style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: s.mimeType === 'application/pdf' ? 'rgba(239,84,84,0.12)' : 'rgba(77,139,245,0.12)',
                  border: `1px solid ${s.mimeType === 'application/pdf' ? 'rgba(239,84,84,0.25)' : 'rgba(77,139,245,0.25)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}>
                  {s.mimeType === 'application/pdf' ? '📄' : '🖼'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.studentName} — {s.assignmentTitle}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>
                    {s.lectureName} · {s.originalName} · {formatSize(s.fileSize)}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
                    {new Date(s.submittedAt).toLocaleString('ko-KR')}
                  </div>
                </div>
                <a href={`/api/admin/submissions/${s.id}`} download style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: 'rgba(52,209,126,0.1)', border: '1px solid rgba(52,209,126,0.25)',
                  color: '#34d17e', textDecoration: 'none', flexShrink: 0,
                }}>↓ 열기</a>
              </div>
            ))}
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: 40, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          © 2026 박교준 수리논술 · 관리자 전용
        </p>
      </div>
    </div>
  )
}
