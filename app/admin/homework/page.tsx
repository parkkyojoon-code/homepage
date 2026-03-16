'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface StatusData {
  count: number
  filename: string | null
  uploaded_at: string | null
}

export default function AdminHomeworkPage() {
  const [status, setStatus] = useState<StatusData | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function fetchStatus() {
    setStatusLoading(true)
    try {
      const res = await fetch('/api/admin/homework/status', { cache: 'no-store' })
      if (res.status === 401) { router.push('/admin'); return }
      const data = await res.json()
      setStatus(data)
    } catch {
      setStatus(null)
    } finally {
      setStatusLoading(false)
    }
  }

  useEffect(() => { fetchStatus() }, [])

  function handleFile(f: File | null) {
    if (!f) return
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.xls')) {
      setMessage({ type: 'error', text: '.xlsx 파일만 업로드 가능합니다.' })
      return
    }
    setFile(f); setMessage(null)
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true); setMessage(null)

    const formData = new FormData()
    formData.append('excel', file)

    try {
      const res = await fetch('/api/admin/homework/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: data.message || '✅ 업데이트 완료' })
        setFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        await fetchStatus()
      } else {
        setMessage({ type: 'error', text: data.error || '업로드 실패' })
      }
    } catch {
      setMessage({ type: 'error', text: '서버 오류가 발생했습니다.' })
    } finally {
      setUploading(false)
    }
  }

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
  }

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 80px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '36px 20px 0' }}>

        {/* 상단 */}
        <div style={{ marginBottom: 32 }}>
          <button onClick={() => router.push('/admin/dashboard')} style={{
            fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'none',
            border: 'none', cursor: 'pointer', padding: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4,
          }}>← 대시보드</button>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 6 }}>📋 과제 관리</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>
            엑셀 파일을 업로드하면 학생 과제 데이터가 즉시 업데이트됩니다.
          </p>
        </div>

        {/* 스탯 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div style={{ ...card, padding: '22px 20px' }}>
            <div style={{ fontSize: 36, fontWeight: 900, fontFamily: "'DM Mono',monospace", color: '#4d8bf5', lineHeight: 1, marginBottom: 6 }}>
              {statusLoading ? '…' : (status?.count ?? 0)}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>현재 등록 학생 수</div>
          </div>
          <div style={{ ...card, padding: '22px 20px' }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#34d17e', lineHeight: 1, marginBottom: 6 }}>Live</div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>서비스 상태</div>
          </div>
        </div>

        {/* 현재 파일 */}
        <div style={{ ...card, padding: '18px 22px', borderLeft: '3px solid rgba(77,139,245,0.5)', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4d8bf5', marginBottom: 10 }}>
            📁 현재 등록된 파일
          </div>
          {statusLoading ? (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>불러오는 중…</div>
          ) : status?.filename ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "'DM Mono',monospace", marginBottom: 4, wordBreak: 'break-all' }}>
                {status.filename}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                {status.uploaded_at} 업로드 · {status.count}명
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>아직 업로드된 파일이 없습니다.</div>
          )}
        </div>

        {/* 업로드 카드 */}
        <div style={{ ...card, padding: 28, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>📂 엑셀 파일 업로드</h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 22 }}>
            새 엑셀 파일을 업로드하면 기존 데이터를 완전히 교체합니다.
          </p>

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
            style={{
              border: `2px dashed ${dragging ? '#4d8bf5' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 12, padding: '36px 20px', textAlign: 'center',
              cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s',
              background: dragging ? 'rgba(77,139,245,0.04)' : 'transparent',
              marginBottom: 14,
            }}
          >
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files?.[0] || null)} />
            <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
              {file ? file.name : '파일을 여기에 끌어다 놓거나 클릭하여 선택'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
              {file ? `${(file.size / 1024).toFixed(1)} KB` : '.xlsx 파일만 가능합니다'}
            </div>
          </div>

          {message && (
            <div style={{
              borderRadius: 10, padding: '12px 16px', marginBottom: 14, fontSize: 13,
              background: message.type === 'success' ? 'rgba(52,209,126,0.08)' : 'rgba(239,84,84,0.08)',
              border: `1px solid ${message.type === 'success' ? 'rgba(52,209,126,0.25)' : 'rgba(239,84,84,0.22)'}`,
              color: message.type === 'success' ? '#6ef5b0' : '#f08888',
            }}>{message.text}</div>
          )}

          <button onClick={handleUpload} disabled={!file || uploading} style={{
            width: '100%', padding: '14px',
            background: !file || uploading ? 'rgba(0,102,255,0.25)' : 'linear-gradient(135deg, #0066FF, #4d8bf5)',
            border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700,
            cursor: !file || uploading ? 'not-allowed' : 'pointer',
            boxShadow: !file || uploading ? 'none' : '0 4px 20px rgba(0,102,255,0.3)',
          }}>
            {uploading ? '업로드 중…' : '업로드 & 업데이트'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => router.push('/admin/homework/guide')} style={{
            flex: 1, textAlign: 'center', padding: '12px',
            background: 'rgba(77,139,245,0.08)', border: '1px solid rgba(77,139,245,0.2)',
            borderRadius: 12, color: '#4d8bf5', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>📖 상세 입력 가이드 보기</button>
        </div>

        <p style={{ textAlign: 'center', marginTop: 48, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          © 2026 박교준 수리논술 · 관리자 전용
        </p>
      </div>
    </div>
  )
}