'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Lecture = { id: string; title: string; description: string; video_ready: boolean }
export default function Classroom() {
  const [items, setItems] = useState<Lecture[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'login' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const active = useRef<AbortController | null>(null)
  const load = useCallback(async () => {
    active.current?.abort()
    const controller = new AbortController(); active.current = controller
    setItems([]); setState('loading'); setMessage('')
    try {
      const res = await fetch('/api/lectures/entitlements', { cache: 'no-store', signal: controller.signal })
      const data = await res.json()
      if (!res.ok) { setState(res.status === 401 ? 'login' : 'error'); setMessage(data.error); return }
      setItems(data); setState('ready')
    } catch { if (!controller.signal.aborted) { setState('error'); setMessage('강의를 불러오지 못했습니다. 다시 시도해주세요.') } }
  }, [])
  useEffect(() => { void load(); return () => active.current?.abort() }, [load])
  return <main style={{ maxWidth: 960, margin: 'auto', padding: '48px 24px', color: '#f8fafc' }}>
    <Link href="/lectures">← 강의 목록 / 내 주문</Link><h1>내 강의실</h1>
    <p>결제가 확인되고 이용 권한이 활성화된 강의입니다.</p>
    <p role="status">{state === 'loading' ? '강의를 불러오는 중입니다.' : message}</p>
    {state === 'login' && <Link href="/lectures/login">강의 계정으로 로그인</Link>}
    {state === 'ready' && !items.length && <p>이용 가능한 강의가 없습니다. 결제 대기 중이라면 내 주문에서 상태를 확인해주세요.</p>}
    <div style={{ display: 'grid', gap: 20 }}>{items.map(item => <article key={item.id} style={{ padding: 24, background: '#182538', borderRadius: 12 }}>
      <h2>{item.title}</h2><p>{item.description}</p>
      {item.video_ready ? <a href={`/api/lectures/${item.id}/access`} target="_blank" rel="noopener noreferrer">강의 바로가기 ↗</a> : <p>영상 준비 중 · 등록되면 여기서 확인할 수 있습니다.</p>}
    </article>)}</div>
    <p><button disabled={state === 'loading'} onClick={load}>내 강의 새로고침</button></p>
  </main>
}
