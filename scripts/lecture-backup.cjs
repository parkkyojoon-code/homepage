const {spawn}=require('node:child_process')
const {mkdir,readFile,writeFile,stat}=require('node:fs/promises')
const {createReadStream}=require('node:fs')
const {createHash}=require('node:crypto')
const {resolve,join}=require('node:path')
const {Pool}=require('pg')
const {loadEnvConfig}=require('@next/env')
const {loadMigrations,migrationStatus,checkSchema}=require('./lecture-migrations.cjs')
const root=resolve(__dirname,'..')
const fail=code=>{throw new Error(code)}
const quote=name=>'"'+name.replaceAll('"','""')+'"'

function connectionEnv(value){
 let url
 try{url=new URL(value)}catch{fail('INVALID_CONNECTION')}
 if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||url.hash)fail('INVALID_CONNECTION')
 // Pass credentials through the child environment, never command arguments or logs.
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('PG')))
 const params={sslmode:'PGSSLMODE',sslrootcert:'PGSSLROOTCERT',sslcert:'PGSSLCERT',sslkey:'PGSSLKEY'}
 for(const [key,value] of url.searchParams){if(!params[key])fail('UNSUPPORTED_CONNECTION_OPTION');env[params[key]]=value}
 env.PGHOST=url.hostname.replace(/^\[|\]$/g,'');env.PGPORT=url.port||'5432'
 env.PGUSER=decodeURIComponent(url.username);env.PGPASSWORD=decodeURIComponent(url.password)
 env.PGDATABASE=decodeURIComponent(url.pathname.slice(1));env.PGCONNECT_TIMEOUT='10'
 if(!env.PGUSER||!env.PGDATABASE)fail('INVALID_CONNECTION')
 return env
}
async function tool(name,args,env){
 const executable=process.env.LECTURES_PG_BIN?join(process.env.LECTURES_PG_BIN,name):name
 return new Promise((resolveResult,reject)=>{
  const child=spawn(executable,args,{env,stdio:['ignore','ignore','pipe'],windowsHide:true})
  let warned=false
  // PostgreSQL diagnostics can contain private SQL/data/connection details.
  child.stderr.on('data',()=>{warned=true})
  child.on('error',()=>reject(new Error('PG_TOOL_FAILED')))
  child.on('close',code=>code===0&&!warned?resolveResult():reject(new Error('PG_TOOL_FAILED')))
 })
}
async function checksum(file){
 const hash=createHash('sha256')
 for await(const chunk of createReadStream(file))hash.update(chunk)
 return hash.digest('hex')
}
async function inventory(client){
 const tables=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows
 const counts={}
 for(const {tablename} of tables)counts[tablename]=(await client.query('SELECT count(*)::text AS n FROM public.'+quote(tablename))).rows[0].n
 return counts
}
async function assertReady(client){
 const status=await migrationStatus(client,loadMigrations(join(root,'db','lectures')))
 if(!status.tracked||status.pending.length)fail('SCHEMA_NOT_READY')
 await checkSchema(client)
}
async function backup({connectionString,database,directory}){
 const env=connectionEnv(connectionString)
 const pool=new Pool({connectionString,max:1,connectionTimeoutMillis:10000})
 pool.on('error',()=>{})
 let client
 try{
  client=await pool.connect()
  const actual=(await client.query('SELECT current_database() AS name')).rows[0].name
  if(actual!==database)fail('DATABASE_NAME_MISMATCH')
  await assertReady(client)
  // An exclusive directory prevents overwriting an earlier backup, even on retry.
  await mkdir(directory,{mode:0o700})
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  const snapshot=(await client.query('SELECT pg_export_snapshot() AS id')).rows[0].id
  const counts=await inventory(client)
  const archive=join(directory,'database.dump')
  await tool('pg_dump',['--no-password','--format=custom','--no-owner','--no-acl','--snapshot='+snapshot,'--file='+archive],env)
  await client.query('COMMIT')
  await tool('pg_restore',['--list',archive],env)
  const manifest={format:1,createdAt:new Date().toISOString(),database,sha256:await checksum(archive),bytes:(await stat(archive)).size,counts}
  await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600})
  return {ok:true,action:'backup',tables:Object.keys(counts).length,archiveChecked:true}
 }finally{
  if(client){await client.query('ROLLBACK').catch(()=>{});client.release()}
  await pool.end()
 }
}
async function restore({connectionString,database,directory}){
 const env=connectionEnv(connectionString)
 const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'))
 const archive=join(directory,'database.dump')
 if(manifest.format!==1||!manifest.counts||manifest.sha256!==await checksum(archive)||(await stat(archive)).size!==manifest.bytes)fail('ARCHIVE_MISMATCH')
 // Restore is intentionally limited to a named rehearsal database, never in-place.
 if(!/^lecture_restore_[a-z0-9_]+$/.test(database)||database===manifest.database)fail('RESTORE_TARGET_REJECTED')
 const pool=new Pool({connectionString,max:1,connectionTimeoutMillis:10000})
 pool.on('error',()=>{})
 let client
 try{
  client=await pool.connect()
  if((await client.query('SELECT current_database() AS name')).rows[0].name!==database)fail('DATABASE_NAME_MISMATCH')
  const objects=await client.query("SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_toast' UNION ALL SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') UNION ALL SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_toast' LIMIT 1")
  if(objects.rowCount)fail('RESTORE_TARGET_NOT_EMPTY')
  await tool('pg_restore',['--no-password','--dbname='+database,'--single-transaction','--exit-on-error','--no-owner','--no-acl',archive],env)
  await assertReady(client)
  const counts=await inventory(client)
  if(JSON.stringify(counts)!==JSON.stringify(manifest.counts))fail('RESTORE_COUNTS_MISMATCH')
  return {ok:true,action:'restore-rehearsal',tables:Object.keys(counts).length,schemaChecked:true,countsMatched:true}
 }finally{if(client)client.release();await pool.end()}
}
async function main(){
 loadEnvConfig(root,process.env.NODE_ENV!=='production',{info:()=>{},error:()=>{}})
 const [action,...args]=process.argv.slice(2)
 if(!['backup','restore-rehearsal'].includes(action)||args.length!==4||args[0]!=='--database'||args[2]!=='--directory')fail('INVALID_COMMAND')
 const connectionString=process.env[action==='backup'?'LECTURES_DATABASE_URL':'LECTURES_RESTORE_DATABASE_URL']
 if(!connectionString)fail('MISSING_CONNECTION')
 const options={connectionString,database:args[1],directory:resolve(args[3])}
 const result=await (action==='backup'?backup(options):restore(options))
 process.stdout.write(JSON.stringify(result)+'\n')
}
if(require.main===module)main().catch(error=>{
 const allowed=['INVALID_CONNECTION','UNSUPPORTED_CONNECTION_OPTION','DATABASE_NAME_MISMATCH','SCHEMA_NOT_READY','ARCHIVE_MISMATCH','RESTORE_TARGET_REJECTED','RESTORE_TARGET_NOT_EMPTY','RESTORE_COUNTS_MISMATCH','PG_TOOL_FAILED','INVALID_COMMAND','MISSING_CONNECTION']
 process.stderr.write((allowed.includes(error.message)?error.message:'BACKUP_OPERATION_FAILED')+': operation stopped; private diagnostics omitted. See docs/lecture-backup.md.\n')
 process.exitCode=1
})
module.exports={connectionEnv,backup,restore}
