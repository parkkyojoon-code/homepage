import {z} from 'zod'
import type {LedgerClient} from '../ledger'
import {orderReason} from './reasons'
export {orderReason} from './reasons'
import {contactSchema} from './checkout'
import {latestReview,reviewContext} from './manual-review'

export const ORDER_HEADERS=Object.freeze(['주문번호','신청시각','프로세스','신청자 유형','학생 이름','학부모 이름','학생 전화번호','보호자 로그인 전화번호','결제 전화번호',
  '기존·신규 선택','상품명','상품 ID','상품 종류','상품별 판매가','총 청구 금액','원비 확인','개인정보 동의','안내문 버전','견적번호',
  '접수 상태','청구 상태','현재 청구서 번호','전체 청구서 번호','청구 발송시각','자동 등록 대기 종료시각','결제 상태','결제 완료시각',
  '대치온 학생 ID','강의별 등록·권한 상태','안내 발송 상태','수신 번호별 안내 상태','중복 수강생 확인','중복 확인 사유','처리 확인','확인 필요 사유','동기화 기준 버전','마지막 반영 시도시각'])
const labels:Record<string,string>={DRAFT:'접수 준비',READY:'자동 처리 대기',REVIEW:'확인 필요',CLOSED:'대기 종료',
  NOT_CREATED:'미발송',RESERVED:'청구 준비',SEND_UNKNOWN:'발송 결과 확인 필요',SENT:'발송 접수 완료',CANCELLED:'취소',DESTROYED:'파기',
  PENDING:'대기',PAID:'결제 완료',UNKNOWN:'결과 확인 필요',RUNNING:'처리 중',VERIFIED:'권한 검증 완료',MANUAL:'수동 권한 확인',
  NOT_READY:'전체 권한 확인 후 발송',FAILED:'처리 중단',BLOCKED:'미발송·처리 중단',DONE:'완료',REVOKED:'수동 회수 확인'}
const state=(value:unknown)=>{const text=labels[String(value)];if(!text)throw Error('INVALID_ORDER_SHEET_STATE');return text}
function koreanTime(value:unknown){
  if(!value)return ''
  const d=new Date(value as string);if(!Number.isFinite(d.getTime()))throw Error('INVALID_ORDER_SHEET_TIME')
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(d)
}
export interface OrderSheetView {id:string;version:string;values:(string|number)[]}
export async function orderSheetView(c:LedgerClient,id:string):Promise<OrderSheetView>{
  z.string().uuid().parse(id)
  const o=(await c.query('SELECT * FROM daechion_orders.orders WHERE id=$1',[id])).rows[0]
  if(!o)throw Error('ORDER_SHEET_NOT_FOUND')
  const {noticeVersion,...raw}=o.contact_snapshot as Record<string,unknown>,contact=contactSchema.parse(raw)
  const items=(await c.query('SELECT * FROM daechion_orders.items WHERE order_id=$1 ORDER BY product_id',[id])).rows
  const grants=(await c.query('SELECT * FROM daechion_orders.grants WHERE order_id=$1 ORDER BY lecture_id',[id])).rows
  const bills=(await c.query('SELECT * FROM daechion_orders.bills WHERE order_id=$1 ORDER BY revision',[id])).rows
  const receipts=(await c.query('SELECT * FROM daechion_orders.ready_receipts WHERE order_id=$1 ORDER BY phone',[id])).rows
  const jobs=(await c.query("SELECT kind,state,last_error FROM daechion_orders.jobs WHERE order_id=$1 AND (state IN ('UNKNOWN','FAILED') OR last_error IS NOT NULL)",[id])).rows
  const recovery=(await c.query('SELECT state,result_code FROM daechion_orders.sheet_recoveries WHERE order_id=$1 ORDER BY created_at DESC,request_key DESC LIMIT 1',[id])).rows[0]
  const quote=(await c.query('SELECT snapshot FROM daechion_orders.quotes WHERE id=$1',[o.quote_id])).rows[0]
  const quoteReasons=z.array(z.object({productId:z.string(),code:z.enum(['BUNDLE_ALREADY_OWNED','OWNERSHIP_UNKNOWN'])})).parse((quote?.snapshot as {reviewReasons?:unknown})?.reviewReasons??[])
  const itemTitle=(productId:string)=>String(items.find(i=>i.product_id===productId)?.title??productId)
  const reviewed=await latestReview(c,id)
  const bound=reviewed?reviewContext({orderId:id,version:String(o.version),tenantId:String(o.tenant_id),totalWon:Number(o.total_won),contact,items:items.map(i=>i.snapshot)}):null
  const reviewAge=reviewed?Date.now()-Date.parse(reviewed.checkedAt):NaN
  // Once an invoice attempt exists, keep the checked identity pinned while
  // awaiting payment. Expiry only requests reapproval before billing starts.
  const reviewedFresh=reviewed&&reviewed.binding===bound?.binding&&reviewAge>=0&&(reviewAge<=15*60000||bills.length>0)
  const identityConcern=o.identity_state==='REVIEW'||typeof o.review_code==='string'&&(/^identity_/.test(o.review_code)&&o.review_code!=='identity_reconciled'||o.review_code==='billing_preflight_review')
  const duplicateReason=identityConcern?orderReason(o.review_code):o.identity_state==='PASSED'?'학생 정보·전화번호 대조 완료':reviewedFresh?`관리자 확인: 학생 ID ${reviewed.studentId} · 전체 강의 미보유 — ${bills.length?'청구 시 확인한 학생으로 결제 후 재검사':'청구 전 재검사 대기'}`:reviewed?'관리자 확인 유효기간 경과 또는 신청 정보 불일치 — 재확인 필요':quoteReasons.map(r=>`${itemTitle(r.productId)}: ${r.code==='BUNDLE_ALREADY_OWNED'?'묶음에 기보유 강의 포함':'기존 수강 여부·전화번호·보유 권한 확인 필요'}`).join('\n')
  const duplicate=identityConcern?'확인 필요':o.identity_state==='PASSED'||reviewedFresh?'통과':reviewed||quoteReasons.length?'확인 필요':'조회 대기'
  const errors=[orderReason(o.review_code),...grants.filter(g=>g.state==='REVIEW').map(g=>`강의 ID ${g.lecture_id}: ${orderReason(g.review_code)}`),
    ...(recovery&&['UNKNOWN','FAILED'].includes(String(recovery.state))?[`시트 복구: ${orderReason(recovery.result_code)}`]:[]),
    ...jobs.map(j=>`${j.kind==='SHEETS'?'시트':'안내 문자'}: ${orderReason(j.last_error)||state(j.state)}`),
    ...receipts.filter(r=>r.state==='UNKNOWN').map(r=>`${r.phone}: 문자 결과 확인 필요`)].filter(Boolean)
  const expectedExpiry=o.checkout_state==='CLOSED'&&o.review_code==='unpaid_wait_closed'
  const attention=errors.length>(expectedExpiry?1:0)||duplicate==='확인 필요'
  const current=bills.find(b=>b.is_current)
  for(const b of bills)if(!/^\d{20}$/.test(String(b.bill_id)))throw Error('INVALID_ORDER_SHEET_BILL')
  const values:(string|number)[]=[id,koreanTime(o.created_at),'프로세스2',contact.applicantType==='STUDENT'?'학생 본인':'학부모',contact.studentName,contact.guardianName,contact.studentPhone,contact.guardianPhone,contact.payerPhone,
    contact.studentHistory==='NEW'?'신규 수강생':'기존 수강생',items.map(i=>String(i.title)).join('\n'),items.map(i=>String(i.product_id)).join('\n'),items.map(i=>i.sale_kind==='BUNDLE'?'묶음상품':'개별 강의').join('\n'),
    items.map(i=>`${i.title}: ${Number(i.price_won).toLocaleString('ko-KR')}원`).join('\n'),Number(o.total_won),'확인','동의',String(noticeVersion??''),String(o.quote_id),state(o.checkout_state),state(current?.state??'NOT_CREATED'),
    current?String(current.bill_id):'',bills.map(b=>String(b.bill_id)).join('\n'),koreanTime(current?.sent_at),koreanTime(current?.due_at),o.payment_state==='PENDING'?'미납':state(o.payment_state),koreanTime(o.paid_at),o.student_id?String(o.student_id):'',
    grants.map(g=>`ID ${g.lecture_id}: ${state(g.state)}${g.review_code?' — '+orderReason(g.review_code):''}`).join('\n'),state(o.notification_state),receipts.map(r=>`${r.phone}: ${state(r.state)}`).join('\n'),
    duplicate,duplicateReason,attention?'확인 필요':expectedExpiry?'대기 종료':'정상',[...new Set(errors)].join('\n'),String(o.version),koreanTime(new Date())]
  if(values.length!==ORDER_HEADERS.length)throw Error('ORDER_SHEET_COLUMNS_MISMATCH')
  return {id,version:String(o.version),values}
}
export function orderFormatting(sheetId:number){
  if(!Number.isSafeInteger(sheetId)||sheetId<0)throw Error('INVALID_ORDER_SHEET_TARGET')
  const rules=[{column:'중복 수강생 확인',text:'통과',red:false},{column:'중복 수강생 확인',text:'확인 필요',red:true},{column:'처리 확인',text:'확인 필요',red:true}]
  return rules.map((r,index)=>({addConditionalFormatRule:{index,rule:{
    ranges:[{sheetId,startRowIndex:0,startColumnIndex:ORDER_HEADERS.indexOf(r.column),endColumnIndex:ORDER_HEADERS.indexOf(r.column)+1}],
    booleanRule:{condition:{type:'TEXT_EQ',values:[{userEnteredValue:r.text}]},format:{
      backgroundColor:r.red?{red:.72,green:.11,blue:.11}:{red:.85,green:.93,blue:.83},
      textFormat:{bold:true,foregroundColor:r.red?{red:1,green:1,blue:1}:{red:.15,green:.3,blue:.07}},
    }},
  }}}))
}
