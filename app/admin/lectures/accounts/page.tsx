'use client'
import { useCallback,useEffect,useRef,useState } from 'react'
import Link from 'next/link'
type Account={id:string;username:string;name:string;role:'OWNER'|'OPERATOR';disabled_at:string|null;invited:boolean;version:number}
export default function Accounts(){
 const [accounts,setAccounts]=useState<Account[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[link,setLink]=useState('')
 const inFlight=useRef(false)
 const load=useCallback(async()=>{const r=await fetch('/api/lectures/admin/accounts',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error);setAccounts(d.accounts)},[])
 useEffect(()=>{void load().catch(e=>setMessage(e.message))},[load])
 async function command(body:object){
  if(inFlight.current)return
  inFlight.current=true;setBusy(true);setMessage('');setLink('')
  try{const r=await fetch('/api/lectures/admin/accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error);if(d.token)setLink(`${window.location.origin}/admin/lectures/activate#${d.token}`);setMessage('반영했습니다. 링크가 표시되면 해당 관리자에게 직접 전달해주세요.');await load()}
  catch(e){setMessage(e instanceof Error?e.message:'결과를 확인하지 못했습니다. 새로고침한 뒤 확인해주세요.')}finally{inFlight.current=false;setBusy(false)}
 }
 async function create(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);await command({action:'CREATE',username:f.get('username'),name:f.get('name'),role:f.get('role')})}
 return <main style={{maxWidth:850,margin:'auto',padding:32}}><Link href="/admin/lectures/orders">← 주문 관리</Link><h1>관리자 계정 관리</h1><p>총괄 관리자만 계정을 초대·중지·복구할 수 있습니다. 계정 변경 시 해당 관리자의 로그인이 해제됩니다.</p>
  <p role="status">{message}</p>{link&&<section><h2>일회용 비밀번호 설정 링크</h2><p>30분간 유효합니다. 대상 관리자에게만 직접 전달해주세요. 다시 필요하면 복구 링크를 발급하세요.</p><input style={{width:'100%',color:'#111'}} aria-label="관리자 설정 링크" readOnly value={link}/><button onClick={()=>setLink('')}>링크 숨기기</button></section>}
  <form onSubmit={create}><h2>관리자 초대</h2><fieldset disabled={busy} style={{display:'grid',gap:12}}><label>아이디<input style={{color:'#111'}} name="username" required pattern="[a-zA-Z0-9_]{3,40}" maxLength={40} autoComplete="off"/></label><label>이름<input style={{color:'#111'}} name="name" required maxLength={50}/></label><label>역할<select name="role" style={{color:'#111'}} defaultValue="OPERATOR"><option value="OPERATOR">운영 관리자</option><option value="OWNER">총괄 관리자</option></select></label><button>초대 링크 발급</button></fieldset></form>
  <button disabled={busy} onClick={()=>void load().catch(e=>setMessage(e.message))}>새로고침</button>
  {accounts.map(a=><article key={a.id} style={{padding:16,borderBottom:'1px solid #64748b'}}><h2>{a.name} ({a.username})</h2><p>{a.role==='OWNER'?'총괄':'운영'} · {a.disabled_at?'중지':a.invited?'초대 대기':'활성'}</p><button disabled={busy} onClick={()=>{if(window.confirm(`${a.name} 계정을 ${a.disabled_at?'활성화':'중지'}할까요?`))void command({action:'UPDATE',id:a.id,role:a.role,disabled:!a.disabled_at,expectedVersion:a.version})}}>{a.disabled_at?'활성화':'중지'}</button><button disabled={busy} onClick={()=>{if(window.confirm(`${a.name}의 관리자 역할을 변경할까요?`))void command({action:'UPDATE',id:a.id,role:a.role==='OWNER'?'OPERATOR':'OWNER',disabled:!!a.disabled_at,expectedVersion:a.version})}}>역할 변경</button><button disabled={busy||!!a.disabled_at} onClick={()=>{if(window.confirm(`${a.name}의 복구 링크를 새로 발급하고 기존 로그인을 해제할까요?`))void command({action:'RESET',id:a.id,expectedVersion:a.version})}}>비밀번호 설정·복구 링크</button></article>)}
 </main>
}
