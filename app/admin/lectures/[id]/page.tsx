'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface LectureVideo { id: string; title: string; youtubeUrl: string; week: number }
interface LectureNotice { id: string; title: string; content: string; createdAt: string }
interface LectureAssignment { id: string; title: string; description: string; dueDate: string }
interface Lecture {
  id: string; name: string; description: string
  videos: LectureVideo[]; notices: LectureNotice[]; assignments: LectureAssignment[]
}

type TabKey = 'videos' | 'notices' | 'assignments'

export default function LectureDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [lecture, setLecture] = useState<Lecture | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('videos')

  // 영상 추가 폼
  const [addingVideo, setAddingVideo] = useState(false)
  const [videoForm, setVideoForm] = useState({ title: '', youtubeUrl: '', week: '' })
  // 공지 추가 폼
  const [addingNotice, setAddingNotice] = useState(false)
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '' })
  // 과제 추가 폼
  const [addingAssignment, setAddingAssignment] = useState(false)
  const [assignmentForm, setAssignmentForm] = useState({ title: '', description: '', dueDate: '' })

  const [saving, setSaving] = useState(false)
  const [editName, setEditName] = useState(false)
  const [nameVal, setNameVal] = useState('')

  useEffect(() => {
    fetch(`/api/admin/lectures/${id}`, { cache: 'no-store' })
      .then(r => { if (r.status === 401) { router.push('/admin'); return null } return r.json() })
      .then(data => { if (data) { setLecture(data); setNameVal(data.name) } })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  async function saveName() {
    if (!lecture || !nameVal.trim()) return
    const res = await fetch(`/api/admin/lectures/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameVal }),
    })
    if (res.ok) { const data = await res.json(); setLecture(data) }
    setEditName(false)
  }

  async function addVideo() {
    if (!videoForm.title || !videoForm.youtubeUrl) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/lectures/${id}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...videoForm, week: Number(videoForm.week) || 0 }),
      })
      if (res.ok) {
        const v = await res.json()
        setLecture(p => p ? { ...p, videos: [...p.videos, v] } : p)
        setVideoForm({ title: '', youtubeUrl: '', week: '' })
        setAddingVideo(false)
      }
    } finally { setSaving(false) }
  }

  async function addNotice() {
    if (!noticeForm.title) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/lectures/${id}/notices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noticeForm),
      })
      if (res.ok) {
        const n = await res.json()
        setLecture(p => p ? { ...p, notices: [n, ...p.notices] } : p)
        setNoticeForm({ title: '', content: '' })
        setAddingNotice(false)
      }
    } finally { setSaving(false) }
  }

  async function addAssignment() {
    if (!assignmentForm.title) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/lectures/${id}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignmentForm),
      })
      if (res.ok) {
        const a = await res.json()
        setLecture(p => p ? { ...p, assignments: [...p.assignments, a] } : p)
        setAssignmentForm({ title: '', description: '', dueDate: '' })
        setAddingAssignment(false)
      }
    } finally { setSaving(false) }
  }

  async function deleteAssignment(aid: string, title: string) {
    if (!confirm(`"${title}" 과제를 삭제할까요?`)) return
    const res = await fetch(`/api/admin/lectures/${id}/assignments/${aid}`, { method: 'DELETE' })
    if (res.ok) setLecture(p => p ? { ...p, assignments: p.assignments.filter(a => a.id !== aid) } : p)
  }

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, marginBottom: 10, overflow: 'hidden',
  }
  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: '#fff', fontSize: 13, padding: '9px 12px',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  }
  const addCard: React.CSSProperties = {
    background: 'rgba(77,139,245,0.04)', border: '1px solid rgba(77,139,245,0.15)',
    borderRadius: 14, marginBottom: 16, padding: '16px 20px',
  }

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>불러오는 중…</div>
  if (!lecture) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>강의를 찾을 수 없습니다.</div>

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 80px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '36px 20px 0' }}>

        {/* 상단 */}
        <button onClick={() => router.push('/admin/lectures')} style={{
          fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'none',
          border: 'none', cursor: 'pointer', padding: 0, marginBottom: 12, display: 'block',
        }}>← 강의 목록</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          {editName ? (
            <>
              <input value={nameVal} onChange={e => setNameVal(e.target.value)} style={{ ...inputStyle, fontSize: 22, fontWeight: 800, flex: 1 }}
                onKeyDown={e => { if (e.key === 'Enter') saveName() }} autoFocus />
              <button onClick={saveName} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'rgba(52,209,126,0.15)', border: '1px solid rgba(52,209,126,0.3)', color: '#34d17e', cursor: 'pointer' }}>저장</button>
              <button onClick={() => setEditName(false)} style={{ padding: '9px 12px', borderRadius: 8, fontSize: 13, background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>취소</button>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0, flex: 1 }}>{lecture.name}</h1>
              <button onClick={() => setEditName(true)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)', cursor: 'pointer' }}>이름 수정</button>
            </>
          )}
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {([['videos', `🎬 영상 (${lecture.videos.length})`], ['notices', `📢 공지 (${lecture.notices.length})`], ['assignments', `📝 과제 (${lecture.assignments.length})`]] as [TabKey, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', border: 'none',
              background: tab === key ? '#4d8bf5' : 'rgba(255,255,255,0.07)',
              color: tab === key ? '#fff' : 'rgba(255,255,255,0.5)',
            }}>{label}</button>
          ))}
        </div>

        {/* ── 영상 탭 ── */}
        {tab === 'videos' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button onClick={() => setAddingVideo(true)} style={{ fontSize: 12, fontWeight: 700, color: '#4d8bf5', background: 'rgba(77,139,245,0.1)', border: '1px solid rgba(77,139,245,0.25)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>+ 영상 추가</button>
            </div>
            {addingVideo && (
              <div style={addCard}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input placeholder="영상 제목 *" value={videoForm.title} onChange={e => setVideoForm(p => ({ ...p, title: e.target.value }))} style={inputStyle} onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                  <input placeholder="유튜브 URL *" value={videoForm.youtubeUrl} onChange={e => setVideoForm(p => ({ ...p, youtubeUrl: e.target.value }))} style={inputStyle} onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                  <input placeholder="주차 (예: 1)" type="number" value={videoForm.week} onChange={e => setVideoForm(p => ({ ...p, week: e.target.value }))} style={{ ...inputStyle, width: 100 }} onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={addVideo} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'rgba(52,209,126,0.15)', border: '1px solid rgba(52,209,126,0.3)', color: '#34d17e', cursor: 'pointer' }}>{saving ? '저장 중…' : '저장'}</button>
                    <button onClick={() => setAddingVideo(false)} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>취소</button>
                  </div>
                </div>
              </div>
            )}
            {lecture.videos.length === 0 ? (
              <div style={{ ...card, padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>등록된 영상이 없습니다.</div>
            ) : (
              lecture.videos.map((v, i) => (
                <div key={v.id} style={{ ...card, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(77,139,245,0.12)', border: '1px solid rgba(77,139,245,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#4d8bf5', flexShrink: 0 }}>{v.week || i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{v.title}</div>
                    <a href={v.youtubeUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#4d8bf5', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{v.youtubeUrl}</a>
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>{v.week}주차</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── 공지 탭 ── */}
        {tab === 'notices' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button onClick={() => setAddingNotice(true)} style={{ fontSize: 12, fontWeight: 700, color: '#f5a623', background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.25)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>+ 공지 추가</button>
            </div>
            {addingNotice && (
              <div style={{ ...addCard, border: '1px solid rgba(245,166,35,0.2)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input placeholder="공지 제목 *" value={noticeForm.title} onChange={e => setNoticeForm(p => ({ ...p, title: e.target.value }))} style={inputStyle} onFocus={e => (e.target.style.borderColor = 'rgba(245,166,35,0.5)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                  <textarea placeholder="내용" value={noticeForm.content} onChange={e => setNoticeForm(p => ({ ...p, content: e.target.value }))}
                    style={{ ...inputStyle, minHeight: 100, resize: 'vertical' } as React.CSSProperties}
                    onFocus={e => (e.target.style.borderColor = 'rgba(245,166,35,0.5)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={addNotice} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'rgba(52,209,126,0.15)', border: '1px solid rgba(52,209,126,0.3)', color: '#34d17e', cursor: 'pointer' }}>{saving ? '저장 중…' : '저장'}</button>
                    <button onClick={() => setAddingNotice(false)} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>취소</button>
                  </div>
                </div>
              </div>
            )}
            {lecture.notices.length === 0 ? (
              <div style={{ ...card, padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>등록된 공지가 없습니다.</div>
            ) : (
              lecture.notices.map(n => (
                <div key={n.id} style={{ ...card, padding: '16px 20px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{n.title}</div>
                  {n.content && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{n.content}</div>}
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 8 }}>{new Date(n.createdAt).toLocaleString('ko-KR')}</div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── 과제 탭 ── */}
        {tab === 'assignments' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button onClick={() => setAddingAssignment(true)} style={{ fontSize: 12, fontWeight: 700, color: '#34d17e', background: 'rgba(52,209,126,0.1)', border: '1px solid rgba(52,209,126,0.25)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>+ 과제 추가</button>
            </div>
            {addingAssignment && (
              <div style={{ ...addCard, border: '1px solid rgba(52,209,126,0.2)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input placeholder="과제 제목 *" value={assignmentForm.title} onChange={e => setAssignmentForm(p => ({ ...p, title: e.target.value }))} style={inputStyle} onFocus={e => (e.target.style.borderColor = 'rgba(52,209,126,0.5)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                  <textarea placeholder="과제 설명" value={assignmentForm.description} onChange={e => setAssignmentForm(p => ({ ...p, description: e.target.value }))}
                    style={{ ...inputStyle, minHeight: 80, resize: 'vertical' } as React.CSSProperties}
                    onFocus={e => (e.target.style.borderColor = 'rgba(52,209,126,0.5)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                  <input placeholder="마감일 (예: 2026-04-15)" value={assignmentForm.dueDate} onChange={e => setAssignmentForm(p => ({ ...p, dueDate: e.target.value }))} style={{ ...inputStyle, width: 200 }} onFocus={e => (e.target.style.borderColor = 'rgba(52,209,126,0.5)')} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={addAssignment} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'rgba(52,209,126,0.15)', border: '1px solid rgba(52,209,126,0.3)', color: '#34d17e', cursor: 'pointer' }}>{saving ? '저장 중…' : '저장'}</button>
                    <button onClick={() => setAddingAssignment(false)} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>취소</button>
                  </div>
                </div>
              </div>
            )}
            {lecture.assignments.length === 0 ? (
              <div style={{ ...card, padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>등록된 과제가 없습니다.</div>
            ) : (
              lecture.assignments.map(a => (
                <div key={a.id} style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{a.title}</div>
                    {a.description && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 6, lineHeight: 1.5 }}>{a.description}</div>}
                    {a.dueDate && <div style={{ fontSize: 11, color: '#f5a623' }}>마감: {a.dueDate}</div>}
                  </div>
                  <button onClick={() => deleteAssignment(a.id, a.title)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(239,84,84,0.35)', fontSize: 15, padding: '4px 6px', borderRadius: 6, flexShrink: 0,
                  }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ef5454')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,84,84,0.35)')}
                  >✕</button>
                </div>
              ))
            )}
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: 40, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          © 2026 박교준 수리논술 · 관리자 전용
        </p>
      </div>
    </div>
  )
}
