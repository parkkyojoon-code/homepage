import type { QueryClient } from './admin-domain'
import { HttpError } from './http'
export type BuyerActor={id:string;sessionHash:string}
export type BuyerSession={id:string;username:string;name:string;phone:string;must_change_password:boolean;credential_version:number}

export async function buyerSession(client:QueryClient,sessionHash:string,allowPasswordChange=false):Promise<BuyerSession>{
  const {rows}=await client.query<BuyerSession>(`SELECT u.id,u.username,u.name,u.phone,u.must_change_password,u.credential_version
    FROM lecture_users u JOIN lecture_sessions s ON s.user_id=u.id
    WHERE s.token_hash=$1 AND s.expires_at>now() AND u.disabled_at IS NULL
    AND s.credential_version=u.credential_version
    AND (NOT u.must_change_password OR u.password_expires_at>now())`,[sessionHash])
  if(!rows[0])throw new HttpError(401,'다시 로그인해주세요. 임시 비밀번호가 만료됐다면 관리자에게 재발급을 요청해주세요.')
  if(rows[0].must_change_password&&!allowPasswordChange)throw new HttpError(403,'임시 비밀번호를 먼저 변경해주세요. /lectures/change-password에서 변경할 수 있습니다.','PASSWORD_CHANGE_REQUIRED')
  return rows[0]
}

// Called within a transaction after verifying the password; rejects a reset that raced with verification.
export async function issueBuyerSessionWithinTransaction(client:QueryClient,userId:string,expectedHash:string,sessionHash:string){
  const {rows}=await client.query(`SELECT id,must_change_password,credential_version,
    (password_expires_at>now()) AS temporary_valid FROM lecture_users
    WHERE id=$1 AND password_hash=$2 AND disabled_at IS NULL FOR UPDATE`,[userId,expectedHash])
  const user=rows[0]
  if(!user||(user.must_change_password&&!user.temporary_valid))throw new HttpError(401,'계정이 변경됐거나 임시 비밀번호가 만료되었습니다. 다시 로그인해주세요.')
  await client.query(`INSERT INTO lecture_sessions(token_hash,user_id,expires_at,credential_version)
    VALUES($1,$2,CASE WHEN $3 THEN (SELECT password_expires_at FROM lecture_users WHERE id=$2)
      ELSE now()+interval '7 days' END,$4)`,[sessionHash,userId,user.must_change_password,user.credential_version])
  return {mustChangePassword:Boolean(user.must_change_password)}
}
