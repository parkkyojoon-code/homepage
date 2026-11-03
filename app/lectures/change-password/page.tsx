'use client'
import { useState } from 'react'
import Link from 'next/link'
export default function ChangePassword(){
 const [busy,setBusy]=useState(false),[done,setDone]=useState(false),[message,setMessage]=useState('')
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return
  const f=new FormData(e.currentTarget),password=String(f.get('password')||'')
  if(password!==f.get('confirm')){setMessage('새 비밀번호가 일치하지 않습니다.');return}
  setBusy(true);setMessage('')
  try{const r=await fetch('/api/lectures/auth/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});const d=await r.json();if(!r.ok)throw new Error(d.error);setDone(true);setMessage('비밀번호를 변경했습니다. 새 비밀번호로 다시 로그인해주세요.')}
  catch(e){setMessage(e instanceof Error?e.message:'변경하지 못했습니다. 결과를 확인할 수 없다면 새 비밀번호로 로그인을 시도해주세요.')}finally{setBusy(false)}
 }
 return <main style={{maxWidth:500,margin:'auto',padding:32}}><h1>새 비밀번호 설정</h1><p>임시 비밀번호로 접속했습니다. 새 비밀번호 설정 후 강의와 주문을 이용할 수 있습니다.</p>{!done&&<form onSubmit={submit}><fieldset disabled={busy} style={{display:'grid',gap:16}}><label>새 비밀번호 (10자 이상)<input style={{display:'block',color:'#111'}} name="password" type="password" minLength={10} maxLength={128} autoComplete="new-password" required/></label><label>새 비밀번호 확인<input style={{display:'block',color:'#111'}} name="confirm" type="password" minLength={10} maxLength={128} autoComplete="new-password" required/></label><button>변경하기</button></fieldset></form>}<p role="status">{message}</p><Link href="/lectures/login">로그인으로 이동</Link></main>
}
