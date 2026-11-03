import { cookies } from 'next/headers'
import { database,transaction } from './db'
import { buyerSession,issueBuyerSessionWithinTransaction } from './buyer-auth-domain'
import { newSession, tokenHash } from './security'
import { HttpError } from './http'

const COOKIE = 'lectures_session'
export async function createSession(userId: string, expectedHash: string) {
  const token = newSession()
  const result=await transaction(client=>issueBuyerSessionWithinTransaction(client,userId,expectedHash,tokenHash(token)))
  ;(await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: result.mustChangePassword?1800:604800 })
  return result
}
export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) throw new HttpError(401, '로그인이 필요합니다.')
  const user=await buyerSession(database(),tokenHash(token))
  return {id:user.id,username:user.username,name:user.name,phone:user.phone,credentialVersion:user.credential_version}
}
export async function currentBuyerActor() {
  const token=(await cookies()).get(COOKIE)?.value
  if(!token)throw new HttpError(401,'로그인이 필요합니다.')
  const sessionHash=tokenHash(token)
  const user=await buyerSession(database(),sessionHash,true)
  return {id:user.id,sessionHash}
}
export async function clearSessionCookie(){(await cookies()).delete(COOKIE)}
export async function logout() {
  const token = (await cookies()).get(COOKIE)?.value
  if (token) await database().query('DELETE FROM lecture_sessions WHERE token_hash=$1', [tokenHash(token)])
  await clearSessionCookie()
}
// DB-backed username throttle works across server processes. Unknown accounts share the same behavior.
export async function throttle(username: string) {
  const { rows } = await database().query(`INSERT INTO lecture_auth_attempts(username,started_at,attempts) VALUES($1,now(),1)
    ON CONFLICT(username) DO UPDATE SET attempts=CASE WHEN lecture_auth_attempts.started_at<now()-interval '15 minutes' THEN 1 ELSE lecture_auth_attempts.attempts+1 END,
    started_at=CASE WHEN lecture_auth_attempts.started_at<now()-interval '15 minutes' THEN now() ELSE lecture_auth_attempts.started_at END RETURNING attempts`, [username])
  if (rows[0].attempts > 10) throw new HttpError(429, '잠시 후 다시 시도해주세요.')
}
