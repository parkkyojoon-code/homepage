'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Lecture {
  id: string
  name: string
  description: string
  videos: unknown[]
  notices: unknown[]
  assignments: unknown[]
}

export default function AdminLecturesPage() {
  const router = useRouter()
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/lectures', { cache: 'no-store' })
      .then(r => { if (r.status === 401) { router.push('/admin'); return null } return r.json() })
      .then(data => { if (data) setLectures(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/lectures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const lecture = await res.json()
        setLectures(p => [...p, lecture])
        setForm({ name: '', description: '' })
        setAdding(false)
      }
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" 강의를 삭제할까요?`)) return
    const res = await fetch(`/api/admin/lectures/${id}`, { method: 'DELETE' })
    if (res.ok) setLectures(p => p.filter(l => l.id !== id))
  }

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16, overflow: 'hidden',
  }
  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: '#fff', fontSize: 13, padding: '9px 12px',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 80px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '36px 20px 0' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <button onClick={() => router.push('/admin/dashboard')} style={{
              fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'none',
              border: 'none', cursor: 'pointer', padding: 0, marginBottom: 8, display: 'block',
            }}>← 대시보드</button>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>강의 관리</h1>
          </div>
          <button onClick={() => setAdding(true)} style={{
            fontSize: 13, fontWeight: 700, color: '#4d8bf5',
            background: 'rgba(77,139,245,0.1)', border: '1px solid rgba(77,139,245,0.25)',
            borderRadius: 10, padding: '9px 18px', cursor: 'pointer',
          }}>+ 강의 추가</button>
        </div>

        {/* 강의 추가 폼 */}
        {adding && (
          <div style={{ ...card, marginBottom: 16, padding: '20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>새 강의</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                placeholder="강의명 *"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
              <input
                placeholder="강의 설명 (선택)"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleAdd} disabled={saving || !form.name.trim()} style={{
                  padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: 'rgba(52,209,126,0.15)', border: '1px solid rgba(52,209,126,0.3)',
                  color: '#34d17e', cursor: 'pointer',
                }}>{saving ? '저장 중…' : '저장'}</button>
                <button onClick={() => { setAdding(false); setForm({ name: '', description: '' }) }} style={{
                  padding: '9px 16px', borderRadius: 8, fontSize: 13,
                  background: 'none', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                }}>취소</button>
              </div>
            </div>
          </div>
        )}

        {/* 강의 목록 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}>불러오는 중…</div>
        ) : lectures.length === 0 ? (
          <div style={{ ...card, padding: 48, textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
            등록된 강의가 없습니다. 위 버튼으로 추가하세요.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lectures.map(lec => (
              <div key={lec.id} style={{
                ...card, padding: '20px 24px',
                display: 'flex', alignItems: 'center', gap: 16,
                cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s',
              }}
                onClick={() => router.push(`/admin/lectures/${lec.id}`)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(77,139,245,0.3)'; e.currentTarget.style.background = 'rgba(77,139,245,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: 'rgba(77,139,245,0.12)', border: '1px solid rgba(77,139,245,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                }}>🎬</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{lec.name}</div>
                  {lec.description && (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lec.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                    {[
                      { label: '영상', count: lec.videos.length, color: '#4d8bf5' },
                      { label: '공지', count: lec.notices.length, color: '#f5a623' },
                      { label: '과제', count: lec.assignments.length, color: '#34d17e' },
                    ].map(({ label, count, color }) => (
                      <span key={label} style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                        <span style={{ color, fontWeight: 700 }}>{count}</span> {label}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); handleDelete(lec.id, lec.name) }} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(239,84,84,0.35)', fontSize: 16, padding: '6px 8px', borderRadius: 6, flexShrink: 0,
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ef5454')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,84,84,0.35)')}
                >✕</button>
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 18, flexShrink: 0 }}>›</div>
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
