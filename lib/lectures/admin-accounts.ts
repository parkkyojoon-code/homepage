import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { transaction } from './db'
import { HttpError } from './http'
import { lockAdmin, type AdminActor, type QueryClient } from './admin-domain'
import { hashPassword, newSession, tokenHash } from './security'

export const accountCommand=z.discriminatedUnion('action',[
  z.object({action:z.literal('CREATE'),username:z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,40}$/),name:z.string().trim().min(1).max(50),role:z.enum(['OWNER','OPERATOR'])}).strict(),
  z.object({action:z.literal('UPDATE'),id:z.string().uuid(),role:z.enum(['OWNER','OPERATOR']),disabled:z.boolean(),expectedVersion:z.number().int().nonnegative()}).strict(),
  z.object({action:z.literal('RESET'),id:z.string().uuid(),expectedVersion:z.number().int().nonnegative()}).strict(),
])
export async function manageAccount(actor:AdminActor,input:z.infer<typeof accountCommand>){
  return transaction(client=>manageAccountWithinTransaction(client,actor,input))
}
export async function manageAccountWithinTransaction(client:QueryClient,actor:AdminActor,input:z.infer<typeof accountCommand>){
  const d=accountCommand.parse(input)
  // Serialize account changes and activation so two requests cannot remove the last owner.
  await client.query('LOCK TABLE lecture_admin_users IN SHARE ROW EXCLUSIVE MODE')
  const admin=await lockAdmin(client,actor)
  if(admin.role!=='OWNER')throw new HttpError(403,'총괄 관리자만 계정을 관리할 수 있습니다.')
  let target:string,token:string|undefined
  if(d.action==='CREATE'){
    if((await client.query('SELECT id FROM lecture_admin_users WHERE username=$1',[d.username])).rows[0])throw new HttpError(409,'이미 사용 중인 관리자 아이디입니다.')
    target=randomUUID()
    await client.query("INSERT INTO lecture_admin_users(id,username,name,role,password_hash) VALUES($1,$2,$3,$4,'INVITED')",[target,d.username,d.name,d.role])
  }else{
    target=d.id
    const {rows}=await client.query('SELECT id,role,disabled_at,password_hash,version FROM lecture_admin_users WHERE id=$1 FOR UPDATE',[target])
    const saved=rows[0]
    if(!saved)throw new HttpError(404,'관리자를 찾을 수 없습니다.')
    if(saved.version!==d.expectedVersion)throw new HttpError(409,'관리자 계정이 변경되었습니다. 새로고침해주세요.')
    if(d.action==='UPDATE'){
      if(saved.role==='OWNER'&&!saved.disabled_at&&saved.password_hash!=='INVITED'&&(d.role!=='OWNER'||d.disabled)){
        const owners=await client.query("SELECT count(*)::int AS n FROM lecture_admin_users WHERE role='OWNER' AND disabled_at IS NULL AND password_hash<>'INVITED'")
        if(owners.rows[0].n<=1)throw new HttpError(409,'마지막 활성 총괄 관리자는 중지하거나 권한을 낮출 수 없습니다.')
      }
      await client.query('UPDATE lecture_admin_users SET role=$2,disabled_at=CASE WHEN $3 THEN now() ELSE NULL END,version=version+1 WHERE id=$1',[target,d.role,d.disabled])
      await client.query('DELETE FROM lecture_admin_sessions WHERE admin_id=$1',[target])
      await client.query('DELETE FROM lecture_admin_tokens WHERE admin_id=$1',[target])
    }else{
      if(saved.disabled_at)throw new HttpError(409,'중지된 계정은 활성화한 뒤 복구해주세요.')
      await client.query('UPDATE lecture_admin_users SET version=version+1 WHERE id=$1',[target])
      await client.query('DELETE FROM lecture_admin_sessions WHERE admin_id=$1',[target])
    }
  }
  if(d.action!=='UPDATE'){
    token=newSession()
    await client.query('DELETE FROM lecture_admin_tokens WHERE admin_id=$1',[target])
    await client.query("INSERT INTO lecture_admin_tokens(token_hash,admin_id,purpose,issued_by,expires_at) VALUES($1,$2,$3,$4,now()+interval '30 minutes')",[tokenHash(token),target,d.action==='CREATE'?'INVITE':'RESET',actor.id])
  }
  const detail=d.action==='CREATE'?{username:d.username,name:d.name,role:d.role}:d.action==='UPDATE'?{role:d.role,disabled:d.disabled}:{resetIssued:true}
  await client.query('INSERT INTO lecture_admin_account_events(id,actor_id,target_id,action,detail) VALUES($1,$2,$3,$4,$5::jsonb)',[randomUUID(),actor.id,target,d.action,JSON.stringify(detail)])
  return {id:target,...(token?{token,expiresInMinutes:30}:{})}
}
export async function activateAdmin(token:string,password:string){
  if(!/^[a-f0-9]{64}$/.test(token)||password.length<12||password.length>128)throw new HttpError(400,'유효한 링크와 12~128자 비밀번호가 필요합니다.')
  const hash=await hashPassword(password)
  return transaction(client=>activateAdminWithinTransaction(client,token,hash))
}
export async function activateAdminWithinTransaction(client:QueryClient,token:string,passwordHash:string){
  await client.query('LOCK TABLE lecture_admin_users IN SHARE ROW EXCLUSIVE MODE')
  const {rows}=await client.query(`SELECT t.admin_id,t.issued_by FROM lecture_admin_tokens t
    JOIN lecture_admin_users a ON a.id=t.admin_id WHERE t.token_hash=$1 AND t.used_at IS NULL
    AND t.expires_at>now() AND a.disabled_at IS NULL FOR UPDATE OF t,a`,[tokenHash(token)])
  const entry=rows[0]
  if(!entry)throw new HttpError(400,'만료되었거나 이미 사용한 링크입니다. 총괄 관리자에게 재발급을 요청해주세요.')
  await client.query('UPDATE lecture_admin_users SET password_hash=$2,version=version+1 WHERE id=$1',[entry.admin_id,passwordHash])
  await client.query('UPDATE lecture_admin_tokens SET used_at=now() WHERE token_hash=$1',[tokenHash(token)])
  await client.query('DELETE FROM lecture_admin_sessions WHERE admin_id=$1',[entry.admin_id])
  await client.query("INSERT INTO lecture_admin_account_events(id,actor_id,target_id,action,detail) VALUES($1,$2,$2,'ACTIVATE',$3::jsonb)",[randomUUID(),entry.admin_id,JSON.stringify({issuedBy:entry.issued_by})])
  return {ok:true}
}
