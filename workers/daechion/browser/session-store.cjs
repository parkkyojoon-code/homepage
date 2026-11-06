const {hkdfSync,createHmac,createHash,createCipheriv,createDecipheriv,randomBytes}=require('node:crypto')
const {storageState}=require('./provider.cjs')
const unavailable=()=>Error('CONTENT_SESSION_STORAGE_UNCONFIRMED')

function sessionCipher(apiKey,tenant){
  if(typeof apiKey!=='string'||apiKey.length<32||!tenant||tenant.length>120)throw unavailable()
  const aad=Buffer.from('pkjmath-daechion-browser-session-v1\0'+tenant)
  const key=Buffer.from(hkdfSync('sha256',apiKey,'pkjmath-browser-session',aad,32))
  return {
    fingerprint:value=>createHmac('sha256',key).update(value).digest('hex'),
    encrypt(value){
      storageState(value)
      const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv)
      cipher.setAAD(aad)
      const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()])
      return JSON.stringify({v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')})
    },
    decrypt(value){
      try{
        if(typeof value!=='string'||value.length>400000)throw unavailable()
        const parsed=JSON.parse(value)
        if(parsed.v!==1||typeof parsed.iv!=='string'||typeof parsed.tag!=='string'||typeof parsed.data!=='string')throw unavailable()
        const iv=Buffer.from(parsed.iv,'base64'),tag=Buffer.from(parsed.tag,'base64')
        if(iv.length!==12||tag.length!==16)throw unavailable()
        const decipher=createDecipheriv('aes-256-gcm',key,iv)
        decipher.setAAD(aad);decipher.setAuthTag(tag)
        const result=Buffer.concat([decipher.update(Buffer.from(parsed.data,'base64')),decipher.final()]).toString('utf8')
        storageState(result)
        return result
      }catch{throw unavailable()}
    },
  }
}

function browserSessionStore(env,withClient){
  const tenant=env.DAECHION_TENANT_ID?.trim(),seed=env.DAECHION_BROWSER_STORAGE_STATE
  storageState(seed)
  const cipher=sessionCipher(env.DAECHION_API_KEY,tenant),fingerprint=cipher.fingerprint(seed)
  const lockId=createHash('sha256').update(tenant).digest().readInt32BE(0)
  async function run(work,reset=false){
    return withClient(async client=>{
      let locked=false,lost=false,revision
      const controller=new AbortController()
      const disconnect=()=>{lost=true;controller.abort()}
      client.on?.('error',disconnect)
      client.on?.('end',disconnect)
      try{
        locked=(await client.query('SELECT pg_try_advisory_lock(61109,$1) AS locked',[lockId])).rows[0]?.locked===true
        if(!locked)throw Error('CONTENT_SESSION_BUSY')
        let row=(await client.query('SELECT seed_fingerprint,state_ciphertext,revision::text FROM daechion_automation.browser_sessions WHERE tenant_id=$1',[tenant])).rows[0]
        if(!row){
          await client.query(`INSERT INTO daechion_automation.browser_sessions(tenant_id,seed_fingerprint,state_ciphertext)
            VALUES($1,$2,$3) ON CONFLICT(tenant_id) DO NOTHING`,[tenant,fingerprint,cipher.encrypt(seed)])
          row=(await client.query('SELECT seed_fingerprint,state_ciphertext,revision::text FROM daechion_automation.browser_sessions WHERE tenant_id=$1',[tenant])).rows[0]
        }
        if(!row)throw unavailable()
        revision=String(row.revision)
        // A changed seed needs an explicit operator reset. An older worker must
        // never overwrite a newer login during a rolling deployment.
        if(row.seed_fingerprint!==fingerprint){
          if(!reset)throw Error('CONTENT_SESSION_SEED_CHANGED')
          const encryptedSeed=cipher.encrypt(seed)
          const resetRow=(await client.query(`UPDATE daechion_automation.browser_sessions SET seed_fingerprint=$2,state_ciphertext=$3,
            revision=revision+1,updated_at=now() WHERE tenant_id=$1 AND revision=$4 RETURNING revision::text`,
          [tenant,fingerprint,encryptedSeed,revision])).rows[0]
          if(!resetRow)throw unavailable()
          revision=String(resetRow.revision);row.state_ciphertext=encryptedSeed
        }
        const state=cipher.decrypt(row.state_ciphertext)
        const assert=async()=>{
          if(lost)throw unavailable()
          const current=(await client.query('SELECT revision::text,seed_fingerprint FROM daechion_automation.browser_sessions WHERE tenant_id=$1',[tenant])).rows[0]
          if(!current||String(current.revision)!==revision||current.seed_fingerprint!==fingerprint)throw unavailable()
        }
        const result=await work({state,signal:controller.signal,assert,async save(value){
          await assert()
          const updated=(await client.query(`UPDATE daechion_automation.browser_sessions SET state_ciphertext=$2,
            revision=revision+1,updated_at=now() WHERE tenant_id=$1 AND revision=$3 AND seed_fingerprint=$4 RETURNING revision::text`,
          [tenant,cipher.encrypt(value),revision,fingerprint])).rows[0]
          if(!updated)throw unavailable()
          revision=String(updated.revision)
        }})
        await assert()
        return result
      }catch(error){
        if(['CONTENT_SESSION_BUSY','CONTENT_SESSION_SEED_CHANGED'].includes(error?.message))throw error
        if(error?.message==='CONTENT_ACCESS_UNCONFIRMED')throw error
        // Never wrap database parameters, plaintext state or upstream messages.
        throw unavailable()
      }finally{
        let unlockFailed=false
        if(locked&&!lost){try{await client.query('SELECT pg_advisory_unlock(61109,$1)',[lockId])}catch{controller.abort();unlockFailed=true}}
        client.removeListener?.('error',disconnect)
        client.removeListener?.('end',disconnect)
        if(unlockFailed||lost)throw unavailable()
      }
    })
  }
  return {run:work=>run(work),reset:()=>run(async()=>({reset:true}),true)}
}
module.exports={sessionCipher,browserSessionStore}
