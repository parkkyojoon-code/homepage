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
  grants:{lecture_id:string;state:string;review_code:string|null;enrollment_recorded:boolean;can_retry:boolean;revoked_at?:string|null;weekly_ids?:number[]}[]
  bills:{bill_id:string;amount_won:number;state:string;is_current:boolean;checked_at:string|null}[]
  messages:{phone:string;state:string}[];jobs:{kind:string;state:string;attempts:number;last_error:string|null;event_version:string}[]
  actions:{action:string;lecture_id:string|null;student_id?:string|null;target_ids?:number[];recovery_evidence?:{billId?:string;amountWon?:number;paidAt?:string;jobId?:string;studentId?:number;weeklyLectureIds?:number[]};operator_name:string;reason:string;before_version:string;after_version:string;created_at:string}[];canHold:boolean;canConfirmNewIntake?:boolean;canCloseIntake?:boolean;canReconcileIdentity?:boolean;canApproveExisting:boolean;canResumeUnbilled:boolean;canResumePaid:boolean;canReconcileSheets:boolean;sheetRecoveryJobId:string|null;manualGrantIds?:string[];manualRevokeIds?:string[]
  workerStatus?:{session_issue:boolean;started_at:string|null;finished_at:string|null;result:string|null;next_run_at:string}|null
  recoveries?:{request_key:string;state:string;result_code:string|null;created_at:string}[]
}
interface Page {rows:Row[];hasMore:boolean;page:number}
const labels:Record<string,string>={DRAFT:'접수 준비',READY:'자동 처리 대기',REVIEW:'확인 필요',CLOSED:'대기 종료',PENDING:'대기',PAID:'결제 완료',CANCELLED:'취소',UNKNOWN:'결과 확인 필요',
  WAITING:'조회 대기',PASSED:'통과',NOT_READY:'전체 권한 확인 대기',SENT:'발송 접수 완료',FAILED:'중단',RUNNING:'처리 중',VERIFIED:'권한 검증 완료',MANUAL:'수동 확인',REVOKED:'수동 회수 확인',DONE:'완료',BLOCKED:'발송 중단',SEND_UNKNOWN:'발송 결과 확인 필요',RESERVED:'청구 준비',NEW:'신규',EXISTING:'기존'}
const label=(value:string)=>labels[value]??value
const date=(value:string|null)=>value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'—'
class RequestError extends Error {constructor(message:string,readonly status:number){super(message)}}
export default function OrdersPage(){
  const router=useRouter(),[page,setPage]=useState<Page>({rows:[],hasMore:false,page:0}),[detail,setDetail]=useState<Detail|null>(null)
  const [q,setQ]=useState(''),[reviewOnly,setReviewOnly]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const [action,setAction]=useState<'CONFIRM_NEW_INTAKE'|'CLOSE_INTAKE'|'RECONCILE_IDENTITY'|'HOLD'|'RETRY_ACCESS'|'APPROVE_EXISTING'|'RESUME_UNBILLED'|'RESUME_PAID'|'RECONCILE_SHEETS'|'MANUAL_ACCESS'|'RECORD_REVOKED'>('HOLD'),[lecture,setLecture]=useState(''),[operator,setOperator]=useState(''),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false)
  const [newStudent,setNewStudent]=useState(false),[closeIntake,setCloseIntake]=useState(false)
  const [createdAccount,setCreatedAccount]=useState(false)
  const [studentId,setStudentId]=useState(''),[notOwned,setNotOwned]=useState(false)
  const [paidConfirmed,setPaidConfirmed]=useState(false),[rowConfirmed,setRowConfirmed]=useState(false)
  const [manualTarget,setManualTarget]=useState(''),[video,setVideo]=useState(false),[lessonMaterials,setLessonMaterials]=useState(false),[courseMaterials,setCourseMaterials]=useState(false),[revoked,setRevoked]=useState(false)
  const [uncertain,setUncertain]=useState(false),[reload,setReload]=useState(false),pending=useRef<Record<string,unknown>|null>(null)
  const api=useCallback(async(path:string,body?:unknown)=>{
    const response=await fetch('/api/admin/daechion/orders'+path,{cache:'no-store',signal:AbortSignal.timeout(25000),...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})})
    const data=await response.json()
    if(response.status===401)router.replace('/admin')
    if(!response.ok)throw new RequestError(data.error??'요청을 처리하지 못했습니다.',response.status)
    return data
  },[router])
  useEffect(()=>{let active=true;api('').then(data=>{if(active)setPage(data)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[api])
  function received(data:Detail){setDetail(data);setLecture(data.grants.find(g=>g.can_retry)?.lecture_id??'');setManualTarget(data.manualGrantIds?.[0]??data.manualRevokeIds?.[0]??'');setVideo(false);setLessonMaterials(false);setCourseMaterials(false);setRevoked(false);setStudentId(data.order.student_id??'');setNotOwned(false);setCreatedAccount(false);setNewStudent(false);setCloseIntake(false);setPaidConfirmed(false);setRowConfirmed(false);setConfirmed(false);setReason('');setAction('HOLD');setUncertain(false);setReload(false);pending.current=null}
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
      if(action==='APPROVE_EXISTING'&&(!notOwned||!Number.isSafeInteger(Number(studentId))||Number(studentId)<=0))return
      if(action==='CONFIRM_NEW_INTAKE'&&!newStudent||action==='CLOSE_INTAKE'&&!closeIntake)return
      if(action==='RECONCILE_IDENTITY'&&(!createdAccount||!Number.isSafeInteger(Number(studentId))||Number(studentId)<=0))return
      if(action==='RESUME_PAID'&&(!paidConfirmed||!detail.bills.some(b=>b.is_current&&b.state==='SENT')))return
      if(action==='RECONCILE_SHEETS'&&(!rowConfirmed||!detail.sheetRecoveryJobId))return
      if(action==='MANUAL_ACCESS'&&(!video||!lessonMaterials||!courseMaterials||!detail.manualGrantIds?.includes(manualTarget)))return
      if(action==='RECORD_REVOKED'&&(!revoked||!detail.manualRevokeIds?.includes(manualTarget)))return
      pending.current={requestKey:crypto.randomUUID(),orderId:detail.order.id,expectedVersion:detail.order.version,action,operatorName:operator,reason,confirmed:true,
        ...(action==='RETRY_ACCESS'?{lectureId:Number(lecture)}:{}),...(action==='APPROVE_EXISTING'?{studentId:Number(studentId),targetIds:detail.grants.map(g=>Number(g.lecture_id)).sort((a,b)=>a-b),confirmNotOwned:true}:{}),
        ...(action==='CONFIRM_NEW_INTAKE'?{confirmNewStudent:true}:{}),...(action==='CLOSE_INTAKE'?{confirmClose:true}:{}),
        ...(action==='RECONCILE_IDENTITY'?{studentId:Number(studentId),confirmCreatedAccount:true}:{}),
        ...(action==='RESUME_PAID'?{billId:detail.bills.find(b=>b.is_current&&b.state==='SENT')!.bill_id,confirmPaid:true}:{}),...(action==='RECONCILE_SHEETS'?{jobId:detail.sheetRecoveryJobId,confirmExistingRow:true}:{}),
        ...(action==='MANUAL_ACCESS'?{studentId:Number(detail.order.student_id),lectureId:Number(manualTarget),confirmVideo:true,confirmLessonMaterials:true,confirmCourseMaterials:true}:{}),
        ...(action==='RECORD_REVOKED'?{studentId:Number(detail.order.student_id),lectureId:Number(manualTarget),confirmRevoked:true}:{})}
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
  const canAct=detail&&({CONFIRM_NEW_INTAKE:detail.canConfirmNewIntake,CLOSE_INTAKE:detail.canCloseIntake,RECONCILE_IDENTITY:detail.canReconcileIdentity,HOLD:detail.canHold,RETRY_ACCESS:retries.length>0,APPROVE_EXISTING:detail.canApproveExisting,RESUME_UNBILLED:detail.canResumeUnbilled,RESUME_PAID:detail.canResumePaid,RECONCILE_SHEETS:detail.canReconcileSheets,MANUAL_ACCESS:Boolean(detail.manualGrantIds?.length),RECORD_REVOKED:Boolean(detail.manualRevokeIds?.length)}[action])
  const descriptions={CONFIRM_NEW_INTAKE:'신규 학생으로 신청한 건의 학생·보호자 번호 중복과 전체 연결 강의를 서버에서 다시 조회합니다. 확인되면 청구 대기로 전환하며, 작업자가 발송 직전 다시 검사합니다. 기존 학생은 기존 학생·전체 강의 미보유 확인을 사용합니다.',CLOSE_INTAKE:'청구·학생 생성·수강 등록을 시도하지 않은 신청을 종료합니다. 기록은 보존하며 자동 처리는 재개할 수 없습니다. 구매하려면 새로 신청해야 합니다. 청구·결제 이력이 있는 건은 종료할 수 없습니다.',RECONCILE_IDENTITY:'대치온에서 이 신청으로 생성된 계정을 직접 확인한 뒤 학생 ID를 연결합니다. 이름·학생 번호·보호자 번호는 서버가 다시 대조합니다. 새 계정은 만들지 않으며, 연결 후에도 보류를 유지합니다. 현재 결제 재조회 후 보류 해제로 별도 재개해야 합니다.',HOLD:'추가 자동 등록과 완료 안내를 멈춥니다. 이미 부여한 권한은 회수하지 않습니다.',RETRY_ACCESS:'결제 조회가 유효하고 API 등록 성공이 기록된 강의만 다시 대기시킵니다. 실제 재확인은 작업자가 다음에 처리합니다.',
    APPROVE_EXISTING:'대치온에서 아래 학생의 모든 구성 강의 미보유 상태를 직접 확인한 후 승인합니다. 이름·학생 번호·보호자 번호는 서버가 다시 대조합니다. 금액은 그대로이며 승인 후 15분 안에 작업자의 청구 전 재검사를 통과해야 합니다.',
    RESUME_UNBILLED:'청구 이력이 전혀 없고 관리자 보류만 남은 주문을 청구 대기로 되돌립니다. 청구서·계정 생성·결제 결과가 불명확한 주문은 재개하지 않습니다.',
    RESUME_PAID:'현재 청구서의 결제 완료·금액·승인일시를 서버에서 다시 조회합니다. 발송 결과 불명·취소·기한 후 결제·계정 생성 결과 불명은 재개하지 않습니다. 등록 결과 불명 강의와 이미 시도한 문자는 그대로 두며, 이 요청은 청구나 문자를 발송하지 않습니다.',
    RECONCILE_SHEETS:'업무 시트에 이 주문의 기존 행이 있는지 직접 확인한 뒤 복구를 요청합니다. 다음 작업자는 주문번호와 행 표식을 대조해 기존 행만 갱신합니다. 행이 없거나 표식·헤더가 다르면 새 행을 만들지 않고 확인 필요로 남깁니다.',
    MANUAL_ACCESS:'대치온에서 직접 등록하고 영상·자료 권한을 확인한 사실을 기록합니다. 이미 연결된 학생 ID와 최근 결제 확인이 필요합니다. 모든 구매 강의의 권한이 확인된 뒤에만 안내 대기가 가능합니다.',
    RECORD_REVOKED:'대치온에서 직접 권한을 회수한 사실을 기록하고 이 주문의 자동 처리와 추가 안내를 보류합니다. 다른 강의의 완료 기록과 과거 문자 기록은 보존합니다. 실제 환불은 결제선생에서 별도로 처리합니다.'}
  const actionLabel=(value:string)=>({CONFIRM_NEW_INTAKE:'신규 학생 재조회 후 접수 확인',CLOSE_INTAKE:'청구 전 신청 종료',RECONCILE_IDENTITY:'학생 생성 결과 확인·기존 계정 연결',HOLD:'자동 처리 보류',RETRY_ACCESS:'강의 권한 재확인 대기',APPROVE_EXISTING:'기존 학생·전체 강의 미보유 확인',RESUME_UNBILLED:'청구 전 관리자 보류 해제',RESUME_PAID:'현재 결제 재조회 후 보류 해제',RECONCILE_SHEETS:'Sheets 기존 행 복구 요청',MANUAL_ACCESS:'대치온 수동 등록·권한 확인 기록',RECORD_REVOKED:'대치온 수동 회수 완료 기록'}[value]??value)
  return <main className={styles.page}>
    <Link href="/admin/daechion">← 기존 단건 신청 관리</Link><h1>일괄 주문 관리</h1>
    <p>청구 발송·학생 생성·문자 발송 결과가 불명확한 건은 여기서 다시 실행하지 않습니다.</p>
    <p>웹 구매는 각 강의의 첫 차시 영상·자료와 공통 강의 자료실을 엽니다. 이후 차시는 담당자가 별도로 관리합니다.</p>
    <form className={styles.search} onSubmit={event=>{event.preventDefault();search()}}><input aria-label="학생·학부모 이름 또는 전화번호" placeholder="학생·학부모 이름 또는 전화번호" value={q} maxLength={80} onChange={event=>setQ(event.target.value)}/><label><input type="checkbox" checked={reviewOnly} onChange={event=>setReviewOnly(event.target.checked)}/>확인 필요 건만</label><button disabled={busy}>검색</button></form>
    {error&&<p className={styles.error} role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <div className={styles.table}><table><thead><tr><th>학생</th><th>상품</th><th>총액</th><th>접수</th><th>결제</th><th>학생 확인</th><th>안내</th></tr></thead><tbody>{page.rows.map(row=><tr key={row.id}>
      <td><button disabled={busy} onClick={()=>open(row.id)}>{row.student_name}</button><small>{row.student_phone}</small></td><td>{row.titles}</td><td>{row.total_won.toLocaleString()}원</td><td>{label(row.checkout_state)}{row.review_code&&<small>{orderReason(row.review_code)}</small>}</td><td>{label(row.payment_state)}</td><td><span className={row.identity_state==='PASSED'?styles.pass:row.identity_state==='REVIEW'?styles.review:styles.wait}>{label(row.identity_state)}</span></td><td>{label(row.notification_state)}</td>
    </tr>)}</tbody></table>{!busy&&!page.rows.length&&<p>조회된 주문이 없습니다.</p>}</div>
    <div className={styles.pager}><button disabled={busy||page.page===0} onClick={()=>search(page.page-1)}>이전</button><span>{page.page+1}페이지</span><button disabled={busy||!page.hasMore} onClick={()=>search(page.page+1)}>다음</button></div>
    {detail&&<section className={styles.detail}><div className={styles.heading}><h2>{detail.order.contact_snapshot.studentName} · {detail.order.total_won.toLocaleString()}원</h2><button disabled={busy} onClick={()=>open(detail.order.id)}>새로 불러오기</button></div>
      <p>주문 {detail.order.id} · 버전 {detail.order.version}</p>
      <dl className={styles.summary}>{[['학생 번호',detail.order.contact_snapshot.studentPhone],['학부모 이름',detail.order.contact_snapshot.guardianName],['보호자 로그인 번호',detail.order.contact_snapshot.guardianPhone],['결제 번호',detail.order.contact_snapshot.payerPhone],['기존·신규 선택',label(detail.order.contact_snapshot.studentHistory)],['대치온 학생 ID',detail.order.student_id],['확인 사유',orderReason(detail.order.review_code)]].map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value||'—'}</dd></div>)}</dl>
      {detail.workerStatus&&<p className={detail.workerStatus.session_issue?styles.error:undefined}>{detail.workerStatus.session_issue?'대치온 로그인 세션 확인 필요 — 자동 권한 부여 대기':'정기 작업자 기록'} · 마지막 완료 {date(detail.workerStatus.finished_at)} · 다음 확인 {date(detail.workerStatus.next_run_at)}</p>}
      <h3>상품·청구·강의별 상태</h3>{detail.items.map(item=><p key={item.product_id}>{item.title} · {item.sale_kind==='BUNDLE'?'묶음상품':'개별 강의'} · {item.price_won.toLocaleString()}원</p>)}
      {detail.bills.map(bill=><p key={bill.bill_id}>청구서 {bill.bill_id} · {bill.amount_won.toLocaleString()}원 · {label(bill.state)} · {bill.is_current?'현재 청구':'이전 청구'} · 마지막 조회 {date(bill.checked_at)}</p>)}
      {detail.grants.map(grant=><p key={grant.lecture_id}>강의 ID {grant.lecture_id} · {label(grant.state)} · {grant.enrollment_recorded?'수강 등록 확인 기록 있음':'수강 등록 미확정'}{Boolean(grant.weekly_ids?.length)&&` · 차시 ID ${grant.weekly_ids!.join(', ')}`}{grant.revoked_at&&` · 회수 기록 ${date(grant.revoked_at)}`}{grant.review_code&&` · ${orderReason(grant.review_code)}`}</p>)}
      {detail.messages.map(message=><p key={message.phone}>안내 {message.phone} · {label(message.state)}</p>)}
      {detail.jobs.map((job,index)=><p key={index}>{job.kind==='SHEETS'?'Sheets 반영':'완료 안내'} · {label(job.state)} · 기준 버전 {job.event_version}{job.last_error&&` · ${orderReason(job.last_error)}`}</p>)}
      {detail.recoveries?.map(item=><p key={item.request_key}>Sheets 복구 · {label(item.state)} · {date(item.created_at)}{item.result_code&&` · ${orderReason(item.result_code)}`}</p>)}
      <form className={styles.action} onSubmit={submit}><fieldset disabled={busy||uncertain||reload}><legend>확인·보류·권한 재확인</legend>
        <label>처리 종류<select value={action} onChange={event=>{const next=event.target.value as typeof action;setAction(next);setConfirmed(false);setNotOwned(false);setCreatedAccount(false);setNewStudent(false);setCloseIntake(false);setPaidConfirmed(false);setRowConfirmed(false);setVideo(false);setLessonMaterials(false);setCourseMaterials(false);setRevoked(false);setManualTarget((next==='RECORD_REVOKED'?detail.manualRevokeIds:detail.manualGrantIds)?.[0]??'')}}><option value="CONFIRM_NEW_INTAKE" disabled={!detail.canConfirmNewIntake}>신규 학생 재조회 후 접수 확인</option><option value="CLOSE_INTAKE" disabled={!detail.canCloseIntake}>청구 전 신청 종료</option><option value="RECONCILE_IDENTITY" disabled={!detail.canReconcileIdentity}>학생 생성 결과 확인·기존 계정 연결</option><option value="HOLD" disabled={!detail.canHold}>자동 처리 보류</option><option value="RETRY_ACCESS" disabled={!retries.length}>등록된 강의 권한 재확인 대기</option><option value="APPROVE_EXISTING" disabled={!detail.canApproveExisting}>기존 학생·전체 강의 미보유 확인</option><option value="RESUME_UNBILLED" disabled={!detail.canResumeUnbilled}>청구 전 관리자 보류 해제</option><option value="RESUME_PAID" disabled={!detail.canResumePaid}>현재 결제 재조회 후 보류 해제</option><option value="RECONCILE_SHEETS" disabled={!detail.canReconcileSheets}>Sheets 기존 행 복구 요청</option><option value="MANUAL_ACCESS" disabled={!detail.manualGrantIds?.length}>대치온 수동 등록·권한 확인 기록</option><option value="RECORD_REVOKED" disabled={!detail.manualRevokeIds?.length}>대치온 수동 회수 완료 기록</option></select></label>
        <p>{descriptions[action]}</p>
        {action==='APPROVE_EXISTING'&&<><label>확인한 대치온 학생 ID<input required type="number" min="1" step="1" value={studentId} onChange={event=>setStudentId(event.target.value)}/></label><p>확인할 전체 강의 ID: {detail.grants.map(g=>g.lecture_id).join(', ')}</p><label className={styles.check}><input required type="checkbox" checked={notOwned} onChange={event=>setNotOwned(event.target.checked)}/>위 학생이 모든 구성 강의를 보유하지 않은 것을 대치온에서 직접 확인했습니다. 하나라도 이미 보유했다면 승인하지 않습니다.</label></>}
        {action==='CONFIRM_NEW_INTAKE'&&<label className={styles.check}><input required type="checkbox" checked={newStudent} onChange={event=>setNewStudent(event.target.checked)}/>이 학생이 신규 수강생이며 신청 정보와 모든 구성 강의를 확인했습니다. 서버가 전화번호 중복을 다시 조회합니다.</label>}
        {action==='CLOSE_INTAKE'&&<label className={styles.check}><input required type="checkbox" checked={closeIntake} onChange={event=>setCloseIntake(event.target.checked)}/>이 신청을 종료하며, 구매하려면 새로 신청해야 한다는 것을 확인했습니다.</label>}
        {action==='RECONCILE_IDENTITY'&&<><label>생성 결과를 확인한 대치온 학생 ID<input required type="number" min="1" step="1" value={studentId} onChange={event=>setStudentId(event.target.value)}/></label><label className={styles.check}><input required type="checkbox" checked={createdAccount} onChange={event=>setCreatedAccount(event.target.checked)}/>이 신청으로 생성된 학생 계정과 학생·보호자 번호를 대치온에서 직접 확인했습니다. 새 계정을 생성하지 않고 이 ID를 연결합니다.</label></>}
        {action==='RESUME_PAID'&&<><p>확인할 현재 청구서: {detail.bills.find(b=>b.is_current)?.bill_id??'없음'} · {detail.order.total_won.toLocaleString()}원</p><label className={styles.check}><input required type="checkbox" checked={paidConfirmed} onChange={event=>setPaidConfirmed(event.target.checked)}/>결제선생에서 이 청구서의 금액·승인일시·결제 완료 상태를 직접 확인했습니다.</label></>}
        {action==='RECONCILE_SHEETS'&&<><p>대상 오류 작업 ID: {detail.sheetRecoveryJobId}</p><label className={styles.check}><input required type="checkbox" checked={rowConfirmed} onChange={event=>setRowConfirmed(event.target.checked)}/>업무 시트에 위 주문번호의 기존 행이 있는 것을 직접 확인했습니다.</label></>}
        {(action==='MANUAL_ACCESS'||action==='RECORD_REVOKED')&&<><p>연결된 대치온 학생 ID: {detail.order.student_id}</p><label>수동 처리한 강의<select required value={manualTarget} onChange={event=>{setManualTarget(event.target.value);setVideo(false);setLessonMaterials(false);setCourseMaterials(false);setRevoked(false);setConfirmed(false)}}>{(action==='MANUAL_ACCESS'?detail.manualGrantIds:detail.manualRevokeIds)?.map(id=><option key={id} value={id}>강의 ID {id}</option>)}</select></label>
          {action==='MANUAL_ACCESS'?<><label className={styles.check}><input required type="checkbox" checked={video} onChange={event=>setVideo(event.target.checked)}/>대치온에서 위 학생의 첫 차시 영상 권한을 직접 확인했습니다.</label><label className={styles.check}><input required type="checkbox" checked={lessonMaterials} onChange={event=>setLessonMaterials(event.target.checked)}/>대치온에서 위 학생의 첫 차시 자료 권한을 직접 확인했습니다.</label><label className={styles.check}><input required type="checkbox" checked={courseMaterials} onChange={event=>setCourseMaterials(event.target.checked)}/>대치온에서 위 학생의 공통 강의 자료실 권한을 직접 확인했습니다.</label></>:<label className={styles.check}><input required type="checkbox" checked={revoked} onChange={event=>setRevoked(event.target.checked)}/>대치온에서 위 학생의 선택 강의 권한을 직접 회수했습니다.</label>}
        </>}
        {action==='RETRY_ACCESS'&&<label>대상 강의<select required value={lecture} onChange={event=>setLecture(event.target.value)}>{retries.map(g=><option key={g.lecture_id} value={g.lecture_id}>강의 ID {g.lecture_id}</option>)}</select></label>}
        {!retries.length&&action==='HOLD'&&<p>현재 재확인을 대기시킬 수 있는 강의가 없습니다. 오래된 결제 조회나 결과 불명 등록은 직접 상태를 확인해야 합니다.</p>}
        <label>담당자<input required maxLength={80} value={operator} onChange={event=>setOperator(event.target.value)}/></label><label>확인 근거·사유<textarea required maxLength={1000} value={reason} onChange={event=>setReason(event.target.value)}/></label>
        <label className={styles.check}><input type="checkbox" required checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>{detail.order.contact_snapshot.studentName} 학생의 위 주문과 처리 내용을 확인했습니다.</label>
      </fieldset><button type="submit" disabled={busy||reload||!uncertain&&!canAct}>{busy?'처리 확인 중…':uncertain?'같은 요청 결과 다시 확인':'확인 내용 저장'}</button></form>
      <h3>관리자 처리 이력</h3>{detail.actions.length?detail.actions.map((item,index)=><p key={index}>{date(item.created_at)} · {item.operator_name} · {actionLabel(item.action)}{item.lecture_id&&` · 강의 ID ${item.lecture_id}`}{item.student_id&&` · 학생 ID ${item.student_id} · 강의 ID ${item.target_ids?.join(', ')}`}{!item.student_id&&Boolean(item.target_ids?.length)&&` · 확인한 강의 ID ${item.target_ids?.join(', ')}`} · 버전 {item.before_version} → {item.after_version}<br/>{item.recovery_evidence?.billId&&`청구서 ${item.recovery_evidence.billId} · ${item.recovery_evidence.amountWon?.toLocaleString()}원 · 승인 ${date(item.recovery_evidence.paidAt??null)}`}{item.recovery_evidence?.jobId&&`시트 작업 ${item.recovery_evidence.jobId}`}{item.recovery_evidence?.studentId&&`학생 ID ${item.recovery_evidence.studentId} · 확인한 차시 ID ${item.recovery_evidence.weeklyLectureIds?.join(', ')||'회수 기록'}`}<br/>{item.reason}</p>):<p>관리자 처리 이력이 없습니다.</p>}
    </section>}
  </main>
}
