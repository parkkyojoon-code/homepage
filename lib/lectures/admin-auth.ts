import { cookies } from 'next/headers'
import { database, transaction } from './db'
import { hashPassword, newSession, tokenHash, verifyPassword } from './security'
import { HttpError } from './http'
import type { AdminActor, AdminIdentity } from './admin-domain'

const COOKIE = 'lectures_admin_session'
const dummyHash = hashPassword('dummy-admin-login-password')

export async function currentAdmin(): Promise<AdminIdentity & AdminActor> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) throw new HttpError(401, '새 강의 관리자 로그인이 필요합니다.')
  const sessionHash = tokenHash(token)
  const { rows } = await database().query<AdminIdentity>(`SELECT a.id,a.username,a.name,a.role
    FROM lecture_admin_users a JOIN lecture_admin_sessions s ON s.admin_id=a.id
    WHERE s.token_hash=$1 AND s.expires_at>now() AND a.disabled_at IS NULL`, [sessionHash])
  if (!rows[0]) throw new HttpError(401, '관리자 로그인이 만료되었습니다.')
  return { ...rows[0], sessionHash }
}

export async function loginAdmin(username: string, password: string) {
  const { rows: attempts } = await database().query(`INSERT INTO lecture_admin_auth_attempts(username,started_at,attempts)
    VALUES($1,now(),1) ON CONFLICT(username) DO UPDATE SET
    attempts=CASE WHEN lecture_admin_auth_attempts.started_at<now()-interval '15 minutes' THEN 1 ELSE lecture_admin_auth_attempts.attempts+1 END,
    started_at=CASE WHEN lecture_admin_auth_attempts.started_at<now()-interval '15 minutes' THEN now() ELSE lecture_admin_auth_attempts.started_at END
    RETURNING attempts`,[username])
  if (attempts[0].attempts>10) throw new HttpError(429,'로그인 시도가 많습니다. 15분 후 다시 시도해주세요.')
  const { rows } = await database().query('SELECT id,password_hash,disabled_at FROM lecture_admin_users WHERE username=$1',[username])
  const saved = rows[0]
  const valid = await verifyPassword(password,saved?.password_hash ?? await dummyHash)
  if (!saved || !valid || saved.disabled_at) throw new HttpError(401,'아이디 또는 비밀번호를 확인해주세요.')
  const token = newSession()
  await transaction(async client => {
    const checked = await client.query('SELECT id FROM lecture_admin_users WHERE id=$1 AND password_hash=$2 AND disabled_at IS NULL FOR SHARE',[saved.id,saved.password_hash])
    if (!checked.rows[0]) throw new HttpError(401,'계정이 변경되었습니다. 다시 로그인해주세요.')
    await client.query("INSERT INTO lecture_admin_sessions(token_hash,admin_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",[tokenHash(token),saved.id])
  })
  ;(await cookies()).set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:28800})
}

export async function logoutAdmin() {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  if (token) await database().query('DELETE FROM lecture_admin_sessions WHERE token_hash=$1',[tokenHash(token)])
  store.delete(COOKIE)
}
