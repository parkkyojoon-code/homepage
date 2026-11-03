import { createHash,randomBytes,randomUUID } from 'node:crypto'
import { z } from 'zod'
import { lockAdmin,type AdminActor,type QueryClient } from './admin-domain'
import type { BuyerActor } from './buyer-auth-domain'
import { transaction } from './db'
import { HttpError } from './http'
import { hashPassword,verifyPassword } from './security'

export const resetBuyerInput=z.object({
  expectedCredentialVersion:z.number().int().nonnegative(),requestKey:z.string().uuid(),
  reason:z.string().trim().min(5,'본인 확인 근거를 5자 이상 입력해주세요.').max(500),confirmed:z.literal(true),
}).strict()
export const changeBuyerPasswordInput=z.object({password:z.string().min(10,'새 비밀번호는 10자 이상입니다.').max(128)}).strict()
type Reset=z.infer<typeof resetBuyerInput>
export async function resetBuyerPassword(actor:AdminActor,userId:string,input:Reset){
  const temporaryPassword=randomBytes(18).toString('base64url')
  const hash=await hashPassword(temporaryPassword)
  const result=await transaction(client=>resetBuyerWithinTransaction(client,actor,userId,input,hash))
  return {...result,temporaryPassword:result.alreadyApplied?null:temporaryPassword}
}
export async function resetBuyerWithinTransaction(client:QueryClient,actor:AdminActor,userId:string,input:Reset,passwordHash:string){
  const d=resetBuyerInput.parse(input),admin=await lockAdmin(client,actor)
  const {rows}=await client.query('SELECT id,credential_version,disabled_at FROM lecture_users WHERE id=$1 FOR UPDATE',[userId])
  const user=rows[0]
  if(!user)throw new HttpError(404,'구매자를 찾을 수 없습니다.')
  const fingerprint=createHash('sha256').update(JSON.stringify({userId,...d})).digest('hex')
  const prior=await client.query('SELECT request_hash,expires_at FROM lecture_account_recoveries WHERE admin_id=$1 AND request_key=$2',[actor.id,d.requestKey])
  if(prior.rows[0]){
    if(prior.rows[0].request_hash!==fingerprint)throw new HttpError(409,'같은 요청 키에 다른 초기화가 지정됐습니다.')
    return {alreadyApplied:true,expiresAt:prior.rows[0].expires_at}
  }
  if(user.disabled_at)throw new HttpError(409,'중지된 계정은 초기화할 수 없습니다.')
  if(user.credential_version!==d.expectedCredentialVersion)throw new HttpError(409,'계정이 변경되었습니다. 새로 조회한 뒤 다시 확인해주세요.')
  const updated=await client.query(`UPDATE lecture_users SET password_hash=$2,must_change_password=true,
    password_expires_at=now()+interval '30 minutes',credential_version=credential_version+1
    WHERE id=$1 RETURNING credential_version,password_expires_at`,[userId,passwordHash])
  const saved=updated.rows[0]
  await client.query('DELETE FROM lecture_sessions WHERE user_id=$1',[userId])
  // A legitimate recovery gives the buyer a fresh attempt budget. Replays do not reset it again.
  await client.query('DELETE FROM lecture_auth_attempts WHERE username=(SELECT username FROM lecture_users WHERE id=$1)',[userId])
  await client.query(`INSERT INTO lecture_account_recoveries(id,user_id,admin_id,actor_name,credential_version,reason,request_key,request_hash,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[randomUUID(),userId,actor.id,admin.name,saved.credential_version,d.reason,d.requestKey,fingerprint,saved.password_expires_at])
  return {alreadyApplied:false,expiresAt:saved.password_expires_at}
}
export async function completeBuyerPasswordChange(actor:BuyerActor,password:string){
  changeBuyerPasswordInput.parse({password})
  const hash=await hashPassword(password)
  return transaction(client=>completeBuyerChangeWithinTransaction(client,actor,password,hash))
}
export async function completeBuyerChangeWithinTransaction(client:QueryClient,actor:BuyerActor,password:string,passwordHash:string){
  changeBuyerPasswordInput.parse({password})
  const {rows}=await client.query(`SELECT id,password_hash,credential_version,must_change_password,
    (password_expires_at>now()) AS temporary_valid FROM lecture_users WHERE id=$1 AND disabled_at IS NULL FOR UPDATE`,[actor.id])
  const user=rows[0]
  const session=await client.query('SELECT 1 FROM lecture_sessions WHERE token_hash=$1 AND user_id=$2 AND expires_at>now() AND credential_version=$3',[actor.sessionHash,actor.id,user?.credential_version??-1])
  if(!user||!session.rows[0])throw new HttpError(401,'다시 로그인해주세요.')
  if(!user.must_change_password||!user.temporary_valid)throw new HttpError(409,'변경할 임시 비밀번호가 없거나 만료되었습니다.')
  if(await verifyPassword(password,user.password_hash))throw new HttpError(400,'임시 비밀번호와 다른 새 비밀번호를 설정해주세요.')
  await client.query(`UPDATE lecture_users SET password_hash=$2,must_change_password=false,
    password_expires_at=NULL,credential_version=credential_version+1 WHERE id=$1`,[actor.id,passwordHash])
  await client.query('DELETE FROM lecture_sessions WHERE user_id=$1',[actor.id])
  await client.query('UPDATE lecture_account_recoveries SET completed_at=now() WHERE user_id=$1 AND credential_version=$2 AND completed_at IS NULL',[actor.id,user.credential_version])
  return {ok:true,loginRequired:true}
}
