'use client'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './review.module.css'
import { reviewReasonLabel } from '@/lib/daechion/review-reasons'

interface Row {id:string;product_title:string;student_name:string;student_phone:string;payment_state:string;automation_state:string;notification_state:string;review_code:string|null;identity_status:string;version:string}
interface Detail {app:{id:string;current_version:string;product_title:string;payment_state:string;automation_state:string;notification_state:string;review_code:string|null;submission:{studentName:string;studentPhone:string;guardianName:string;guardianPhone:string;payerPhone:string;studentHistory?:string;totalWon:number}};
  bills:{bill_id:string;amount_won:number;state:string;is_current:boolean;sent_at:string|null;due_at:string|null}[];
  registrations:{lecture_id:string;student_id:string|null;state:string;access_state:string;access_checked_at:string|null}[];identity:{status:string;student_id:string|null;reason_code:string|null};
  actions:{action:string;operator_name:string;reason:string;created_at:string}[];messages:{phone:string;state:string}[];jobs:{kind:string;state:string;attempts:number}[]}
const labels:Record<string,string>={PAID:'결제 완료',PENDING:'대기',CANCELLED:'취소',UNKNOWN:'확인 필요',ACTIVE:'자동 처리',HOLD:'보류',REVOKED:'수동 회수 기록',CLOSED:'대기 종료',PASSED:'통과',REVIEW:'확인 필요',WAITING:'조회 대기',NOT_READY:'등록 완료 후 안내',SENT:'발송 접수 완료',FAILED:'중단/실패',DONE:'등록 완료',RUNNING:'처리 중',STOPPED:'보류',NEW:'신규',EXISTING:'기존'}
const actions={HOLD:'자동 처리 보류',RESUME:'학생 확인 후 자동 등록 재개',MANUAL_COMPLETE:'대치온 수동 등록 완료 기록',REVOKED:'대치온 수동 회수 완료 기록',CONFIRM_PAYMENT:'결제선생 수동 확인 기록'}
type Action=keyof typeof actions
const descriptions:Record<Action,string>={HOLD:'추가 자동 등록과 안내 발송을 멈춥니다.',RESUME:'아래 학생 ID의 이름·학생 번호·보호자 연결을 확인하고 미완료 강의 등록을 다시 진행합니다.',MANUAL_COMPLETE:'대치온에서 아래 연결 강의 모두의 수강 권한을 부여한 뒤 완료 사실을 기록합니다.',REVOKED:'대치온에서 수강 권한을 직접 회수한 뒤 완료 사실을 기록합니다. 실제 환불은 결제선생에서 별도 처리합니다.',CONFIRM_PAYMENT:'결제선생에서 청구서 번호·금액·승인일시를 직접 확인한 사실을 기록합니다. 실제 결제나 환불을 실행하지 않습니다.'}
const label=(value:string|null|undefined)=>value?(labels[value]??value):'—'
const date=(value:string)=>new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})

export default function ReviewPage(){
  const router=useRouter(),[rows,setRows]=useState<Row[]>([]),[detail,setDetail]=useState<Detail|null>(null)
  const [q,setQ]=useState(''),[reviewOnly,setReviewOnly]=useState(false),[page,setPage]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const [action,setAction]=useState<Action>('HOLD'),[operator,setOperator]=useState(''),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false)
  const [studentId,setStudentId]=useState(''),[billId,setBillId]=useState(''),[amount,setAmount]=useState(''),[paidAt,setPaidAt]=useState(''),[sentAt,setSentAt]=useState(''),[uncertain,setUncertain]=useState(false)
  const pending=useRef<Record<string,unknown>|null>(null)
  const api=useCallback(async(url:string,body?:unknown)=>{
    const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(25000),...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})})
    const data=await response.json()
    if(response.status===401)router.push('/admin')
    if(!response.ok)throw Error(data.error??'처리하지 못했습니다.')
    return data
  },[router])
  async function search(nextPage=0,keepDetail=false){setBusy(true);setError('');try{setRows(await api('/api/admin/daechion/applications',{kind:'SEARCH',q,reviewOnly,page:nextPage}));setPage(nextPage);if(!keepDetail){setDetail(null);pending.current=null;setUncertain(false)}}catch(e){setError(e instanceof Error?e.message:'조회 실패')}finally{setBusy(false)}}
  async function open(id:string){
    setBusy(true);setError('');try{const data:Detail=await api('/api/admin/daechion/applications?id='+encodeURIComponent(id));setDetail(data);setStudentId(data.identity?.student_id??'');const bill=data.bills.find(item=>item.is_current);setBillId(bill?.bill_id??'');setAmount(String(bill?.amount_won??data.app.submission.totalWon));setConfirmed(false);setUncertain(false);setReason('');setPaidAt('');setSentAt('');setAction('HOLD');pending.current=null}
    catch(e){setError(e instanceof Error?e.message:'조회 실패')}finally{setBusy(false)}
  }
  useEffect(()=>{let active=true;api('/api/admin/daechion/applications').then(data=>{if(active)setRows(data)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[api])
  async function submit(event:FormEvent){
    event.preventDefault();if(!detail||busy)return
    if(!uncertain){
      if(!operator.trim()||!reason.trim()||!confirmed){setError('담당자·사유와 확인 항목을 입력해주세요.');return}
      const value:Record<string,unknown>={requestKey:crypto.randomUUID(),applicationId:detail.app.id,expectedVersion:detail.app.current_version,action,operatorName:operator,reason,confirmed:true}
      if(action==='RESUME'||action==='MANUAL_COMPLETE')value.studentId=Number(studentId)
      if(action==='CONFIRM_PAYMENT'){
        if(!paidAt){setError('승인일시를 입력해주세요.');return}
        try{value.billId=billId;value.amountWon=Number(amount);value.paidAt=new Date(paidAt+'+09:00').toISOString()
          if(sentAt)value.sentAt=new Date(sentAt+'+09:00').toISOString()
        }catch{setError('한국시간 기준으로 일시를 정확히 입력해주세요.');return}
      }
      pending.current=value
    }
    setBusy(true);setError('');setNotice('')
    try{await api('/api/admin/daechion/applications',pending.current);setNotice('처리 기록을 저장했습니다.');setUncertain(false);await open(detail.app.id);await search(page,true)}
    catch(e){setUncertain(true);setError((e instanceof Error?e.message:'처리 결과 확인 필요')+' 내용을 새로 불러와 확인하거나 같은 처리 결과를 다시 확인해주세요.')}
    finally{setBusy(false)}
  }
  return <main className={styles.page}>
    <Link href="/admin/dashboard">← 관리자 홈</Link><h1>신규 강의 신청 관리</h1>
    <p><Link href="/admin/daechion/orders">일괄 주문 관리 →</Link></p>
    <form className={styles.search} onSubmit={event=>{event.preventDefault();search(0)}}><input aria-label="이름 또는 전화번호 검색" placeholder="이름 또는 전화번호" value={q} maxLength={80} onChange={event=>setQ(event.target.value)}/><label><input type="checkbox" checked={reviewOnly} onChange={event=>setReviewOnly(event.target.checked)}/>확인 필요 건만</label><button disabled={busy}>검색</button></form>
    {error&&<p className={styles.error} role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <div className={styles.table}><table><thead><tr><th>학생</th><th>강의</th><th>결제</th><th>중복 수강생 확인</th><th>자동 처리</th><th>안내</th></tr></thead><tbody>
      {rows.map(row=><tr key={row.id}><td><button onClick={()=>open(row.id)} disabled={busy}>{row.student_name}</button><small>{row.student_phone}</small></td><td>{row.product_title}</td><td>{row.payment_state==='PENDING'?'미납':label(row.payment_state)}</td><td><span className={row.identity_status==='PASSED'?styles.pass:row.identity_status==='REVIEW'?styles.review:styles.wait}>{label(row.identity_status)}</span></td><td>{label(row.automation_state)}</td><td>{label(row.notification_state)}</td></tr>)}
    </tbody></table></div>
    {!rows.length&&<p>표시할 신청이 없습니다.</p>}<div className={styles.pager}><button disabled={busy||page===0} onClick={()=>search(page-1)}>이전</button><span>{page+1}페이지</span><button disabled={busy||rows.length<50} onClick={()=>search(page+1)}>다음</button></div>
    {detail&&<section className={styles.detail}>
      <div className={styles.heading}><h2>{detail.app.submission.studentName} · {detail.app.product_title}</h2><button disabled={busy} onClick={()=>open(detail.app.id)}>새로 불러오기</button></div>
      <dl className={styles.summary}>{[['학생 전화번호',detail.app.submission.studentPhone],['학부모 이름',detail.app.submission.guardianName],['보호자 로그인 번호',detail.app.submission.guardianPhone],['결제 번호',detail.app.submission.payerPhone],['기존·신규 선택',label(detail.app.submission.studentHistory)],['총 청구 금액',detail.app.submission.totalWon.toLocaleString()+'원'],['확인 사유',reviewReasonLabel(detail.app.review_code??detail.identity?.reason_code)]].map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value||'—'}</dd></div>)}</dl>
      <h3>청구·등록 상태</h3>{detail.bills.map(bill=><p key={bill.bill_id}>청구서 {bill.bill_id} · {bill.amount_won.toLocaleString()}원 · {label(bill.state)}</p>)}
      {detail.registrations.map(item=><p key={item.lecture_id}>강의 ID {item.lecture_id} · 학생 ID {item.student_id??'미확정'} · {label(item.state)} · 콘텐츠 권한: {item.access_state==='VERIFIED'?'확인 완료':item.access_state==='MANUAL'?'수동 확인 기록':item.access_state==='PENDING'?'적용·확인 대기':'미확인'}{item.access_checked_at&&` (${date(item.access_checked_at)})`}</p>)}
      {detail.messages.map(item=><p key={item.phone}>안내 {item.phone} · {label(item.state)}</p>)}{detail.jobs.map((item,index)=><p key={index}>{item.kind==='SHEETS'?'Sheets 반영':'안내 작업'} · {label(item.state)}</p>)}
      <form onSubmit={submit} className={styles.action}>
        <fieldset disabled={busy||uncertain}><legend>확인·처리 기록</legend>
          <label>처리 종류<select value={action} onChange={event=>{setAction(event.target.value as Action);setConfirmed(false)}}>{Object.entries(actions).map(([value,text])=><option key={value} value={value}>{text}</option>)}</select></label>
          <p>{descriptions[action]}</p>
          {(action==='RESUME'||action==='MANUAL_COMPLETE')&&<label>확인한 대치온 학생 ID<input type="number" min="1" step="1" required value={studentId} onChange={event=>setStudentId(event.target.value)}/></label>}
          {action==='CONFIRM_PAYMENT'&&<div className={styles.inputs}><label>청구서 번호<input required value={billId} onChange={event=>setBillId(event.target.value)}/></label><label>확인한 금액<input required type="number" min="1" value={amount} onChange={event=>setAmount(event.target.value)}/></label><label>승인일시 (한국시간)<input type="datetime-local" step="1" required value={paidAt} onChange={event=>setPaidAt(event.target.value)}/></label><label>실제 발송일시 (발송 불명 건 필수·한국시간)<input type="datetime-local" step="1" value={sentAt} onChange={event=>setSentAt(event.target.value)}/></label></div>}
          <label>담당자<input required maxLength={80} value={operator} onChange={event=>setOperator(event.target.value)}/></label><label>확인 근거·처리 사유<textarea required maxLength={1000} value={reason} onChange={event=>setReason(event.target.value)}/></label>
          <label className={styles.check}><input type="checkbox" required checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>{detail.app.submission.studentName} 학생의 위 신청과 처리 내용을 확인했습니다.</label>
        </fieldset>
        <button disabled={busy} type="submit">{busy?'처리 확인 중…':uncertain?'같은 처리 결과 다시 확인':'확인 내용 저장'}</button>
      </form>
      <h3>처리 이력</h3>{detail.actions.length?detail.actions.map((item,index)=><p key={index}>{date(item.created_at)} · {item.operator_name} · {actions[item.action as Action]??item.action}<br/>{item.reason}</p>):<p>수동 처리 이력이 없습니다.</p>}
    </section>}
  </main>
}
