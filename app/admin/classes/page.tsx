'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface MediaItem { type: 'image' | 'youtube'; value: string }
interface ClassMode { enabled: boolean; price: number; campuses?: string[] }
interface SubjectPricingTier { count: number; price: number }
interface SubjectSelection { subjects: string[]; tiers: SubjectPricingTier[] }
interface ClassData {
  id: string; visible: boolean; name: string; category: string; badge: string
  image: string | null
  duration: string
  modes: { online: ClassMode; offline: ClassMode }
  textbook: { included: boolean; price: number }
  description: string; keywords: [string, string, string]
  createdAt: string; updatedAt: string
  media?: MediaItem[]
  subjectSelection?: SubjectSelection
}

const CAMPUSES = ['서울 대치', '인천 송도', '부산 센텀', '일산 후곡', '대구 수성']

const EMPTY_CLASS = {
  customId: '', visible: false, name: '', category: '수리논술', badge: '',
  image: null,
  duration: '',
  modes: { online: { enabled: true, price: 0 }, offline: { enabled: false, price: 0, campuses: [] as string[] } },
  textbook: { included: false, price: 0 },
  description: '', keywords: ['', '', ''] as [string, string, string],
  apply_label_online: '', apply_label_offline: '',
  media: [] as MediaItem[],
  subjectSelection: null as SubjectSelection | null,
}

const card: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16 }

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<ClassData[]>([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState<ClassData | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [imgUploading, setImgUploading] = useState(false)
  const imgRef = useRef<HTMLInputElement>(null)
  const [galleryUploading, setGalleryUploading] = useState(false)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [newYoutubeUrl, setNewYoutubeUrl] = useState('')
  const router = useRouter()

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/classes')
    if (res.status === 401) { router.push('/admin'); return }
    setClasses(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleVisible(cls: ClassData) {
    await fetch(`/api/admin/classes/${cls.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible: !cls.visible }),
    })
    load()
  }

  async function deleteClass(cls: ClassData) {
    if (!confirm(`"${cls.name}" 수업을 삭제하시겠습니까?\n이미지도 함께 삭제됩니다.`)) return
    await fetch(`/api/admin/classes/${cls.id}`, { method: 'DELETE' })
    load()
  }

  async function moveClass(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= classes.length) return
    const next = [...classes]
    ;[next[index], next[target]] = [next[target], next[index]]
    setClasses(next) // 낙관적 업데이트로 바로 순서 반영

    const res = await fetch('/api/admin/classes/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: next.map(c => c.id) }),
    })
    if (!res.ok) load() // 실패하면 서버 상태로 되돌림
  }

  function openNew() {
    setEditTarget(JSON.parse(JSON.stringify(EMPTY_CLASS)))
    setIsNew(true)
  }

  function openEdit(cls: ClassData) {
    setEditTarget(JSON.parse(JSON.stringify(cls)))
    setIsNew(false)
  }

  function closeEdit() { setEditTarget(null); setIsNew(false); setMsg(null) }

  async function save() {
    if (!editTarget) return
    setSaving(true); setMsg(null)
    const method = isNew ? 'POST' : 'PUT'
    const url    = isNew ? '/api/admin/classes' : `/api/admin/classes/${editTarget.id}`
    const body   = isNew
      ? { ...editTarget, id: (editTarget as any).customId || undefined }
      : editTarget
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const saved = await res.json()
      setMsg({ type: 'success', text: '저장됐습니다.' })
      if (isNew) { setEditTarget(saved); setIsNew(false) }
      load()
    } else {
      const d = await res.json()
      setMsg({ type: 'error', text: d.error || '저장 실패' })
    }
    setSaving(false)
  }

  async function uploadImage(file: File) {
    if (!editTarget || isNew) { setMsg({ type: 'error', text: '먼저 기본 정보를 저장하세요.' }); return }
    setImgUploading(true)
    const fd = new FormData(); fd.append('image', file)
    const res = await fetch(`/api/admin/classes/${editTarget.id}/image`, { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok) {
      setEditTarget(p => p ? { ...p, image: data.filename } : p)
      load()
    } else {
      setMsg({ type: 'error', text: data.error || '이미지 업로드 실패' })
    }
    setImgUploading(false)
  }

  async function uploadMediaImage(file: File) {
    if (!editTarget || isNew) { setMsg({ type: 'error', text: '먼저 기본 정보를 저장하세요.' }); return }
    setGalleryUploading(true)
    const fd = new FormData(); fd.append('image', file)
    const res = await fetch(`/api/admin/classes/${editTarget.id}/gallery`, { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok) {
      // 목록 맨 뒤에 추가 — 순서는 "저장" 눌러야 실제 반영됨
      setEditTarget(p => p ? { ...p, media: [...(p.media ?? []), { type: 'image', value: data.filename }] } : p)
    } else {
      setMsg({ type: 'error', text: data.error || '사진 업로드 실패' })
    }
    setGalleryUploading(false)
  }

  function addYoutubeMedia() {
    const url = newYoutubeUrl.trim()
    if (!url) return
    setEditTarget(p => p ? { ...p, media: [...(p.media ?? []), { type: 'youtube', value: url }] } : p)
    setNewYoutubeUrl('')
  }

  function removeMediaItem(index: number) {
    setEditTarget(p => {
      if (!p) return p
      const media = [...(p.media ?? [])]
      const [removed] = media.splice(index, 1)
      if (removed?.type === 'image') {
        fetch(`/api/admin/classes/${p.id}/gallery`, {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: removed.value }),
        }).catch(() => {})
      }
      return { ...p, media }
    })
  }

  function moveMediaItem(index: number, dir: -1 | 1) {
    setEditTarget(p => {
      if (!p) return p
      const media = [...(p.media ?? [])]
      const target = index + dir
      if (target < 0 || target >= media.length) return p
      ;[media[index], media[target]] = [media[target], media[index]]
      return { ...p, media }
    })
  }

  function upd(path: string[], value: unknown) {
    setEditTarget(prev => {
      if (!prev) return prev
      const next = JSON.parse(JSON.stringify(prev))
      let obj: Record<string, unknown> = next
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]] as Record<string, unknown>
      obj[path[path.length - 1]] = value
      return next
    })
  }

  const DEFAULT_SUBJECT_SELECTION: SubjectSelection = {
    subjects: ['수1', '수2', '미적'],
    tiers: [{ count: 1, price: 280000 }, { count: 2, price: 500000 }, { count: 3, price: 700000 }],
  }

  function toggleSubjectSelection(enabled: boolean) {
    upd(['subjectSelection'], enabled ? (editTarget?.subjectSelection ?? DEFAULT_SUBJECT_SELECTION) : null)
  }
  function updSubject(i: number, value: string) {
    const cur = editTarget?.subjectSelection; if (!cur) return
    const subjects = [...cur.subjects]; subjects[i] = value
    upd(['subjectSelection', 'subjects'], subjects)
  }
  function addSubject() {
    const cur = editTarget?.subjectSelection; if (!cur) return
    upd(['subjectSelection', 'subjects'], [...cur.subjects, ''])
  }
  function removeSubject(i: number) {
    const cur = editTarget?.subjectSelection; if (!cur) return
    upd(['subjectSelection', 'subjects'], cur.subjects.filter((_, idx) => idx !== i))
  }
  function updTier(i: number, field: 'count' | 'price', value: number) {
    const cur = editTarget?.subjectSelection; if (!cur) return
    const tiers = cur.tiers.map((t, idx) => idx === i ? { ...t, [field]: value } : t)
    upd(['subjectSelection', 'tiers'], tiers)
  }
  function addTier() {
    const cur = editTarget?.subjectSelection; if (!cur) return
    const nextCount = (cur.tiers[cur.tiers.length - 1]?.count ?? 0) + 1
    upd(['subjectSelection', 'tiers'], [...cur.tiers, { count: nextCount, price: 0 }])
  }
  function removeTier(i: number) {
    const cur = editTarget?.subjectSelection; if (!cur) return
    upd(['subjectSelection', 'tiers'], cur.tiers.filter((_, idx) => idx !== i))
  }

  const inp: React.CSSProperties = {
    width: '100%', background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
    padding: '10px 14px', fontSize: 13, color: '#fff', outline: 'none',
  }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', display: 'block', marginBottom: 6 }

  // ── 수업 목록 ──────────────────────────────────────────────────────
  if (!editTarget) return (
    <div style={{ minHeight: '100vh', padding: '0 0 80px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '36px 20px 0' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <a href="/admin/dashboard" style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>← 대시보드</a>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginTop: 6 }}>수업 관리</h1>
          </div>
          <button onClick={openNew} style={{
            padding: '10px 18px', background: 'linear-gradient(135deg,#0066FF,#4d8bf5)',
            border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>+ 수업 추가</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}>불러오는 중…</div>
        ) : classes.length === 0 ? (
          <div style={{ ...card, padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
            등록된 수업이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {classes.map((cls, index) => (
              <div key={cls.id} style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* 순서 이동 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                  <button
                    onClick={() => moveClass(index, -1)}
                    disabled={index === 0}
                    title="위로 이동"
                    style={{
                      width: 26, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
                      color: index === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)',
                      cursor: index === 0 ? 'not-allowed' : 'pointer', fontSize: 11, lineHeight: 1,
                    }}
                  >▲</button>
                  <button
                    onClick={() => moveClass(index, 1)}
                    disabled={index === classes.length - 1}
                    title="아래로 이동"
                    style={{
                      width: 26, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
                      color: index === classes.length - 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)',
                      cursor: index === classes.length - 1 ? 'not-allowed' : 'pointer', fontSize: 11, lineHeight: 1,
                    }}
                  >▼</button>
                </div>

                {/* 이미지 */}
                <div style={{ width: 64, height: 48, borderRadius: 8, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
                  {cls.image
                    ? <img src={`/api/images/${cls.image}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📚</div>
                  }
                </div>

                {/* 정보 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{cls.name}</span>
                    {cls.badge && <span style={{ fontSize: 9, fontWeight: 800, color: '#f0c040', background: 'rgba(240,192,64,0.12)', border: '1px solid rgba(240,192,64,0.2)', borderRadius: 4, padding: '1px 6px' }}>{cls.badge}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                    {cls.category} · {cls.modes.online.enabled ? `온라인 ${cls.modes.online.price.toLocaleString()}원` : ''}
                    {cls.modes.online.enabled && cls.modes.offline.enabled ? ' / ' : ''}
                    {cls.modes.offline.enabled ? `오프라인 ${cls.modes.offline.price.toLocaleString()}원` : ''}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(77,139,245,0.6)', fontFamily: "'DM Mono',monospace", marginTop: 3 }}>
                    /classes/{cls.id} · /apply/{cls.id}
                  </div>
                </div>

                {/* 공개 토글 */}
                <button onClick={() => toggleVisible(cls)} style={{
                  padding: '5px 12px', fontSize: 11, fontWeight: 700, borderRadius: 20, border: 'none', cursor: 'pointer',
                  background: cls.visible ? 'rgba(52,209,126,0.15)' : 'rgba(255,255,255,0.06)',
                  color: cls.visible ? '#34d17e' : 'rgba(255,255,255,0.3)',
                  border: `1px solid ${cls.visible ? 'rgba(52,209,126,0.25)' : 'rgba(255,255,255,0.08)'}` as string,
                }}>
                  {cls.visible ? '공개' : '비공개'}
                </button>

                <button onClick={() => openEdit(cls)} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: 'rgba(77,139,245,0.12)', border: '1px solid rgba(77,139,245,0.2)', borderRadius: 8, color: '#4d8bf5', cursor: 'pointer' }}>수정</button>
                <button onClick={() => deleteClass(cls)} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: 'rgba(239,84,84,0.08)', border: '1px solid rgba(239,84,84,0.15)', borderRadius: 8, color: '#ef5454', cursor: 'pointer' }}>삭제</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  // ── 수업 편집 폼 ──────────────────────────────────────────────────
  const e = editTarget!
  return (
    <div style={{ minHeight: '100vh', padding: '0 0 100px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '36px 20px 0' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <button onClick={closeEdit} style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}>← 목록으로</button>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginTop: 6 }}>{isNew ? '수업 추가' : '수업 수정'}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => upd(['visible'], !e.visible)} style={{
              padding: '8px 14px', fontSize: 12, fontWeight: 700, borderRadius: 20, border: 'none', cursor: 'pointer',
              background: e.visible ? 'rgba(52,209,126,0.15)' : 'rgba(255,255,255,0.06)',
              color: e.visible ? '#34d17e' : 'rgba(255,255,255,0.3)',
              border: `1px solid ${e.visible ? 'rgba(52,209,126,0.25)' : 'rgba(255,255,255,0.1)'}` as string,
            }}>{e.visible ? '공개 중' : '비공개'}</button>
            <button onClick={save} disabled={saving} style={{
              padding: '8px 20px', background: saving ? 'rgba(0,102,255,0.3)' : 'linear-gradient(135deg,#0066FF,#4d8bf5)',
              border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
            }}>{saving ? '저장 중…' : '저장'}</button>
          </div>
        </div>

        {msg && <div style={{ borderRadius: 10, padding: '11px 16px', marginBottom: 16, fontSize: 13, background: msg.type === 'success' ? 'rgba(52,209,126,0.08)' : 'rgba(239,84,84,0.08)', border: `1px solid ${msg.type === 'success' ? 'rgba(52,209,126,0.2)' : 'rgba(239,84,84,0.2)'}`, color: msg.type === 'success' ? '#6ef5b0' : '#f08888' }}>{msg.text}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* 이미지 */}
          <div style={{ ...card, padding: 20 }}>
            <label style={lbl}>수업 카드 이미지</label>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 120, height: 80, borderRadius: 10, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
                {e.image
                  ? <img src={`/api/images/${e.image}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>📷</div>
                }
              </div>
              <div>
                <input ref={imgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={ev => { const f = ev.target.files?.[0]; if (f) uploadImage(f) }} />
                <button onClick={() => imgRef.current?.click()} disabled={imgUploading || isNew} style={{
                  padding: '8px 16px', background: 'rgba(77,139,245,0.12)', border: '1px solid rgba(77,139,245,0.25)',
                  borderRadius: 8, color: '#4d8bf5', fontSize: 12, fontWeight: 700, cursor: isNew ? 'not-allowed' : 'pointer', opacity: isNew ? 0.5 : 1,
                }}>{imgUploading ? '업로드 중…' : '이미지 선택'}</button>
                {isNew && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 6 }}>기본 정보 저장 후 이미지 업로드 가능</p>}
              </div>
            </div>
          </div>

          {/* 상세페이지 사진 + 유튜브 (순서대로 표시됨) */}
          <div style={{ ...card, padding: 20 }}>
            <label style={lbl}>상세페이지 사진 · 유튜브 <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, fontSize: 10 }}>여기 나열된 순서 그대로 상세페이지에 표시됩니다</span></label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {(e.media ?? []).length === 0 && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', padding: '8px 0' }}>등록된 사진/영상이 없습니다.</div>
              )}
              {(e.media ?? []).map((item, index) => (
                <div key={index} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8,
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button onClick={() => moveMediaItem(index, -1)} disabled={index === 0} style={{
                      width: 22, height: 18, fontSize: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 5, color: index === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)', cursor: index === 0 ? 'not-allowed' : 'pointer',
                    }}>▲</button>
                    <button onClick={() => moveMediaItem(index, 1)} disabled={index === (e.media ?? []).length - 1} style={{
                      width: 22, height: 18, fontSize: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 5, color: index === (e.media ?? []).length - 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.6)',
                      cursor: index === (e.media ?? []).length - 1 ? 'not-allowed' : 'pointer',
                    }}>▼</button>
                  </div>

                  {item.type === 'image' ? (
                    <div style={{ width: 64, height: 46, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.06)' }}>
                      <img src={`/api/images/${item.value}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{ width: 64, height: 46, borderRadius: 6, flexShrink: 0, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>▶</div>
                  )}

                  <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.type === 'image' ? '사진' : item.value}
                  </div>

                  <button onClick={() => removeMediaItem(index)} title="삭제" style={{
                    width: 24, height: 24, borderRadius: '50%', background: 'rgba(239,84,84,0.1)', border: '1px solid rgba(239,84,84,0.2)',
                    color: '#ef5454', fontSize: 12, cursor: 'pointer', flexShrink: 0,
                  }}>✕</button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input ref={galleryRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={ev => { const f = ev.target.files?.[0]; if (f) uploadMediaImage(f); ev.target.value = '' }} />
              <button onClick={() => galleryRef.current?.click()} disabled={galleryUploading || isNew} style={{
                padding: '8px 16px', background: 'rgba(77,139,245,0.12)', border: '1px solid rgba(77,139,245,0.25)',
                borderRadius: 8, color: '#4d8bf5', fontSize: 12, fontWeight: 700, cursor: isNew ? 'not-allowed' : 'pointer', opacity: isNew ? 0.5 : 1,
              }}>{galleryUploading ? '업로드 중…' : '+ 사진 추가'}</button>
            </div>
            {isNew && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 6 }}>기본 정보 저장 후 사진/영상 추가 가능</p>}

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input
                style={{ ...inp, flex: 1 }}
                value={newYoutubeUrl}
                onChange={ev => setNewYoutubeUrl(ev.target.value)}
                placeholder="유튜브 URL 붙여넣기 (예: https://www.youtube.com/watch?v=xxxxxxxxxxx)"
              />
              <button onClick={addYoutubeMedia} disabled={!newYoutubeUrl.trim() || isNew} style={{
                padding: '8px 16px', background: 'rgba(77,139,245,0.12)', border: '1px solid rgba(77,139,245,0.25)',
                borderRadius: 8, color: '#4d8bf5', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                cursor: (!newYoutubeUrl.trim() || isNew) ? 'not-allowed' : 'pointer', opacity: (!newYoutubeUrl.trim() || isNew) ? 0.5 : 1,
              }}>+ 영상 추가</button>
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 8 }}>▲▼ 버튼으로 순서를 바꾼 뒤, 반드시 화면 위쪽 "저장" 버튼을 눌러야 순서가 반영됩니다.</p>
          </div>

          {/* 기본 정보 */}
          <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>수업 ID <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, fontSize: 10 }}>URL에 사용됨</span></label>
                <input
                  style={{ ...inp, fontFamily: "'DM Mono',monospace", opacity: !isNew ? 0.5 : 1 }}
                  value={isNew ? ((e as any).customId ?? '') : (e as any).id ?? ''}
                  onChange={ev => isNew && upd(['customId'], ev.target.value.replace(/[^a-z0-9-_]/g, '').toLowerCase())}
                  placeholder="예: operon (영문·숫자·-만 가능)"
                  readOnly={!isNew}
                />
                {isNew && <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>비우면 자동 생성됩니다</p>}
              </div>
              <div>
                <label style={lbl}>수업명</label>
                <input style={inp} value={e.name} onChange={ev => upd(['name'], ev.target.value)} placeholder="예: 수리논술 오페론" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>카테고리</label>
                <select style={{ ...inp }} value={e.category} onChange={ev => upd(['category'], ev.target.value)}>
                  <option value="수리논술">수리논술</option>
                  <option value="수능수학">수능수학</option>
                </select>
              </div>
              <div>
                <label style={lbl}>배지</label>
                <select style={{ ...inp }} value={e.badge || ''} onChange={ev => upd(['badge'], ev.target.value)}>
                  <option value="">없음</option>
                  <option value="BEST">BEST</option>
                  <option value="HOT">HOT</option>
                  <option value="NEW">NEW</option>
                </select>
              </div>
            </div>
            <div>
              <label style={lbl}>수업 설명</label>
              <textarea style={{ ...inp, height: 90, resize: 'vertical' }} value={e.description} onChange={ev => upd(['description'], ev.target.value)} placeholder="수업 상세 설명" />
            </div>
            <div>
              <label style={lbl}>키워드 3개</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[0, 1, 2].map(i => (
                  <input key={i} style={inp} value={e.keywords[i]} placeholder={`키워드 ${i + 1}`}
                    onChange={ev => { const kw = [...e.keywords] as [string,string,string]; kw[i] = ev.target.value; upd(['keywords'], kw) }} />
                ))}
              </div>
            </div>
            <div>
              <label style={lbl}>수업 일정 <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, fontSize: 10 }}>카드에 표시됨</span></label>
              <input
                style={inp}
                value={e.duration}
                onChange={ev => upd(['duration'], ev.target.value)}
                placeholder="예: 1개월 주1회 3시간"
              />
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>수업 카드 하단 시계 아이콘 옆에 표시됩니다</p>
            </div>
            <div>
              <label style={lbl}>수강신청 라벨 — 온라인 <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, fontSize: 10 }}>구글 시트에 기록됨</span></label>
              <input
                style={inp}
                value={(e as any).apply_label_online ?? ''}
                onChange={ev => upd(['apply_label_online'], ev.target.value)}
                placeholder="예: 【수리논술 온라인】 오페론 수열과 규칙성 신청"
              />
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>비워두면 기존 자동 생성 방식 유지</p>
            </div>
            <div>
              <label style={lbl}>수강신청 라벨 — 현강 <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, fontSize: 10 }}>구글 시트에 기록됨</span></label>
              <input
                style={inp}
                value={(e as any).apply_label_offline ?? ''}
                onChange={ev => upd(['apply_label_offline'], ev.target.value)}
                placeholder="예: 【수리논술 현강】 오페론 수열과 규칙성 신청"
              />
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>비워두면 기존 자동 생성 방식 유지</p>
            </div>
          </div>

          {/* 운영 방식 */}
          <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>운영 방식 & 금액</div>

            {/* 온라인 */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: e.modes.online.enabled ? 12 : 0 }}>
                <input type="checkbox" checked={e.modes.online.enabled} onChange={ev => upd(['modes','online','enabled'], ev.target.checked)} id="online-cb" />
                <label htmlFor="online-cb" style={{ fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>온라인</label>
              </div>
              {e.modes.online.enabled && (
                <div>
                  <label style={{ ...lbl }}>금액 (원)</label>
                  <input type="number" style={inp} value={e.modes.online.price} onChange={ev => upd(['modes','online','price'], Number(ev.target.value))} />
                </div>
              )}
            </div>

            {/* 오프라인 */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: e.modes.offline.enabled ? 12 : 0 }}>
                <input type="checkbox" checked={e.modes.offline.enabled} onChange={ev => upd(['modes','offline','enabled'], ev.target.checked)} id="offline-cb" />
                <label htmlFor="offline-cb" style={{ fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>오프라인</label>
              </div>
              {e.modes.offline.enabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={lbl}>금액 (원)</label>
                    <input type="number" style={inp} value={e.modes.offline.price} onChange={ev => upd(['modes','offline','price'], Number(ev.target.value))} />
                  </div>
                  <div>
                    <label style={lbl}>운영 캠퍼스</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {CAMPUSES.map(campus => {
                        const selected = (e.modes.offline.campuses || []).includes(campus)
                        return (
                          <button key={campus} onClick={() => {
                            const cur = e.modes.offline.campuses || []
                            upd(['modes','offline','campuses'], selected ? cur.filter(c => c !== campus) : [...cur, campus])
                          }} style={{
                            padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 20, cursor: 'pointer', border: 'none',
                            background: selected ? 'rgba(77,139,245,0.15)' : 'rgba(255,255,255,0.05)',
                            color: selected ? '#4d8bf5' : 'rgba(255,255,255,0.4)',
                            border: `1px solid ${selected ? 'rgba(77,139,245,0.3)' : 'rgba(255,255,255,0.08)'}` as string,
                            transition: 'all 0.15s',
                          }}>{selected ? '✓ ' : ''}{campus}</button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 교재비 */}
          <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>교재비</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={e.textbook.included} onChange={ev => upd(['textbook','included'], ev.target.checked)} id="tb-cb" />
              <label htmlFor="tb-cb" style={{ fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>교재비 별도 포함</label>
            </div>
            {e.textbook.included && (
              <div>
                <label style={lbl}>교재비 (원)</label>
                <input type="number" style={inp} value={e.textbook.price} onChange={ev => upd(['textbook','price'], Number(ev.target.value))} />
              </div>
            )}
          </div>

          {/* 과목 개수 선택형 가격 (예: 수능수학 추월반 — 수1/수2/미적 중 원하는 만큼 선택) */}
          <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={!!e.subjectSelection} onChange={ev => toggleSubjectSelection(ev.target.checked)} id="subj-cb" />
              <label htmlFor="subj-cb" style={{ fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>과목 개수 선택형 신청 사용</label>
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: -8 }}>
              켜면 신청 페이지에서 위 &ldquo;운영 방식 &amp; 금액&rdquo;의 금액 대신, 학생이 과목을 원하는 만큼 선택하고 선택한 개수에 따라 아래 가격표대로 청구됩니다.
            </p>

            {e.subjectSelection && (
              <>
                <div>
                  <label style={lbl}>선택 가능한 과목</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {e.subjectSelection.subjects.map((subj, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8 }}>
                        <input style={inp} value={subj} placeholder="예: 수1" onChange={ev => updSubject(i, ev.target.value)} />
                        <button onClick={() => removeSubject(i)} style={{ padding: '0 14px', background: 'rgba(239,84,84,0.1)', border: '1px solid rgba(239,84,84,0.2)', borderRadius: 10, color: '#f08888', fontSize: 12, cursor: 'pointer' }}>삭제</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={addSubject} style={{ marginTop: 8, padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer' }}>+ 과목 추가</button>
                </div>

                <div>
                  <label style={lbl}>개수별 가격표 <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, fontSize: 10 }}>과목을 추가해도 이 표에 개수를 추가해두면 계속 확장 가능</span></label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {e.subjectSelection.tiers
                      .map((tier, i) => ({ tier, i }))
                      .sort((a, b) => a.tier.count - b.tier.count)
                      .map(({ tier, i }) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ width: 90 }}>
                            <input type="number" min={1} style={inp} value={tier.count} onChange={ev => updTier(i, 'count', Number(ev.target.value))} />
                          </div>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>과목 →</span>
                          <input type="number" style={inp} value={tier.price} onChange={ev => updTier(i, 'price', Number(ev.target.value))} placeholder="가격 (원)" />
                          <button onClick={() => removeTier(i)} style={{ padding: '0 14px', background: 'rgba(239,84,84,0.1)', border: '1px solid rgba(239,84,84,0.2)', borderRadius: 10, color: '#f08888', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>삭제</button>
                        </div>
                      ))}
                  </div>
                  <button onClick={addTier} style={{ marginTop: 8, padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer' }}>+ 가격 구간 추가</button>
                </div>
              </>
            )}
          </div>

        </div>

        <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={closeEdit} style={{ padding: '11px 20px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer' }}>취소</button>
          <button onClick={save} disabled={saving} style={{ padding: '11px 24px', background: saving ? 'rgba(0,102,255,0.3)' : 'linear-gradient(135deg,#0066FF,#4d8bf5)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? '저장 중…' : '저장하기'}</button>
        </div>
      </div>
    </div>
  )
}
