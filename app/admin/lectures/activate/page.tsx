'use client'
import { useEffect,useState } from 'react'
import Link from 'next/link'
export default function ActivateAdmin(){
 const [token,setToken]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[message,setMessage]=useState('')
 useEffect(()=>{const value=window.location.hash.slice(1);if(value){setToken(value);window.history.replaceState(null,'',window.location.pathname)}},[])
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return
  const f=new FormData(e.currentTarget),password=String(f.get('password')||'')
  if(password!==f.get('confirm')){setMessage('비밀번호가 일치하지 않습니다.');return}
  setBusy(true);setMessage('')
  try{const r=await fetch('/api/lectures/admin/activate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password})});const d=await r.json();if(!r.ok)throw new Error(d.error);setToken('');setDone(true);setMessage('설정했습니다. 새 비밀번호로 로그인해주세요.')}
  catch(e){setMessage(e instanceof Error?e.message:'설정하지 못했습니다.')}finally{setBusy(false)}
 }
 return <main style={{maxWidth:500,margin:'auto',padding:32}}><h1>관리자 비밀번호 설정</h1><p role="status">{message}</p>{!done&&<form onSubmit={submit}><fieldset disabled={busy||!token} style={{display:'grid',gap:16}}><label>새 비밀번호 (12자 이상)<input style={{display:'block',color:'#111'}} name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label><label>비밀번호 확인<input style={{display:'block',color:'#111'}} name="confirm" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label><button>설정</button></fieldset></form>}{!token&&!done&&<p>총괄 관리자가 발급한 설정 링크로 접속해주세요.</p>}<Link href="/admin/lectures/login">관리자 로그인</Link></main>
}
