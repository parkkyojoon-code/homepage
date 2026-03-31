'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

interface LectureAssignment { id: string; title: string; description: string; dueDate: string }
interface Lecture { id: string; name: string; assignments: LectureAssignment[] }

function SubmitForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const lectureId = searchParams.get('lectureId') ?? ''
  const assignmentId = searchParams.get('assignmentId') ?? ''

  const [lectures, setLectures] = useState<Lecture[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLectureId, setSelectedLectureId] = useState(lectureId)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(assignmentId)
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/my/lectures', { cache: 'no-store' })
      .then(r => { if (r.status === 401) { router.push('/my'); return null } return r.json() })
      .then(data => { if (data) setLectures(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const selectedLecture = lectures.find(l => l.id === selectedLectureId)
  const selectedAssignment = selectedLecture?.assignments.find(a => a.id === selectedAssignmentId)

  async function handleSubmit() {
    if (!selectedLectureId || !selectedAssignmentId || !file) return
    setSubmitting(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('lectureId', selectedLectureId)
      fd.append('assignmentId', selectedAssignmentId)
      fd.append('file', file)
      const res = await fetch('/api/my/submit', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        setResult({ type: 'success', text: '✅ 제출 완료!' })
        setFile(null)
        if (fileRef.current) fileRef.current.value = ''
      } else {
        setResult({ type: 'error', text: data.error || '제출 실패' })
      }
    } catch {
      setResult({ type: 'error', text: '서버 오류' })
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: '#fff', fontSize: 13, padding: '10px 12px',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
    marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.06em',
  }
  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16, padding: '24px',
  }

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>불러오는 중…</div>

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 80px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '36px 20px 0' }}>

        <button onClick={() => router.push('/my/lectures')} style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 16, display: 'block' }}>← 강의로 돌아가기</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 24 }}>과제 제출</h1>

        <div style={card}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* 강의 선택 */}
            <div>
              <label style={labelStyle}>강의 선택</label>
              <select value={selectedLectureId} onChange={e => { setSelectedLectureId(e.target.value); setSelectedAssignmentId('') }}
                style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">— 강의를 선택하세요 —</option>
                {lectures.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>

            {/* 과제 선택 */}
            <div>
              <label style={labelStyle}>과제 선택</label>
              <select value={selectedAssignmentId} onChange={e => setSelectedAssignmentId(e.target.value)}
                disabled={!selectedLecture}
                style={{ ...inputStyle, cursor: selectedLecture ? 'pointer' : 'not-allowed', opacity: selectedLecture ? 1 : 0.5 }}>
                <option value="">— 과제를 선택하세요 —</option>
                {selectedLecture?.assignments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
            </div>

            {/* 선택된 과제 정보 */}
            {selectedAssignment && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(77,139,245,0.06)', border: '1px solid rgba(77,139,245,0.15)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: selectedAssignment.description ? 6 : 0 }}>{selectedAssignment.title}</div>
                {selectedAssignment.description && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{selectedAssignment.description}</div>}
                {selectedAssignment.dueDate && <div style={{ fontSize: 11, color: '#f5a623', marginTop: 6 }}>마감: {selectedAssignment.dueDate}</div>}
              </div>
            )}

            {/* 파일 첨부 */}
            <div>
              <label style={labelStyle}>파일 첨부 (PDF · 이미지, 최대 20MB)</label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,image/*"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              />
              {file && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
                  {file.name} ({(file.size / 1024 / 1024).toFixed(2)}MB)
                </div>
              )}
            </div>

            {/* 결과 메시지 */}
            {result && (
              <div style={{
                borderRadius: 8, padding: '10px 14px', fontSize: 13,
                background: result.type === 'success' ? 'rgba(52,209,126,0.08)' : 'rgba(239,84,84,0.08)',
                border: `1px solid ${result.type === 'success' ? 'rgba(52,209,126,0.25)' : 'rgba(239,84,84,0.22)'}`,
                color: result.type === 'success' ? '#6ef5b0' : '#f08888',
              }}>{result.text}</div>
            )}

            {/* 제출 버튼 */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedLectureId || !selectedAssignmentId || !file}
              style={{
                width: '100%', padding: '13px',
                background: submitting || !selectedLectureId || !selectedAssignmentId || !file
                  ? 'rgba(77,139,245,0.2)' : 'linear-gradient(135deg, #0066FF, #4d8bf5)',
                border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: submitting || !selectedLectureId || !selectedAssignmentId || !file ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? '제출 중…' : '제출하기'}
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          © 2026 박교준 수리논술
        </p>
      </div>
    </div>
  )
}

export default function SubmitPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>불러오는 중…</div>}>
      <SubmitForm />
    </Suspense>
  )
}
