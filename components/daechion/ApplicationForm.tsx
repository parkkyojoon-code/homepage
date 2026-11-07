'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import StudentHistoryChoice, { type StudentHistory } from './StudentHistoryChoice'
import styles from './application.module.css'

export default function ApplicationForm({ productId, name, mode, campus, tuition, textbook }: {
  productId:string; name:string; mode:'ONLINE'|'OFFLINE'; campus:string; tuition:number; textbook:number
}) {
  const [form,setForm] = useState({applicantType:'',studentName:'',guardianName:'',studentPhone:'',guardianPhone:'',payerPhone:'',confirmPayment:false,agreePrivacy:false})
  const [history,setHistory] = useState<StudentHistory>()
  const [available,setAvailable] = useState(false), [busy,setBusy] = useState(false), [complete,setComplete] = useState(false)
  const [error,setError] = useState(''), [uncertain,setUncertain] = useState(false)
  const attempt = useRef<Record<string,unknown>|null>(null)
  const total = tuition+textbook
  const storageKey = `pkjmath-intake:${productId}:${mode}:${campus}`
  useEffect(()=>{
    let active=true
    fetch(`/api/daechion/applications?productId=${encodeURIComponent(productId)}`,{cache:'no-store'})
      .then(response=>response.json()).then(data=>{if(active)setAvailable(data.available===true)}).catch(()=>{if(active)setAvailable(false)})
    return()=>{active=false}
  },[productId])
  const update = (key:keyof typeof form,value:string|boolean)=>setForm(old=>({...old,[key]:value}))
  function requestKey() {
    try { const saved=sessionStorage.getItem(storageKey);if(saved)return saved } catch {}
    const key=crypto.randomUUID()
    try { sessionStorage.setItem(storageKey,key) } catch {}
    return key
  }
  async function submit(event:FormEvent) {
    event.preventDefault(); if(busy||!available)return
    setError('')
    if(!uncertain) {
      if(!history||!form.applicantType||!form.studentName.trim()||!form.studentPhone.trim()||!form.payerPhone.trim()||!form.confirmPayment||!form.agreePrivacy) {setError('필수 정보와 동의 항목을 확인해주세요.');return}
      attempt.current={...form,studentHistory:history,requestKey:requestKey(),productId,mode,campus:mode==='OFFLINE'?campus:'',expectedTotalWon:total}
    }
    if(!attempt.current)return
    setBusy(true)
    try {
      const response=await fetch('/api/daechion/applications',{method:'POST',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json'},body:JSON.stringify(attempt.current)})
      const data=await response.json()
      if(response.ok&&data.success===true&&data.status==='RECEIVED'&&typeof data.applicationId==='string') {
        setComplete(true);setUncertain(false)
        try {sessionStorage.removeItem(storageKey)}catch{}
      } else {
        setUncertain(response.status>=500 || (response.ok&&data.success!==false))
        setError(typeof data.error==='string'?data.error:'접수를 확인하지 못했습니다. 다시 확인해주세요.')
      }
    } catch {setUncertain(true);setError('접수 결과를 확인하지 못했습니다. 같은 신청의 접수를 다시 확인해주세요.')}
    finally {setBusy(false)}
  }
  const field = (key:'studentName'|'guardianName'|'studentPhone'|'guardianPhone'|'payerPhone',label:string,required=false) =>
    <label className={styles.field}>{label}{required?' *':' (선택)'}<input name={key} value={form[key]} onChange={event=>update(key,event.target.value)} required={required}
      maxLength={key.includes('Name')?80:40} type={key.includes('Phone')?'tel':'text'} autoComplete={key.includes('Phone')?'tel':'off'} /></label>
  if(complete) return <main className={styles.page}><section className={styles.card} aria-live="polite">
    <h1>신청이 접수되었습니다.</h1><p>결제 안내는 입력하신 결제 전화번호로 발송됩니다.</p><p>결제 확인과 수강 등록이 완료되면 대치온 이용 안내를 보내드립니다.</p>
    <Link href="/classes" className={styles.link}>수업 목록으로</Link>
  </section></main>
  return <main className={styles.page}><section className={styles.card}>
    <Link href="/classes" className={styles.link}>← 수업 목록</Link><h1>{name}</h1><p className={styles.sub}>{mode==='ONLINE'?'온라인':`현강 · ${campus}`}</p>
    <div className={styles.price}><span>수강료 {tuition.toLocaleString()}원{textbook>0?` + 교재비 ${textbook.toLocaleString()}원`:''}</span><strong>총 {total.toLocaleString()}원</strong></div>
    {!available&&<p className={styles.notice} role="status">현재 신청을 준비 중입니다.</p>}
    <form onSubmit={submit}>
      <fieldset className={styles.fields} disabled={busy||uncertain}>
        <StudentHistoryChoice value={history} onChange={setHistory}/>
        <fieldset className={styles.applicant}><legend>신청자 (필수)</legend>
          {[['STUDENT','학생 본인'],['GUARDIAN','학부모']].map(([value,label])=><label key={value}><input type="radio" name="applicantType" required value={value} checked={form.applicantType===value} onChange={()=>update('applicantType',value)}/>{label}</label>)}
        </fieldset>
        <div className={styles.grid}>{field('studentName','학생 이름',true)}{field('guardianName','학부모 이름')}{field('studentPhone','학생 전화번호',true)}{field('guardianPhone','보호자 로그인 전화번호')}{field('payerPhone','결제 전화번호',true)}</div>
        <p className={styles.sub}>결제 전화번호로 청구서를 받습니다. 보호자 로그인을 사용하려면 보호자 로그인 전화번호를 별도로 입력해주세요.</p>
        <label className={styles.consent}><input type="checkbox" checked={form.confirmPayment} onChange={event=>update('confirmPayment',event.target.checked)} required/>총 {total.toLocaleString()}원의 결제 금액을 확인했습니다. (필수)</label>
        <label className={styles.consent}><input type="checkbox" checked={form.agreePrivacy} onChange={event=>update('agreePrivacy',event.target.checked)} required/>신청·결제·수강 등록을 위한 개인정보 수집·이용에 동의합니다. (필수)</label>
        <Link href="/privacy" target="_blank" rel="noopener noreferrer" className={styles.link}>개인정보 처리방침</Link>
      </fieldset>
      {error&&<p className={styles.error} role="alert">{error}</p>}
      <button className={styles.submit} type="submit" disabled={busy||!available}>{busy?'접수 확인 중…':uncertain?'같은 신청의 접수 다시 확인':'강의 구매 신청'}</button>
    </form>
  </section></main>
}
