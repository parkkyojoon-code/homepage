'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { orderStatus } from '@/lib/lectures/order-status'

type Order = { id: string; status: string; recipient_name: string|null; recipient_phone: string|null; billing: {state:string;sent_at:string|null;due_at:string|null;needs_review:boolean}|null; access_control: string; total_won: number; created_at: string; items: { lecture_id: string; title_snapshot: string; price_won: number }[] }
export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(true)
  const active = useRef<AbortController | null>(null)
  const refresh = useCallback(async () => {
    active.current?.abort()
    const controller = new AbortController(); active.current = controller
    setBusy(true); setMessage('')
    try {
      const r = await fetch(`/api/lectures/orders/${encodeURIComponent(id)}`, { cache: 'no-store', signal: controller.signal })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      setOrder(d)
    } catch (e) { if (!controller.signal.aborted) { setOrder(null); setMessage(e instanceof Error ? e.message : '주문을 불러오지 못했습니다.') } }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }, [id])
  useEffect(() => { void refresh(); return () => active.current?.abort() }, [refresh])
  const status = order ? orderStatus(order.status) : null
  return <main className="lecture-page lecture-page--detail">
    <Link href="/lectures">← 강의 목록 / 내 주문</Link><h1>주문 상세</h1>
    <p role="status">{busy ? '최신 상태를 확인하고 있습니다.' : message}</p>
    {!busy && order && <><h2>{status?.label}</h2><p>{status?.detail}</p>
      <p>주문번호: {order.id}</p><p>주문일: {new Date(order.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p>
      <ul>{order.items.map(i => <li key={i.lecture_id} style={{ padding: 16 }}>{i.title_snapshot} · {i.price_won.toLocaleString()}원</li>)}</ul>
      <h2>주문 금액 {order.total_won.toLocaleString()}원</h2>
      {order.status === 'PAID' && order.access_control !== 'MANUAL_CLOSED' && <p><Link href="/lectures/classroom">내 강의실에서 구매 강의 확인하기</Link></p>}
      {order.access_control === 'MANUAL_CLOSED' && <p>이 주문의 수강 권한은 관리자가 회수하거나 종료했습니다. 실제 결제 취소·환불 여부는 관리자에게 문의해주세요.</p>}
      {order.status === 'CANCELLED' && <p>사이트의 주문 이용이 취소된 상태입니다. 실제 결제 취소·환불 여부는 관리자에게 별도로 확인해주세요.</p>}
      {order.billing&&<><p>청구서 수신자: {order.recipient_name} · {order.recipient_phone}</p><p>{order.billing.state==='PENDING'?'청구서 발송을 기다리고 있습니다.':order.billing.state==='SENT'?'청구서 발송이 확인되었습니다.':order.billing.state==='STOPPED'?'자동 청구가 중지되었습니다.':'청구서 발송 결과를 확인하고 있습니다. 추가 청구를 요청하기 전에 관리자에게 확인해주세요.'}</p>{order.billing.due_at&&<p>결제 기한: {new Date(order.billing.due_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</p>}{order.billing.needs_review&&<p>관리자가 결제·청구 상태를 확인해야 하는 주문입니다. 이미 납부했다면 추가 결제하지 마세요.</p>}</>}
      {['CREATED','AWAITING_PAYMENT'].includes(order.status) && <p>납부 내역이 확인되면 강의가 열립니다. 자동 확인이 지연되면 관리자가 확인할 수 있습니다. 이미 납부하셨다면 추가 결제하지 말고 확인을 기다려주세요.</p>}
    </>}
    <button disabled={busy} onClick={refresh}>주문 상태 새로고침</button>
    {!busy && !order && <p><Link href="/lectures/login">로그인</Link></p>}
  </main>
}
