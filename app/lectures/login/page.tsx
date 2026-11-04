'use client'
import { useState } from 'react'
import Link from 'next/link'
export default function LectureLogin() {
  const [register, setRegister] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage('')
    const body = Object.fromEntries(new FormData(e.currentTarget))
    try {
      const r = await fetch(`/api/lectures/auth/${register ? 'register' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json(); if (!r.ok) throw new Error(d.error)
      location.assign(d.mustChangePassword?'/lectures/change-password':'/lectures')
    } catch (e) { setMessage(e instanceof Error ? e.message : '연결에 실패했습니다.') }
    finally { setBusy(false) }
  }
  return <main className="lecture-page lecture-page--auth">
    <Link href="/lectures">← 강의 목록</Link><h1>{register ? '강의 회원가입' : '강의 로그인'}</h1>
    <form onSubmit={submit} style={{ display: 'grid', gap: 20 }}>
      <label>아이디<input name="username" required minLength={4} maxLength={30} pattern="[A-Za-z0-9_]+" autoComplete="username" /></label>
      <label>비밀번호 (10자 이상)<input name="password" type="password" required minLength={10} maxLength={128} autoComplete={register ? 'new-password' : 'current-password'} /></label>
      {register && <><label>이름<input name="name" required maxLength={50} autoComplete="name" /></label><label>휴대전화<input name="phone" type="tel" required placeholder="01012345678" autoComplete="tel" /></label></>}
      <button type="submit" disabled={busy}>{busy ? '처리 중…' : register ? '가입하기' : '로그인'}</button>
    </form><p>비밀번호를 잊으셨다면 관리자에게 초기화를 요청해주세요. 임시 비밀번호로 로그인하면 새 비밀번호를 설정해야 합니다.</p><p role="alert">{message}</p><button disabled={busy} onClick={() => { setRegister(!register); setMessage('') }}>{register ? '로그인으로 이동' : '새 계정 만들기'}</button>
  </main>
}
