'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
export default function AdminLogin() {
  const router=useRouter()
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false)
  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if(busy)return
    const data=new FormData(e.currentTarget);setBusy(true);setMessage('')
    try {
      const r=await fetch('/api/lectures/admin/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:data.get('username'),password:data.get('password')})})
      const d=await r.json();if(!r.ok)throw new Error(d.error)
      router.replace('/admin/lectures/orders')
    } catch(e){setMessage(e instanceof Error?e.message:'로그인하지 못했습니다.')}finally{setBusy(false)}
  }
  return <main className="lecture-page lecture-page--auth"><h1>강의 관리자 로그인</h1><p>발급받은 개인 관리자 계정을 사용해주세요.</p><form onSubmit={submit}><fieldset disabled={busy} style={{display:'grid',gap:16}}><label>아이디<input name="username" autoComplete="username" required maxLength={40}/></label><label>비밀번호<input name="password" type="password" autoComplete="current-password" required maxLength={128}/></label><button type="submit">로그인</button></fieldset></form><p role="status">{message}</p><Link href="/lectures">강의 목록</Link></main>
}
