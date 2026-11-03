import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { database } from '@/lib/lectures/db'
import { credentials, registration } from '@/lib/lectures/input'
import { hashPassword, verifyPassword } from '@/lib/lectures/security'
import { createSession, logout, throttle, currentBuyerActor, clearSessionCookie } from '@/lib/lectures/auth'
import { changeBuyerPasswordInput, completeBuyerPasswordChange } from '@/lib/lectures/buyer-recovery'
import { failure, HttpError, sameOrigin } from '@/lib/lectures/http'

export const runtime = 'nodejs'
const dummyHash = hashPassword(randomUUID())
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    sameOrigin(request)
    const { action } = await context.params
    if (action === 'logout') { await logout(); return NextResponse.json({ ok: true }) }
    if (action === 'change-password') {
      const actor=await currentBuyerActor()
      const d=changeBuyerPasswordInput.parse(await request.json())
      const result=await completeBuyerPasswordChange(actor,d.password)
      await clearSessionCookie()
      return NextResponse.json(result,{headers:{'Cache-Control':'private, no-store'}})
    }
    if (action !== 'register' && action !== 'login') throw new HttpError(404, '없는 기능입니다.')
    const body = await request.json()
    const input = credentials.parse(body)
    await throttle(input.username)
    let userId: string
    let expectedHash: string
    if (action === 'register') {
      const data = registration.parse(body)
      userId = randomUUID()
      expectedHash = await hashPassword(data.password)
      try {
        await database().query('INSERT INTO lecture_users(id,username,name,phone,password_hash) VALUES($1,$2,$3,$4,$5)', [userId, data.username, data.name, data.phone, expectedHash])
      } catch (error) {
        if ((error as { code?: string }).code === '23505') throw new HttpError(409, '사용 중인 아이디입니다.')
        throw error
      }
    } else {
      const { rows } = await database().query('SELECT id,password_hash,disabled_at FROM lecture_users WHERE username=$1', [input.username])
      const valid = await verifyPassword(input.password, rows[0]?.password_hash ?? await dummyHash)
      if (!valid || !rows[0] || rows[0].disabled_at) throw new HttpError(401, '아이디 또는 비밀번호를 확인해주세요.')
      userId = rows[0].id
      expectedHash = rows[0].password_hash
    }
    const result=await createSession(userId,expectedHash)
    return NextResponse.json({ ok: true,...result },{headers:{'Cache-Control':'private, no-store'}})
  } catch (error) { return failure(error) }
}
