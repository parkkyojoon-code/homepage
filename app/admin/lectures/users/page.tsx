'use client'
import { useRef,useState } from 'react'
import Link from 'next/link'
type User={id:string;username:string;name:string;phone:string;credential_version:number;must_change_password:boolean;password_expires_at:string|null;disabled_at:string|null}
type Issued={username:string;password:string;expiresAt:string}
export default function Buyers(){
 const [q,setQ]=useState(''),[users,setUsers]=useState<User[]>([]),[more,setMore]=useState(false),[selected,setSelected]=useState<User|null>(null)
 const [reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[issued,setIssued]=useState<Issued|null>(null)
 const pending=useRef<string|null>(null),inFlight=useRef(false)
 async function load(){
  const r=await fetch(`/api/lectures/admin/users?q=${encodeURIComponent(q.trim())}`,{cache:'no-store'}),d=await r.json()
  if(!r.ok)throw new Error(d.error)
  setUsers(d.users);setMore(d.hasMore)
 }
 async function search(e:React.FormEvent){
  e.preventDefault();if(inFlight.current)return
  inFlight.current=true;setBusy(true);setMessage('');setIssued(null);setSelected(null);setUsers([]);setMore(false)
  try{await load()}catch(e){setMessage(e instanceof Error?e.message:'조회하지 못했습니다.')}finally{inFlight.current=false;setBusy(false)}
 }
 async function reset(e:React.FormEvent){
  e.preventDefault();if(!selected||!confirmed||inFlight.current)return
  inFlight.current=true;setBusy(true);setMessage('');setIssued(null)
  pending.current??=JSON.stringify({expectedCredentialVersion:selected.credential_version,requestKey:crypto.randomUUID(),reason,confirmed:true})
  try{
   const r=await fetch(`/api/lectures/admin/users/${selected.id}/reset-password`,{method:'POST',headers:{'Content-Type':'application/json'},body:pending.current}),d=await r.json()
   if(!r.ok)throw new Error(d.error)
   if(d.temporaryPassword)setIssued({username:selected.username,password:d.temporaryPassword,expiresAt:d.expiresAt})
   setMessage(d.alreadyApplied?'이미 초기화한 요청입니다. 임시 비밀번호는 다시 표시하지 않습니다. 전달하지 못했다면 계정을 새로 조회하고 다시 초기화해주세요.':'초기화했습니다. 임시 비밀번호를 본인 확인한 학생에게 직접 전달해주세요.')
   setSelected(null);pending.current=null;await load()
  }catch(e){setMessage(e instanceof Error?e.message:'결과를 확인하지 못했습니다. 같은 요청으로 재시도하거나 새로 조회해주세요.')}finally{inFlight.current=false;setBusy(false)}
 }
 return <main style={{maxWidth:850,margin:'auto',padding:32}}><nav><Link href="/admin/lectures/orders">주문 관리</Link> · <Link href="/admin/lectures/login">관리자 로그인</Link></nav><h1>구매자 비밀번호 초기화</h1><p>본인 확인 후 대상 계정과 연락처를 대조해주세요. 초기화하면 기존 로그인은 해제됩니다. 임시 비밀번호는 30분간 유효하며 학생은 접속 후 새 비밀번호를 설정해야 합니다.</p>
  <form onSubmit={search}><label>아이디·이름·전화번호<input style={{color:'#111'}} minLength={2} maxLength={50} required disabled={busy} value={q} onChange={e=>setQ(e.target.value)}/></label><button disabled={busy}>검색</button></form><p role="status">{message}</p>{more&&<p>검색 결과가 20건을 넘습니다. 아이디나 전화번호로 범위를 좁혀주세요.</p>}
  {issued&&<section style={{padding:20,border:'1px solid #94a3b8'}}><h2>{issued.username} 임시 비밀번호</h2><input style={{width:'100%',color:'#111'}} aria-label="발급된 임시 비밀번호" readOnly autoComplete="off" value={issued.password}/><p>만료: {new Date(issued.expiresAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}. 이 화면을 닫으면 다시 조회할 수 없습니다.</p><button onClick={()=>setIssued(null)}>임시 비밀번호 숨기기</button></section>}
  {users.map(u=><article key={u.id} style={{padding:16,borderBottom:'1px solid #64748b'}}><h2>{u.name} ({u.username})</h2><p>{u.phone} · {u.disabled_at?'중지된 계정':u.must_change_password?'비밀번호 변경 대기':'정상'}</p><button disabled={busy||!!u.disabled_at} onClick={()=>{setSelected(u);setReason('');setConfirmed(false);setIssued(null);pending.current=null}}>이 계정 초기화</button></article>)}
  {selected&&<form onSubmit={reset} style={{padding:20,border:'1px solid #94a3b8'}}><h2>초기화 대상: {selected.name} ({selected.username})</h2><p>{selected.phone}</p><fieldset disabled={busy} style={{display:'grid',gap:16}}><label>본인 확인 근거·초기화 사유<textarea style={{display:'block',width:'100%',color:'#111'}} required minLength={5} maxLength={500} value={reason} onChange={e=>{setReason(e.target.value);pending.current=null}} placeholder="확인 방법과 사유. 신분증 번호나 비밀번호는 입력하지 마세요."/></label><label><input type="checkbox" checked={confirmed} onChange={e=>{setConfirmed(e.target.checked);pending.current=null}}/>본인 확인과 대상 계정 대조를 마쳤고 기존 로그인이 해제됨을 확인했습니다.</label><button disabled={!confirmed}>초기화 · 임시 비밀번호 발급</button><button type="button" onClick={()=>setSelected(null)}>닫기</button></fieldset></form>}
 </main>
}
