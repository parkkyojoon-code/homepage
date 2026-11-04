'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { orderStatus } from '@/lib/lectures/order-status'
import { billingStateLabel,externalStateLabel,billingReviewLabel } from '@/lib/lectures/billing-labels'
type Order={id:string;name:string;username:string;phone:string;total_won:number;status:string;access_control:string;version:number;created_at:string;bill_id:string|null;billing_state:string|null;due_at:string|null;last_state:string|null;checked_at:string|null;needs_review:boolean|null;review_reason:string|null;recipient_name:string|null;recipient_phone:string|null;refresh_pending:boolean;can_resume_auto:boolean;can_refresh_billing:boolean;items:{title:string;price_won:number}[]|null}
type Action='OPEN'|'CLOSE'|'RESTORE'|'CLOSE_UNPAID'|'RESUME_AUTO'
type History={action:string;actor_name:string;reason:string;checked_at:string;created_at:string}
const labels:Record<Action,string>={OPEN:'결제 확인 후 강의 열기',CLOSE:'강의 권한 회수',RESTORE:'결제 재확인 후 다시 열기',CLOSE_UNPAID:'미납·청구 무효 확인 후 종료',RESUME_AUTO:'자동 처리로 복귀'}
type BillingEvent={id:string;kind:string;applied:boolean;created_at:string;state:string|null;send_outcome:string|null;amount_won:string|null;approved:string|null;review_reason:string|null}
type RefreshEvent={actor_name:string;requested_at:string;completed_at:string|null}
const time=(v:string)=>new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})
export default function AdminOrders(){
 const [filter,setFilter]=useState('pending'),[query,setQuery]=useState(''),[search,setSearch]=useState('')
 const [orders,setOrders]=useState<Order[]>([]),[page,setPage]=useState(1),[total,setTotal]=useState(0),[pageSize,setPageSize]=useState(20)
 const [selected,setSelected]=useState<Order|null>(null),[action,setAction]=useState<Action>('OPEN'),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false)
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState(''),[history,setHistory]=useState<{id:string;rows:History[]}|null>(null)
 const [workerEnabled,setWorkerEnabled]=useState(false),[billingHistory,setBillingHistory]=useState<{id:string;events:BillingEvent[];refreshes:RefreshEvent[]}|null>(null)
 const refreshRequests=useRef(new Map<string,string>()),pollBudget=useRef(0),historySequence=useRef(0),lastRefreshId=useRef<string|null>(null)
 const pending=useRef<string|null>(null),inFlight=useRef(false),active=useRef<AbortController|null>(null)
 const load=useCallback(async()=>{
  active.current?.abort();const c=new AbortController();active.current=c;setLoading(true);setOrders([]);setTotal(0)
  try{const params=new URLSearchParams({status:filter,q:search,page:String(page)});const r=await fetch(`/api/lectures/admin/orders?${params}`,{cache:'no-store',signal:c.signal});const d=await r.json();if(!r.ok)throw new Error(d.error);const last=Math.max(1,Math.ceil(d.total/d.pageSize));if(page>last){setPage(last);return}setOrders(d.orders);setTotal(d.total);setPageSize(d.pageSize);setWorkerEnabled(Boolean(d.workerEnabled));if(pollBudget.current>0&&lastRefreshId.current){const target=d.orders.find((o:Order)=>o.id===lastRefreshId.current);if(target&&!target.refresh_pending){pollBudget.current=0;setMessage('새 조회 결과를 수신했습니다. 표시된 상태와 확인 필요 내역을 대조해주세요.')}else if(!target){pollBudget.current=0;setMessage('주문 상태가 변경되어 목록 위치가 달라졌을 수 있습니다. 전체 목록에서 주문번호로 확인해주세요.')}}}
  catch(e){if(!c.signal.aborted)setMessage(e instanceof Error?e.message:'조회하지 못했습니다.')}
  finally{if(!c.signal.aborted)setLoading(false)}
 },[filter,search,page])
 useEffect(()=>{void load();return()=>active.current?.abort()},[load])
 useEffect(()=>{
  if(loading||busy||selected||!workerEnabled||pollBudget.current<=0||!orders.some(o=>o.refresh_pending))return
  const timer=setTimeout(()=>{pollBudget.current-=1;void load();if(pollBudget.current===0)setMessage('재조회가 아직 대기 중이면 새로고침으로 확인하거나 결제선생을 직접 확인해주세요.')},5000)
  return()=>clearTimeout(timer)
 },[orders,loading,busy,selected,workerEnabled,load])
 function select(o:Order,a:Action){setSelected(o);setAction(a);setReason('');setConfirmed(false);pending.current=null;setMessage('아래 확인 양식을 작성해주세요.')}
 async function submit(e:React.FormEvent){
  e.preventDefault();if(!selected||!confirmed||inFlight.current)return
  inFlight.current=true;setBusy(true);setMessage('처리 중입니다.')
  pending.current??=JSON.stringify({action,expectedVersion:selected.version,expectedTotalWon:selected.total_won,requestKey:crypto.randomUUID(),reason,checkedAt:new Date().toISOString(),confirmed:true})
  try{const r=await fetch(`/api/lectures/admin/orders/${selected.id}/access`,{method:'POST',headers:{'Content-Type':'application/json'},body:pending.current});const d=await r.json();if(!r.ok)throw new Error(d.error);setSelected(null);pending.current=null;setHistory(null);setBillingHistory(null);setMessage(d.alreadyApplied?'이미 반영된 작업입니다. 중복 처리하지 않았습니다.':'처리와 이력 저장을 완료했습니다. 실제 환불은 실행하지 않았습니다.');await load()}
  catch(e){setMessage(`${e instanceof Error?e.message:'결과를 확인하지 못했습니다.'} 결과 불명 시 같은 내용으로 재시도하거나 새로고침해주세요.`)}
  finally{inFlight.current=false;setBusy(false)}
 }
 async function refreshBilling(o:Order){
  if(inFlight.current)return
  inFlight.current=true;setBusy(true);setSelected(null);setMessage('재조회를 요청하고 있습니다.')
  const body=refreshRequests.current.get(o.id)??JSON.stringify({expectedVersion:o.version,requestKey:crypto.randomUUID()})
  refreshRequests.current.set(o.id,body)
  try{
   const r=await fetch(`/api/lectures/admin/orders/${o.id}/billing`,{method:'POST',headers:{'Content-Type':'application/json'},body}),d=await r.json()
   if(!r.ok){if(r.status===409)refreshRequests.current.delete(o.id);throw new Error(d.error)}
   refreshRequests.current.delete(o.id);lastRefreshId.current=o.id;pollBudget.current=10
   setMessage(d.completed?'이미 완료된 재조회 요청입니다. 최신 상태를 확인해주세요.':'재조회 요청을 저장했습니다. 작업자가 조회한 결과를 기다립니다. 수동 처리는 유지됩니다.')
   await load()
  }catch(e){setMessage(e instanceof Error?e.message:'요청 결과를 확인하지 못했습니다. 같은 주문으로 재시도하거나 새로고침해주세요.')}
  finally{inFlight.current=false;setBusy(false)}
 }
 async function showHistory(id:string){
  const sequence=++historySequence.current;setHistory(null);setBillingHistory(null)
  try{
   const [a,b]=await Promise.all([fetch(`/api/lectures/admin/orders/${id}/access`,{cache:'no-store'}),fetch(`/api/lectures/admin/orders/${id}/billing`,{cache:'no-store'})])
   const [access,billing]=await Promise.all([a.json(),b.json()])
   if(!a.ok)throw new Error(access.error);if(!b.ok)throw new Error(billing.error)
   if(sequence===historySequence.current){setHistory({id,rows:access.actions});setBillingHistory({id,events:billing.events,refreshes:billing.refreshes})}
  }catch(e){if(sequence===historySequence.current)setMessage(e instanceof Error?e.message:'이력을 조회하지 못했습니다.')}
 }
 async function logout(){setBusy(true);try{const r=await fetch('/api/lectures/admin/auth/logout',{method:'POST'});if(!r.ok)throw new Error('로그아웃하지 못했습니다.');window.location.assign('/admin/lectures/login')}catch(e){setMessage(e instanceof Error?e.message:'로그아웃하지 못했습니다.');setBusy(false)}}
 return <main className="lecture-page">
  <nav><Link href="/admin/lectures/users">구매자 비밀번호 초기화</Link> · <Link href="/admin/lectures">강의 관리</Link> · <Link href="/admin/lectures/accounts">관리자 계정</Link> · <Link href="/admin/lectures/login">개인 관리자 로그인</Link> · <button disabled={busy} onClick={logout}>로그아웃</button></nav>
  <h1>주문 · 수강 권한 관리</h1><p>결제선생에서 대상 청구와 금액을 확인한 뒤 수동 처리해주세요. 권한 회수는 실제 환불이나 청구서 파기를 실행하지 않습니다.</p><p>자동 조회 결과와 수동 처리 상태를 함께 확인할 수 있습니다. 확인 필요 주문은 결제선생에서 직접 대조해주세요.</p>
  {!workerEnabled&&<p>자동 조회 연결이 비활성 상태입니다. 결제선생을 직접 확인한 후 수동 처리할 수 있습니다.</p>}
  <label>조회 <select disabled={busy} value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);setSelected(null);setMessage('')}}><option value="pending">확인 대기</option><option value="paid">결제 완료 (권한 회수 포함)</option><option value="all">전체 (만료·취소 포함)</option><option value="corrected">이전 승인 정정</option></select></label>
  <form onSubmit={e=>{e.preventDefault();setPage(1);setSearch(query.trim());setSelected(null);setMessage('')}}><label>주문 검색<input disabled={busy} maxLength={100} value={query} onChange={e=>setQuery(e.target.value)} placeholder="주문번호·청구 ID·이름·아이디·전화번호"/></label><button disabled={busy}>검색</button></form>
  <button disabled={busy||loading} onClick={()=>{setSelected(null);setHistory(null);setBillingHistory(null);setMessage('');void load()}}>새로고침</button><p role="status">{loading?'조회 중입니다.':message}</p>
  {!loading&&<nav aria-label="주문 목록 페이지"><p>총 {total}건 · {page}/{Math.max(1,Math.ceil(total/pageSize))}페이지</p><button disabled={busy||page<=1} onClick={()=>{setPage(p=>p-1);setSelected(null)}}>이전</button><button disabled={busy||page*pageSize>=total||page>=100000} onClick={()=>{setPage(p=>p+1);setSelected(null)}}>다음</button></nav>}
  {orders.map(o=><article key={o.id} ><h2>{o.name} ({o.username}) · {o.total_won.toLocaleString()}원</h2><p>{o.phone} · {time(o.created_at)}</p><p>주문번호: {o.id}</p>{o.bill_id&&<><p>청구 ID: {o.bill_id} · 발송: {billingStateLabel(o.billing_state)}</p><p>수신자: {o.recipient_name} · {o.recipient_phone}</p><p>외부 조회: {externalStateLabel(o.last_state)} {o.checked_at&&time(o.checked_at)} · 기한: {o.due_at?time(o.due_at):'발송 확인 후 시작'}</p>{o.needs_review&&<p role="status">관리자 확인 필요: {billingReviewLabel(o.review_reason)}</p>}</>}<p>결제: {orderStatus(o.status).label} · 수강: {o.access_control==='MANUAL_CLOSED'?'수동 회수·종료':o.status==='PAID'?'이용 가능':'대기'} {o.access_control==='MANUAL_OPEN'&&'· 관리자 확인'}</p>
   <ul>{o.items?.map((i,n)=><li key={n}>{i.title} · {i.price_won.toLocaleString()}원</li>)}</ul>
   {o.access_control==='MANUAL_CLOSED'?<button disabled={busy} onClick={()=>select(o,'RESTORE')}>{labels.RESTORE}</button>:o.status==='PAID'?<button disabled={busy} onClick={()=>select(o,'CLOSE')}>{labels.CLOSE}</button>:<button disabled={busy} onClick={()=>select(o,'OPEN')}>{labels.OPEN}</button>}
   {o.access_control!=='MANUAL_CLOSED'&&['CREATED','AWAITING_PAYMENT','EXPIRED'].includes(o.status)&&<button disabled={busy} onClick={()=>select(o,'CLOSE_UNPAID')}>{labels.CLOSE_UNPAID}</button>}
   {o.bill_id&&<><button disabled={busy||!workerEnabled||!o.can_refresh_billing||o.refresh_pending} onClick={()=>void refreshBilling(o)}>{o.refresh_pending?'재조회 대기 중':'결제 상태 다시 조회'}</button>{o.refresh_pending&&<p>새 조회 결과를 기다리고 있습니다. 대기 중에는 자동 처리로 복귀할 수 없습니다.</p>}</>}
   {o.access_control!=='AUTO'&&o.status==='PAID'&&<><button disabled={busy||!workerEnabled||!o.can_resume_auto} onClick={()=>select(o,'RESUME_AUTO')}>{labels.RESUME_AUTO}</button>{!o.can_resume_auto&&<p>자동 복귀에는 현재 수동 처리 이후 5분 이내에 확인한 동일 청구의 결제 완료 결과가 필요합니다. 먼저 재조회를 완료해주세요.</p>}</>}
   <button disabled={busy} onClick={()=>void showHistory(o.id)}>처리 · 조회 이력</button>
   {history?.id===o.id&&<section aria-label="처리 이력"><h3>최근 이력 (최대 100건)</h3>{history.rows.length?history.rows.map((h,i)=><p key={i}>{h.actor_name} · {labels[h.action as Action]??h.action} · 처리 {time(h.created_at)} / 확인 {time(h.checked_at)}<br/>{h.reason}</p>):<p>새 관리자 처리 이력이 없습니다.</p>}</section>}
   {billingHistory?.id===o.id&&<section aria-label="결제 조회 이력"><h3>최근 재조회 요청</h3>{billingHistory.refreshes.length?billingHistory.refreshes.map((f,i)=><p key={i}>{f.actor_name} · 요청 {time(f.requested_at)} · {f.completed_at?`결과 수신 ${time(f.completed_at)}`:'조회 대기 중'}</p>):<p>관리자가 요청한 재조회가 없습니다.</p>}<h3>최근 발송·조회 결과 (최대 50건)</h3>{billingHistory.events.map(e=><p key={e.id}>{time(e.created_at)} · {e.kind==='READ'?`조회: ${externalStateLabel(e.state)}`:`발송: ${e.send_outcome==='SENT'?'성공 확인':'결과 불명'}`} · {e.applied?'반영':'이전 결과로 반영하지 않음'}{e.amount_won&&` · ${Number(e.amount_won).toLocaleString()}원`}{e.approved==='true'&&' · 자동 강의 오픈'}{e.review_reason&&<><br/>{billingReviewLabel(e.review_reason)}</>}</p>)}</section>}
  </article>)}
  {!loading&&!orders.length&&<p>표시할 주문이 없습니다.</p>}
  {selected&&<form onSubmit={submit} ><h2>{labels[action]}</h2><p>{selected.name} · {selected.total_won.toLocaleString()}원 · {selected.id}</p><p>{action==='RESUME_AUTO'?(selected.access_control==='MANUAL_CLOSED'?'자동 처리로 복귀하면 이 주문의 강의가 다시 열립니다. 최신 결제 완료 조회와 회수 사유를 대조해주세요.':'현재 강의 접근은 유지하고 자동 처리로 복귀합니다. 최신 결제 조회와 수동 판단을 대조해주세요.'):action==='CLOSE'?'이 주문의 권한만 회수하며 결제 이력은 유지합니다. 다른 유효 구매가 있으면 계속 이용할 수 있습니다.':action==='CLOSE_UNPAID'?'결제선생에서 미납 및 청구 무효화를 확인한 경우에만 종료해주세요.':'결제선생에서 실제 납부 완료·대상·금액을 확인해주세요.'}</p>
   <fieldset disabled={busy} style={{display:'grid',gap:16}}><label>확인 근거·사유<textarea style={{display:'block',width:'100%',color:'inherit',padding:10}} minLength={5} maxLength={500} required value={reason} onChange={e=>{setReason(e.target.value);pending.current=null}} placeholder="청구 ID, 확인 내역과 사유. 카드번호 등 민감정보는 입력하지 마세요."/></label><label><input type="checkbox" checked={confirmed} onChange={e=>{setConfirmed(e.target.checked);pending.current=null}}/>{action==='RESUME_AUTO'?'최신 결제 조회를 확인했고 자동 복귀 및 권한 재개 영향을 이해했습니다.':'대상과 외부 내역을 직접 확인했고 처리 영향을 이해했습니다.'}</label><button disabled={!confirmed}>{labels[action]} 실행</button><button type="button" onClick={()=>setSelected(null)}>닫기</button></fieldset>
  </form>}
 </main>
}
