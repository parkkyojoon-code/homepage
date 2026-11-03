'use client'
import { useCallback,useEffect,useRef,useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { orderStatus } from '@/lib/lectures/order-status'

type Lecture = { id: string; title: string; description: string; price_won: number }
type Order = { id: string; status: string; total_won: number; created_at:string; access_control:string }
export default function LecturePage() {
  const router = useRouter()
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [user, setUser] = useState<{ id:string; name: string } | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [message, setMessage] = useState('강의를 불러오는 중입니다.')
  const [orderPage,setOrderPage]=useState(1),[orderTotal,setOrderTotal]=useState(0),[orderPageSize,setOrderPageSize]=useState(20),[ordersBusy,setOrdersBusy]=useState(false),[orderMessage,setOrderMessage]=useState('')
  const orderRequest=useRef<AbortController|null>(null)
  const userId=user?.id
  const loadOrders=useCallback(async()=>{
    if(!userId)return
    orderRequest.current?.abort();const c=new AbortController();orderRequest.current=c;setOrdersBusy(true);setOrderMessage('');setOrders([])
    try{const r=await fetch(`/api/lectures/orders?page=${orderPage}`,{signal:c.signal,cache:'no-store'}),d=await r.json();if(!r.ok){if(d.code==='PASSWORD_CHANGE_REQUIRED')router.replace('/lectures/change-password');throw new Error(d.error)}const last=Math.max(1,Math.ceil(d.total/d.pageSize));if(orderPage>last){setOrderPage(last);return}setOrders(d.orders);setOrderTotal(d.total);setOrderPageSize(d.pageSize)}catch(e){if(!c.signal.aborted)setOrderMessage(e instanceof Error?e.message:'주문 목록을 확인하지 못했습니다.')}finally{if(!c.signal.aborted)setOrdersBusy(false)}
  },[userId,orderPage,router])
  useEffect(()=>{if(userId)void loadOrders();return()=>orderRequest.current?.abort()},[userId,loadOrders])
  useEffect(() => {
    fetch('/api/lectures/catalog').then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setLectures(d); setMessage(d.length ? '' : '현재 판매 중인 강의가 없습니다.') }).catch(e => setMessage(e.message))
    fetch('/api/lectures/me').then(async r => { const d=await r.json();if(r.ok)setUser(d);else if(d.code==='PASSWORD_CHANGE_REQUIRED')router.replace('/lectures/change-password');else if(r.status!==401)setOrderMessage(d.error) }).catch(() => setOrderMessage('회원 정보를 불러오지 못했습니다. 다시 시도해주세요.'))
  }, [router])
  return <main style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px', color: '#f8fafc' }}>
    <p>박교준 수리논술 · 온라인 강의</p><h1 style={{ fontSize: 36 }}>필요한 강의를 선택하세요</h1>
    <p>강의별 내용을 확인하고 원하는 강의를 모아 주문할 수 있습니다.</p>
    <p><Link href="/lectures/classroom">내 강의실</Link></p>
    {user ? <p>{user.name}님 <button onClick={async () => { const r = await fetch('/api/lectures/auth/logout', { method: 'POST' }); if (r.ok) location.reload() }}>로그아웃</button></p> : <p><Link href="/lectures/login">로그인 / 회원가입</Link></p>}
    <p role="status">{message}</p>
    <div style={{ display: 'grid', gap: 16 }}>{lectures.map(l => <label key={l.id} style={{ padding: 24, background: '#182538', borderRadius: 16 }}>
      <input type="checkbox" checked={selected.includes(l.id)} onChange={e => { setSelected(old => e.target.checked ? [...old, l.id] : old.filter(id => id !== l.id)) }} /> <strong>{l.title}</strong><p>{l.description}</p><span>{l.price_won.toLocaleString()}원</span>
    </label>)}</div>
    <p>선택 {selected.length}개 · 합계 {lectures.filter(l => selected.includes(l.id)).reduce((s, l) => s + l.price_won, 0).toLocaleString()}원</p>
    <button disabled={!user || !selected.length || selected.length > 50} onClick={() => { const params = new URLSearchParams(); selected.forEach(id => params.append('lecture', id)); router.push(`/lectures/checkout?${params}`) }}>주문 내용 확인하기</button>
    {user&&<section><h2>내 주문</h2><p role="status">{ordersBusy?'주문 목록을 확인하고 있습니다.':orderMessage}</p><p>총 {orderTotal.toLocaleString()}건 · {orderPage}/{Math.max(1,Math.ceil(orderTotal/orderPageSize))}페이지</p><button disabled={ordersBusy} onClick={()=>void loadOrders()}>주문 새로고침</button>{orders.map(o=><p key={o.id}><Link href={`/lectures/orders/${o.id}`}>{o.id.slice(0,8)} · {o.total_won.toLocaleString()}원 · {orderStatus(o.status).label}{o.access_control==='MANUAL_CLOSED'&&' · 이용 권한 회수·종료'}</Link> · {new Date(o.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</p>)}{!ordersBusy&&!orderMessage&&!orders.length&&<p>주문 내역이 없습니다.</p>}<nav aria-label="내 주문 페이지"><button disabled={ordersBusy||orderPage<=1} onClick={()=>setOrderPage(p=>p-1)}>이전</button><button disabled={ordersBusy||orderPage*orderPageSize>=orderTotal||orderPage>=100000} onClick={()=>setOrderPage(p=>p+1)}>다음</button></nav></section>}
  </main>
}
