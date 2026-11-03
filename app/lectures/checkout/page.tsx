'use client'
import { useEffect,useRef,useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { orderInput } from '@/lib/lectures/input'
import type { z } from 'zod'
type Item={id:string;title:string;price_won:number}
type Buyer={id:string;name:string;phone:string}
type Draft=z.infer<typeof orderInput>
export default function Checkout(){
 const router=useRouter()
 const [items,setItems]=useState<Item[]>([]),[buyer,setBuyer]=useState<Buyer|null>(null),[message,setMessage]=useState('주문 내용을 확인하고 있습니다.')
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false)
 const [recipientType,setRecipientType]=useState<'SELF'|'GUARDIAN'>('SELF'),[name,setName]=useState(''),[phone,setPhone]=useState(''),[frozen,setFrozen]=useState<Draft|null>(null)
 const sending=useRef(false),storage=useRef('')
 useEffect(()=>{
  const c=new AbortController()
  async function load(){try{
   const ids=new URLSearchParams(location.search).getAll('lecture')
   if(!ids.length||ids.length>50||new Set(ids).size!==ids.length)throw new Error('구매할 강의를 다시 선택해주세요.')
   const me=await fetch('/api/lectures/me',{signal:c.signal}),profile=await me.json()
   if(!me.ok){if(profile.code==='PASSWORD_CHANGE_REQUIRED')router.replace('/lectures/change-password');throw new Error(profile.error||'로그인이 필요합니다.')}
   setBuyer(profile)
   const r=await fetch('/api/lectures/catalog',{signal:c.signal,cache:'no-store'}),data=await r.json();if(!r.ok)throw new Error(data.error)
   let chosen=(data as Item[]).filter(i=>ids.includes(i.id));if(chosen.length!==ids.length)throw new Error('판매 강의를 다시 선택해주세요.')
   storage.current=`lecture-checkout:${profile.id}:${[...ids].sort().join(',')}`
   let restored:Draft|null=null
   try{
    const saved=sessionStorage.getItem(storage.current)
    if(saved){const parsed=orderInput.safeParse(JSON.parse(saved));if(parsed.success&&parsed.data.items.map(i=>i.lectureId).sort().join(',')===[...ids].sort().join(','))restored=parsed.data}
   }catch{/* An unavailable browser store does not change the server-side request checks. */}
   if(restored){setFrozen(restored);setRecipientType(restored.billingRecipient.type);setName(restored.billingRecipient.name);setPhone(restored.billingRecipient.phone);chosen=chosen.map(i=>({...i,price_won:restored!.items.find(x=>x.lectureId===i.id)!.expectedPriceWon}));setMessage('이전 주문 요청을 보관하고 있습니다. 같은 내용으로 결과를 다시 확인하거나 내 주문을 확인해주세요.')}
   else{setName(profile.name);setPhone(profile.phone);setMessage('')}
   setItems(chosen);setReady(true)
  }catch(e){if(!c.signal.aborted)setMessage(e instanceof Error?e.message:'주문 내용을 불러오지 못했습니다.')}}
  void load();return()=>c.abort()
 },[router])
 function parseDraft(input:unknown){const result=orderInput.safeParse(input);if(!result.success)throw new Error(result.error.issues[0]?.message||'주문 내용을 확인해주세요.');return result.data}
 const total=items.reduce((sum,i)=>sum+i.price_won,0)
 async function submit(e:React.FormEvent){
  e.preventDefault();if(sending.current||!ready||!buyer||!confirmed)return
  sending.current=true;setBusy(true);setMessage('주문과 청구 요청을 저장하고 있습니다.')
  try{
   const draft=frozen??parseDraft({items:items.map(i=>({lectureId:i.id,expectedPriceWon:i.price_won})),requestKey:crypto.randomUUID(),expectedTotalWon:total,billingRecipient:{type:recipientType,name:recipientType==='SELF'?buyer.name:name,phone:recipientType==='SELF'?buyer.phone:phone}})
   setFrozen(draft);try{sessionStorage.setItem(storage.current,JSON.stringify(draft))}catch{/* Keep the same draft in memory for retries. */}
   const r=await fetch('/api/lectures/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)}),d=await r.json()
   if(!r.ok)throw new Error(d.error)
   try{sessionStorage.removeItem(storage.current)}catch{}
   router.replace(`/lectures/orders/${d.id}`)
  }catch(e){setMessage(e instanceof Error?e.message:'결과를 확인하지 못했습니다. 같은 내용으로 재시도하거나 내 주문을 확인해주세요.');sending.current=false;setBusy(false)}
 }
 function restart(){if(!busy&&window.confirm('이미 저장된 주문은 취소되지 않습니다. 내 주문을 먼저 확인해주세요. 현재 입력 내용을 새로 확인할까요?')){try{sessionStorage.removeItem(storage.current)}catch{};location.reload()}}
 return <main style={{maxWidth:760,margin:'auto',padding:'48px 24px'}}><Link href="/lectures">← 강의 목록 / 내 주문</Link><h1>주문 내용 확인</h1><p role="status">{message}</p>
  {ready&&<form onSubmit={submit}><ul>{items.map(i=><li key={i.id}>{i.title} · {i.price_won.toLocaleString()}원</li>)}</ul><h2>총 {total.toLocaleString()}원</h2>
   <fieldset disabled={busy||!!frozen} style={{display:'grid',gap:16}}><legend>청구서 수신자</legend><label>받는 사람<select style={{color:'#111'}} value={recipientType} onChange={e=>{const t=e.target.value as 'SELF'|'GUARDIAN';setRecipientType(t);setName(t==='SELF'?buyer?.name||'':'');setPhone(t==='SELF'?buyer?.phone||'':'');setConfirmed(false)}}><option value="SELF">본인</option><option value="GUARDIAN">보호자</option></select></label><label>이름<input style={{color:'#111'}} required maxLength={50} readOnly={recipientType==='SELF'} value={name} onChange={e=>{setName(e.target.value);setConfirmed(false)}}/></label><label>휴대전화<input style={{color:'#111'}} type="tel" required maxLength={20} readOnly={recipientType==='SELF'} value={phone} onChange={e=>{setPhone(e.target.value);setConfirmed(false)}}/></label></fieldset>
   <p>청구서는 위 번호로 발송됩니다. 보호자가 결제하더라도 강의는 구매자 본인 계정에 열립니다. 발송 확인 후 결제 기한은 7일입니다.</p><p>주문 저장은 결제 완료가 아닙니다. 이미 납부했다면 추가 결제하지 말고 주문 상태를 확인해주세요.</p>
   <label><input type="checkbox" disabled={busy} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>강의별 가격·합계·청구서 수신자를 확인했습니다.</label><p><button disabled={!confirmed||busy}>{busy?'주문 처리 중…':frozen?'같은 주문 요청 결과 확인':'주문 · 청구 요청 저장'}</button></p>{frozen&&<button type="button" disabled={busy} onClick={restart}>주문 내용을 새로 확인</button>}
  </form>}{!ready&&<Link href="/lectures/login">로그인</Link>}
 </main>
}
