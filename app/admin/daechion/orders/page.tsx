'use client'
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {orderReason} from '@/lib/daechion/orders/reasons'
import styles from '../review.module.css'

interface Row {id:string;student_name:string;student_phone:string;titles:string;total_won:number;checkout_state:string;payment_state:string;identity_state:string;notification_state:string;review_code:string|null;version:string;created_at:string}
interface Detail {
  order:{id:string;version:string;total_won:number;checkout_state:string;payment_state:string;identity_state:string;notification_state:string;student_id:string|null;review_code:string|null;
    contact_snapshot:{studentName:string;studentPhone:string;guardianName:string;guardianPhone:string;payerPhone:string;studentHistory:string;applicantType:string}}
  items:{product_id:string;title:string;sale_kind:string;price_won:number}[]
  grants:{lecture_id:string;state:string;review_code:string|null;enrollment_recorded:boolean;can_retry:boolean}[]
  bills:{bill_id:string;amount_won:number;state:string;is_current:boolean;checked_at:string|null}[]
  messages:{phone:string;state:string}[];jobs:{kind:string;state:string;attempts:number;last_error:string|null;event_version:string}[]
  actions:{action:string;lecture_id:string|null;operator_name:string;reason:string;before_version:string;after_version:string;created_at:string}[];canHold:boolean
}
interface Page {rows:Row[];hasMore:boolean;page:number}
const labels:Record<string,string>={DRAFT:'접수 준비',READY:'자동 처리 대기',REVIEW:'확인 필요',CLOSED:'대기 종료',PENDING:'대기',PAID:'결제 완료',CANCELLED:'취소',UNKNOWN:'결과 확인 필요',
  WAITING:'조회 대기',PASSED:'통과',NOT_READY:'전체 권한 확인 대기',SENT:'발송 접수 완료',FAILED:'중단',RUNNING:'처리 중',VERIFIED:'권한 검증 완료',MANUAL:'수동 확인',DONE:'완료',BLOCKED:'발송 중단',SEND_UNKNOWN:'발송 결과 확인 필요',RESERVED:'청구 준비',NEW:'신규',EXISTING:'기존'}
const label=(value:string)=>labels[value]??value
const date=(value:string|null)=>value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'—'
class RequestError extends Error {constructor(message:string,readonly status:number){super(message)}}
export default function OrdersPage(){
  const router=useRouter(),[page,setPage]=useState<Page>({rows:[],hasMore:false,page:0}),[detail,setDetail]=useState<Detail|null>(null)
  const [q,setQ]=useState(''),[reviewOnly,setReviewOnly]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const [action,setAction]=useState<'HOLD'|'RETRY_ACCESS'>('HOLD'),[lecture,setLecture]=useState(''),[operator,setOperator]=useState(''),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false)
  const [uncertain,setUncertain]=useState(false),[reload,setReload]=useState(false),pending=useRef<Record<string,unknown>|null>(null)
  const api=useCallback(async(path:string,body?:unknown)=>{
    const response=await fetch('/api/admin/daechion/orders'+path,{cache:'no-store',signal:AbortSignal.timeout(25000),...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})})
    const data=await response.json()
    if(response.status===401)router.replace('/admin')
    if(!response.ok)throw new RequestError(data.error??'요청을 처리하지 못했습니다.',response.status)
    return data
  },[router])
  useEffect(()=>{let active=true;api('').then(data=>{if(active)setPage(data)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[api])
  function received(data:Detail){setDetail(data);setLecture(data.grants.find(g=>g.can_retry)?.lecture_id??'');setConfirmed(false);setReason('');setAction('HOLD');setUncertain(false);setReload(false);pending.current=null}
  async function search(next=0){
    if(busy)return;setBusy(true);setError('')
    try{setPage(await api('',{kind:'SEARCH',q,reviewOnly,page:next}));setDetail(null);pending.current=null;setUncertain(false);setNotice('')}
    catch(e){setError(e instanceof Error?e.message:'조회 실패')}finally{setBusy(false)}
  }
  async function open(id:string){
    if(busy)return;setBusy(true);setError('');setNotice('')
    try{received(await api('?id='+encodeURIComponent(id)))}catch(e){setError(e instanceof Error?e.message:'조회 실패')}finally{setBusy(false)}
  }
  async function submit(event:FormEvent){
    event.preventDefault();if(busy||!detail||reload)return
    if(!uncertain){
      if(!confirmed||!operator.trim()||!reason.trim()||action==='RETRY_ACCESS'&&!detail.grants.some(g=>g.lecture_id===lecture&&g.can_retry))return
      pending.current={requestKey:crypto.randomUUID(),orderId:detail.order.id,expectedVersion:detail.order.version,action,operatorName:operator,reason,confirmed:true,...(action==='RETRY_ACCESS'?{lectureId:Number(lecture)}:{})}
    }
    setBusy(true);setError('');setNotice('')
    let saved=false
    try{await api('',pending.current);saved=true;setUncertain(false);setReload(true);setNotice('처리 기록을 저장했습니다.');received(await api('?id='+encodeURIComponent(detail.order.id)));setPage(await api('',{kind:'SEARCH',q,reviewOnly,page:page.page}))}
    catch(e){
      const unknown=!saved&&(!(e instanceof RequestError)||e.status>=500)
      setUncertain(unknown)
      if(!unknown&&!saved){pending.current=null;setReload(true)}
      setError((e instanceof Error?e.message:'처리 결과 확인 필요')+(unknown?' 입력을 바꾸지 말고 같은 요청의 결과를 다시 확인해주세요.':saved?' 저장은 완료됐습니다. 주문을 새로 불러와 주세요.':''))
    }finally{setBusy(false)}
  }
  const retries=detail?.grants.filter(g=>g.can_retry)??[]
  return <main className={styles.page}>
    <Link href="/admin/daechion">← 기존 단건 신청 관리</Link><h1>일괄 주문 관리</h1>
    <p>청구 발송·학생 생성·문자 발송 결과가 불명확한 건은 여기서 다시 실행하지 않습니다.</p>
    <form className={styles.search} onSubmit={event=>{event.preventDefault();search()}}><input aria-label="학생·학부모 이름 또는 전화번호" placeholder="학생·학부모 이름 또는 전화번호" value={q} maxLength={80} onChange={event=>setQ(event.target.value)}/><label><input type="checkbox" checked={reviewOnly} onChange={event=>setReviewOnly(event.target.checked)}/>확인 필요 건만</label><button disabled={busy}>검색</button></form>
    {error&&<p className={styles.error} role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <div className={styles.table}><table><thead><tr><th>학생</th><th>상품</th><th>총액</th><th>접수</th><th>결제</th><th>학생 확인</th><th>안내</th></tr></thead><tbody>{page.rows.map(row=><tr key={row.id}>
      <td><button disabled={busy} onClick={()=>open(row.id)}>{row.student_name}</button><small>{row.student_phone}</small></td><td>{row.titles}</td><td>{row.total_won.toLocaleString()}원</td><td>{label(row.checkout_state)}{row.review_code&&<small>{orderReason(row.review_code)}</small>}</td><td>{label(row.payment_state)}</td><td><span className={row.identity_state==='PASSED'?styles.pass:row.identity_state==='REVIEW'?styles.review:styles.wait}>{label(row.identity_state)}</span></td><td>{label(row.notification_state)}</td>
    </tr>)}</tbody></table>{!busy&&!page.rows.length&&<p>조회된 주문이 없습니다.</p>}</div>
    <div className={styles.pager}><button disabled={busy||page.page===0} onClick={()=>search(page.page-1)}>이전</button><span>{page.page+1}페이지</span><button disabled={busy||!page.hasMore} onClick={()=>search(page.page+1)}>다음</button></div>
    {detail&&<section className={styles.detail}><div className={styles.heading}><h2>{detail.order.contact_snapshot.studentName} · {detail.order.total_won.toLocaleString()}원</h2><button disabled={busy} onClick={()=>open(detail.order.id)}>새로 불러오기</button></div>
      <p>주문 {detail.order.id} · 버전 {detail.order.version}</p>
      <dl className={styles.summary}>{[['학생 번호',detail.order.contact_snapshot.studentPhone],['학부모 이름',detail.order.contact_snapshot.guardianName],['보호자 로그인 번호',detail.order.contact_snapshot.guardianPhone],['결제 번호',detail.order.contact_snapshot.payerPhone],['기존·신규 선택',label(detail.order.contact_snapshot.studentHistory)],['대치온 학생 ID',detail.order.student_id],['확인 사유',orderReason(detail.order.review_code)]].map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value||'—'}</dd></div>)}</dl>
      <h3>상품·청구·강의별 상태</h3>{detail.items.map(item=><p key={item.product_id}>{item.title} · {item.sale_kind==='BUNDLE'?'묶음상품':'개별 강의'} · {item.price_won.toLocaleString()}원</p>)}
      {detail.bills.map(bill=><p key={bill.bill_id}>청구서 {bill.bill_id} · {bill.amount_won.toLocaleString()}원 · {label(bill.state)} · {bill.is_current?'현재 청구':'이전 청구'} · 마지막 조회 {date(bill.checked_at)}</p>)}
      {detail.grants.map(grant=><p key={grant.lecture_id}>강의 ID {grant.lecture_id} · {label(grant.state)} · {grant.enrollment_recorded?'API 등록 성공 기록 있음':'API 등록 성공 미확정'}{grant.review_code&&` · ${orderReason(grant.review_code)}`}</p>)}
      {detail.messages.map(message=><p key={message.phone}>안내 {message.phone} · {label(message.state)}</p>)}
      {detail.jobs.map((job,index)=><p key={index}>{job.kind==='SHEETS'?'Sheets 반영':'완료 안내'} · {label(job.state)} · 기준 버전 {job.event_version}{job.last_error&&` · ${orderReason(job.last_error)}`}</p>)}
      <form className={styles.action} onSubmit={submit}><fieldset disabled={busy||uncertain||reload}><legend>보류·권한 재확인</legend>
        <label>처리 종류<select value={action} onChange={event=>{setAction(event.target.value as typeof action);setConfirmed(false)}}><option value="HOLD" disabled={!detail.canHold}>자동 처리 보류</option><option value="RETRY_ACCESS" disabled={!retries.length}>등록된 강의 권한 재확인 대기</option></select></label>
        <p>{action==='HOLD'?'추가 자동 등록과 완료 안내를 멈춥니다. 이미 부여한 권한은 회수하지 않습니다.':'결제 조회가 유효하고 API 등록 성공이 기록된 강의만 다시 대기시킵니다. 실제 재확인은 작업자가 다음에 처리합니다.'}</p>
        {action==='RETRY_ACCESS'&&<label>대상 강의<select required value={lecture} onChange={event=>setLecture(event.target.value)}>{retries.map(g=><option key={g.lecture_id} value={g.lecture_id}>강의 ID {g.lecture_id}</option>)}</select></label>}
        {!retries.length&&<p>현재 재확인을 대기시킬 수 있는 강의가 없습니다. 오래된 결제 조회나 결과 불명 등록은 직접 상태를 확인해야 합니다.</p>}
        <label>담당자<input required maxLength={80} value={operator} onChange={event=>setOperator(event.target.value)}/></label><label>확인 근거·사유<textarea required maxLength={1000} value={reason} onChange={event=>setReason(event.target.value)}/></label>
        <label className={styles.check}><input type="checkbox" required checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>{detail.order.contact_snapshot.studentName} 학생의 위 주문과 처리 내용을 확인했습니다.</label>
      </fieldset><button type="submit" disabled={busy||reload||!uncertain&&(action==='HOLD'?!detail.canHold:!retries.length)}>{busy?'처리 확인 중…':uncertain?'같은 요청 결과 다시 확인':'확인 내용 저장'}</button></form>
      <h3>관리자 처리 이력</h3>{detail.actions.length?detail.actions.map((item,index)=><p key={index}>{date(item.created_at)} · {item.operator_name} · {item.action==='HOLD'?'자동 처리 보류':`강의 ID ${item.lecture_id} 권한 재확인 대기`} · 버전 {item.before_version} → {item.after_version}<br/>{item.reason}</p>):<p>관리자 처리 이력이 없습니다.</p>}
    </section>}
  </main>
}
