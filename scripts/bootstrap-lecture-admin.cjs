// Run against the intended lecture DB only. No default credentials; never prints the password.
const { resolve } = require('node:path')
require('@next/env').loadEnvConfig(resolve(__dirname,'..'),process.env.NODE_ENV!=='production',{info:()=>{},error:()=>{}})
const { Pool } = require('pg')
const { randomUUID, randomBytes, scryptSync } = require('node:crypto')
async function main() {
  const { LECTURES_DATABASE_URL, LECTURES_BOOTSTRAP_USERNAME, LECTURES_BOOTSTRAP_NAME, LECTURES_BOOTSTRAP_PASSWORD }=process.env
  const username=(LECTURES_BOOTSTRAP_USERNAME||'').trim().toLowerCase()
  if(!LECTURES_DATABASE_URL || !/^[a-z0-9_]{3,40}$/.test(username) || !LECTURES_BOOTSTRAP_NAME?.trim() || LECTURES_BOOTSTRAP_NAME.trim().length>50 || !LECTURES_BOOTSTRAP_PASSWORD || LECTURES_BOOTSTRAP_PASSWORD.length<12 || LECTURES_BOOTSTRAP_PASSWORD.length>128)throw new Error('Set lecture DB, username, name and a 12–128 character bootstrap password.')
  const salt=randomBytes(16).toString('hex')
  const hash=`scrypt:${salt}:${scryptSync(LECTURES_BOOTSTRAP_PASSWORD,salt,64).toString('hex')}`
  const pool=new Pool({connectionString:LECTURES_DATABASE_URL,max:1,connectionTimeoutMillis:10000,statement_timeout:30000})
  const client=await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('LOCK TABLE lecture_admin_users IN EXCLUSIVE MODE')
    if((await client.query('SELECT 1 FROM lecture_admin_users LIMIT 1')).rowCount)throw new Error('Bootstrap refused: an administrator already exists.')
    await client.query("INSERT INTO lecture_admin_users(id,username,name,role,password_hash) VALUES($1,$2,$3,'OWNER',$4)",[randomUUID(),username,LECTURES_BOOTSTRAP_NAME.trim(),hash])
    await client.query('COMMIT');process.stdout.write('Initial lecture OWNER created. Remove bootstrap environment variables.\n')
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release();await pool.end()}
}
main().catch(e=>{process.stderr.write(`Bootstrap failed: ${e.message}\n`);process.exitCode=1})
