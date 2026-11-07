'use client'
import {useEffect,useRef,useState,type FormEvent} from 'react'
import Link from 'next/link'
import {catalogResponse,cartResponse,quoteResponse,noPurchaseResponse,pendingOrder,receiptResponse,type CartProduct,type CartQuote} from '@/lib/cart-checkout-contract'
import StudentHistoryChoice,{type StudentHistory} from './StudentHistoryChoice'
import base from './application.module.css'
import styles from './cart.module.css'

const storageKey='pkjmath-cart-pending-v1'
type Pending=ReturnType<typeof pendingOrder.parse>
type Checked=ReturnType<typeof cartResponse.parse>
class VisibleError extends Error{}
export default function CartCheckout(){
  const [products,setProducts]=useState<CartProduct[]>([]),[available,setAvailable]=useState(false),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0)
  const [selected,setSelected]=useState<string[]>([]),[checked,setChecked]=useState<Checked|null>(null),[checking,setChecking]=useState(false)
  const [form,setForm]=useState({studentName:'',studentPhone:'',guardianName:'',guardianPhone:'',payerPhone:'',applicantType:'',confirmPayment:false,agreePrivacy:false})
  const [history,setHistory]=useState<StudentHistory>(),[quote,setQuote]=useState<CartQuote|null>(null),[finalConfirmed,setFinalConfirmed]=useState(false),[now,setNow]=useState(Date.now())
  const [pending,setPending]=useState<Pending|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[none,setNone]=useState(false)
  const [receipt,setReceipt]=useState<ReturnType<typeof receiptResponse.parse>|null>(null)
  const operation=useRef(false)
  useEffect(()=>{
    try{const saved=sessionStorage.getItem(storageKey);if(saved){const p=pendingOrder.safeParse(JSON.parse(saved));if(p.success)setPending(p.data);else sessionStorage.removeItem(storageKey)}}catch{}
  },[])
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setAvailable(false);setChecked(null);setForm(old=>({...old,confirmPayment:false}))
    fetch('/api/daechion/orders/catalog',{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return catalogResponse.parse(await r.json())})
      .then(data=>{if(!controller.signal.aborted){setProducts(data.products);setAvailable(data.available)}})
      .catch(()=>{if(!controller.signal.aborted)setError('상품을 불러오지 못했습니다. 잠시 후 다시 확인해주세요.')})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return()=>controller.abort()
  },[refresh])
  useEffect(()=>{
    const controller=new AbortController();setChecked(null)
    if(!selected.length||!available||pending){setChecking(false);return()=>controller.abort()}
    setChecking(true)
    fetch('/api/daechion/orders/cart',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({items:selected.map(productId=>({productId}))})})
      .then(async r=>{const data=await r.json();if(r.status!==200&&r.status!==409)throw Error();return cartResponse.parse(data)})
      .then(data=>{if(!controller.signal.aborted)setChecked(data)})
      .catch(()=>{if(!controller.signal.aborted)setError('선택한 상품을 확인하지 못했습니다. 선택 내용을 다시 확인해주세요.')})
      .finally(()=>{if(!controller.signal.aborted)setChecking(false)})
    return()=>controller.abort()
  },[selected,available,products,pending])
  useEffect(()=>{if(!quote)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[quote])
  function invalidate(){setQuote(null);setFinalConfirmed(false);setNone(false);setError('')}
  function changeSelection(id:string){invalidate();setChecked(null);setForm(old=>({...old,confirmPayment:false}));setSelected(old=>old.includes(id)?old.filter(v=>v!==id):[...old,id])}
  function update(key:keyof typeof form,value:string|boolean){invalidate();setForm(old=>({...old,[key]:value}))}
  async function createQuote(event:FormEvent){
    event.preventDefault()
    if(operation.current||!checked||checked.conflicts.length||checking||pending)return
    invalidate()
    if(!history||!form.applicantType||!form.studentName.trim()||!form.studentPhone.trim()||!form.payerPhone.trim()||!form.confirmPayment||!form.agreePrivacy){setError('필수 정보와 동의 항목을 확인해주세요.');return}
    operation.current=true;setBusy(true)
    try{
      const r=await fetch('/api/daechion/orders/quotes',{method:'POST',signal:AbortSignal.timeout(45000),headers:{'Content-Type':'application/json'},body:JSON.stringify({items:selected.map(productId=>({productId})),contact:{...form,studentHistory:history},expectedTotalWon:checked.totalWon})})
      const data=await r.json()
      if(!r.ok){if(data.code==='PRICE_CHANGED'||data.status==='CART_CONFLICT')setRefresh(v=>v+1);throw new VisibleError(typeof data.error==='string'?data.error:'선택한 상품을 다시 확인해주세요.')}
      if(noPurchaseResponse.safeParse(data).success){setNone(true);return}
      const parsed=quoteResponse.parse(data);setQuote(parsed);setNow(Date.now())
    }catch(e){setError(e instanceof VisibleError?e.message:'신청 내용을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.')}
    finally{operation.current=false;setBusy(false)}
  }
  async function submitOrder(saved?:Pending){
    if(operation.current)return
    if(!saved&&(!quote||!finalConfirmed||Date.parse(quote.expiresAt)<=Date.now()))return
    const body=saved??{quoteId:quote!.quoteId,quoteToken:quote!.quoteToken,requestKey:crypto.randomUUID(),expectedTotalWon:quote!.totalWon}
    operation.current=true;setBusy(true);setPending(body);setError('')
    // Only the retry capability is tab-scoped. Names and phone numbers are not stored.
    try{sessionStorage.setItem(storageKey,JSON.stringify(body))}catch{}
    try{
      const r=await fetch('/api/daechion/orders',{method:'POST',signal:AbortSignal.timeout(25000),headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      const data=await r.json()
      if(!r.ok){
        if(r.status>=400&&r.status<500){setPending(null);setQuote(null);setFinalConfirmed(false);try{sessionStorage.removeItem(storageKey)}catch{}}
        throw new VisibleError(typeof data.error==='string'?data.error:'접수 결과를 확인하지 못했습니다. 같은 접수를 다시 확인해주세요.')
      }
      const result=receiptResponse.parse(data);setReceipt(result);setPending(null)
      try{sessionStorage.removeItem(storageKey)}catch{}
    }catch(e){setError(e instanceof VisibleError?e.message:'접수 결과를 확인하지 못했습니다. 아래 버튼으로 같은 접수를 다시 확인해주세요.')}
    finally{operation.current=false;setBusy(false)}
  }
  const locked=busy||Boolean(pending),total=selected.reduce((sum,id)=>sum+(products.find(p=>p.productId===id)?.priceWon??0),0)
  const expired=quote&&Date.parse(quote.expiresAt)<=now
  const field=(key:'studentName'|'studentPhone'|'guardianName'|'guardianPhone'|'payerPhone',label:string,required=false)=><label className={base.field}>{label}{required?' *':' (선택)'}<input name={key} type={key.endsWith('Phone')?'tel':'text'} value={form[key]} maxLength={key.endsWith('Phone')?40:80} autoComplete="off" required={required} onChange={e=>update(key,e.target.value)}/></label>
  if(receipt)return <main className={base.page}><section className={base.card} aria-live="polite"><h1>{receipt.reviewRequired?'담당자 확인 요청을 접수했습니다.':'신청이 접수되었습니다.'}</h1>
    <p>{receipt.reviewRequired?'담당자가 수강 정보와 선택한 상품을 확인한 뒤 안내드립니다. 아직 청구서가 발송된 상태는 아닙니다.':'결제 안내는 입력하신 결제 전화번호로 발송됩니다. 결제 확인과 모든 강의의 수강 등록이 완료되면 대치온 이용 안내를 보내드립니다.'}</p>
    <Link href="/classes" className={base.link}>수업 목록으로</Link></section></main>
  return <main className={base.page}><div className={styles.container}>
    <Link href="/classes" className={base.link}>← 수업 목록</Link><h1 className={styles.heading}>강의 장바구니</h1><p className={base.sub}>한 학생이 수강할 강의를 선택해주세요. 묶음상품은 표시된 판매가로 구매합니다.</p>
    {error&&<p className={base.error} role="alert">{error}</p>}
    {pending&&<section className={styles.panel} aria-live="polite"><h2>접수 결과 확인</h2><p>이전에 신청한 {pending.expectedTotalWon.toLocaleString('ko-KR')}원의 접수 결과를 확인합니다. 새 신청을 만들지 않고 같은 접수를 다시 확인합니다.</p><button type="button" className={base.submit} disabled={busy} onClick={()=>submitOrder(pending)}>{busy?'확인 중…':'같은 접수 다시 확인'}</button></section>}
    {!pending&&(loading?<p role="status">상품을 불러오는 중…</p>:!available?<section className={styles.panel}><p role="status">현재 여러 강의의 구매 신청을 준비 중입니다.</p><button type="button" className={styles.secondary} onClick={()=>setRefresh(v=>v+1)}>상품 다시 불러오기</button></section>:<>
      <fieldset className={styles.selection} disabled={locked}><legend>구매할 강의 선택</legend><div className={styles.products}>{products.map(p=><label className={styles.product} key={p.productId}>
        <span className={styles.productTitle}><input type="checkbox" checked={selected.includes(p.productId)} disabled={!selected.includes(p.productId)&&selected.length>=30} onChange={()=>changeSelection(p.productId)}/>{p.title}</span>
        <span className={base.sub}>{p.saleKind==='BUNDLE'?`묶음상품 · ${p.lectureCount}개 강의`:'개별 강의'}</span><strong>{p.priceWon.toLocaleString('ko-KR')}원</strong></label>)}</div></fieldset>
      <section className={styles.panel} aria-label="선택한 상품"><h2>선택한 상품 {selected.length}개</h2>
        {!selected.length?<p className={base.sub}>구매할 강의를 선택해주세요.</p>:<ul className={styles.items}>{selected.map(id=><li key={id}><span>{products.find(p=>p.productId===id)?.title??'판매 확인이 필요한 상품'}</span><button type="button" className={styles.secondary} disabled={locked} onClick={()=>changeSelection(id)} aria-label={`${products.find(p=>p.productId===id)?.title??id} 제외`}>제외</button></li>)}</ul>}
        <p className={styles.total}>선택 금액 <strong>{total.toLocaleString('ko-KR')}원</strong></p>
        {checking&&<p role="status">가격과 강의 구성을 확인하고 있습니다.</p>}
        {checked&&checked.conflicts.length>0&&<div className={styles.conflict} role="alert"><h3>중복된 강의가 포함되어 있습니다.</h3><p>아래 상품 중 하나를 제외한 뒤 신청해주세요. 중복 상품을 자동으로 삭제하거나 가격을 차감하지 않습니다.</p><ul>{checked.conflicts.map(c=><li key={c.lectureId}>{c.lectureName}: {c.productTitles.join(' / ')}</li>)}</ul></div>}
      </section>
      <section className={styles.panel}><h2>학생 정보</h2><form onSubmit={createQuote}>
        <fieldset className={base.fields} disabled={locked}>
          <StudentHistoryChoice value={history} onChange={v=>{invalidate();setHistory(v)}}/>
          <fieldset className={base.applicant}><legend>신청자 (필수)</legend>{[['STUDENT','학생 본인'],['GUARDIAN','학부모']].map(([value,label])=><label key={value}><input type="radio" name="applicantType" required checked={form.applicantType===value} onChange={()=>update('applicantType',value)}/>{label}</label>)}</fieldset>
          <div className={base.grid}>{field('studentName','학생 이름',true)}{field('guardianName','학부모 이름')}{field('studentPhone','학생 전화번호',true)}{field('guardianPhone','보호자 로그인 전화번호')}{field('payerPhone','결제 전화번호',true)}</div>
          <p className={base.sub}>청구서는 결제 전화번호로 받습니다. 보호자 로그인을 사용하려면 보호자 로그인 전화번호를 별도로 입력해주세요.</p>
          <label className={base.consent}><input type="checkbox" required checked={form.confirmPayment} onChange={e=>update('confirmPayment',e.target.checked)}/>선택한 상품과 {total.toLocaleString('ko-KR')}원의 금액을 확인했습니다. (필수)</label>
          <label className={base.consent}><input type="checkbox" required checked={form.agreePrivacy} onChange={e=>update('agreePrivacy',e.target.checked)}/>신청·결제·수강 등록을 위한 개인정보 수집·이용에 동의합니다. (필수)</label><Link href="/privacy" target="_blank" rel="noopener noreferrer" className={base.link}>개인정보 처리방침</Link>
        </fieldset>
        <button className={base.submit} type="submit" disabled={locked||!checked||checked.conflicts.length>0||checking}>{busy?'신청 내용 확인 중…':'신청 내용 확인'}</button>
      </form></section>
      {none&&<section className={styles.panel} role="status"><h2>추가 결제가 필요하지 않습니다.</h2><p>선택한 강의가 모두 이미 수강 가능한 상태입니다.</p></section>}
      {quote&&!pending&&<section className={styles.panel} aria-label="최종 신청 확인" aria-live="polite"><h2>최종 신청 확인</h2>
        {quote.excluded.length>0&&<p className={styles.notice}>이미 수강 가능한 개별 강의는 제외했습니다: {quote.excluded.map(i=>i.title).join(', ')}. 변경된 상품과 금액을 다시 확인해주세요.</p>}
        <ul>{quote.items.map(i=><li key={i.productId}>{i.title} · {i.priceWon.toLocaleString('ko-KR')}원</li>)}</ul>
        {quote.status==='REVIEW'&&<p className={styles.notice}>기존 수강 정보 또는 묶음상품에 포함된 강의의 보유 여부를 담당자가 확인해야 합니다. 일부 강의를 임의로 빼거나 차감하지 않으며, 확인 전에는 청구하지 않습니다.</p>}
        <p className={styles.total}>{quote.status==='REVIEW'?'확인 요청 금액':'최종 신청 금액'} <strong>{quote.totalWon.toLocaleString('ko-KR')}원</strong></p>
        {expired?<p role="status">확인 시간이 지났습니다. 위의 ‘신청 내용 확인’을 다시 눌러주세요.</p>:<label className={base.consent}><input type="checkbox" checked={finalConfirmed} disabled={busy} onChange={e=>setFinalConfirmed(e.target.checked)}/>위 상품과 최종 금액을 확인했습니다.</label>}
        <button type="button" className={base.submit} disabled={busy||!finalConfirmed||Boolean(expired)} onClick={()=>submitOrder()}>{quote.status==='REVIEW'?'담당자 확인 요청':'강의 구매 신청'}</button>
      </section>}
    </>)}
  </div></main>
}
