const { resolve,join } = require('node:path')
const { Pool } = require('pg')
const { loadEnvConfig } = require('@next/env')
const { loadMigrations,migrationStatus,migrate,checkSchema } = require('./lecture-migrations.cjs')
const root=resolve(__dirname,'..')
const messages={
 MISSING_DATABASE_URL:'LECTURES_DATABASE_URL is not configured. Set it in .env.local or the server environment.',
 INVALID_DATABASE_URL:'LECTURES_DATABASE_URL must be a PostgreSQL URL.',
 DATABASE_CONFIRMATION_REQUIRED:'For migrations, pass --database followed by the actual target database name.',
 DATABASE_NAME_MISMATCH:'The requested database name does not match the connected database. Nothing was migrated.',
 MIGRATION_HISTORY_MISMATCH:'Migration history differs from these SQL files. Stop and review the target DB and Git version; do not edit applied files.',
 UNTRACKED_DATABASE_NOT_EMPTY:'Untracked database contains tables. Do not rerun SQL blindly. Review the previous manual migration history first.',
 MIGRATION_TRANSACTION_WRAPPER:'Each migration must have a BEGIN/COMMIT wrapper.',
 MIGRATION_NUMBER_CONFLICT:'No migrations found, or migration numbers conflict.',
 SCHEMA_NOT_READY:'Database is reachable but migrations are pending.',
 INVALID_COMMAND:'Use status, check, or migrate --database NAME.',
}
async function main(){
 loadEnvConfig(root,process.env.NODE_ENV!=='production',{info:()=>{},error:()=>{}})
 const [action,...args]=process.argv.slice(2)
 if(!['status','check','migrate'].includes(action)|| (action!=='migrate'&&args.length) || (action==='migrate'&&(args.length!==2||args[0]!=='--database')))throw new Error(action==='migrate'?'DATABASE_CONFIRMATION_REQUIRED':'INVALID_COMMAND')
 const connectionString=process.env.LECTURES_DATABASE_URL
 if(!connectionString)throw new Error('MISSING_DATABASE_URL')
 let parsed
 try{parsed=new URL(connectionString)}catch{throw new Error('INVALID_DATABASE_URL')}
 if(!['postgres:','postgresql:'].includes(parsed.protocol))throw new Error('INVALID_DATABASE_URL')
 const pool=new Pool({connectionString,max:1,connectionTimeoutMillis:10000,statement_timeout:30000,idle_in_transaction_session_timeout:30000})
 pool.on('error',()=>{})
 let client,locked=false
 try{
  client=await pool.connect()
  await client.query('SET search_path TO public')
  await client.query("SET TIME ZONE 'UTC'")
  const database=(await client.query('SELECT current_database() AS name')).rows[0].name
  const migrations=loadMigrations(join(root,'db','lectures'))
  if(action==='migrate'){
   if(args[1]!==database)throw new Error('DATABASE_NAME_MISMATCH')
   locked=(await client.query('SELECT pg_try_advisory_lock(731103,3100) AS acquired')).rows[0].acquired
   if(!locked)throw new Error('MIGRATION_ALREADY_RUNNING')
   const completed=await migrate(client,migrations)
   process.stdout.write(JSON.stringify({ok:true,appliedNow:completed},null,2)+'\n')
  }else{
   const status=await migrationStatus(client,migrations)
   if(action==='check'&&status.pending.length)throw new Error('SCHEMA_NOT_READY')
   if(action==='check')await checkSchema(client)
   process.stdout.write(JSON.stringify({reachable:true,...status,...(action==='check'?{schemaChecked:true}:{})},null,2)+'\n')
  }
 }finally{
  if(client){if(locked)await client.query('SELECT pg_advisory_unlock(731103,3100)').catch(()=>{});client.release()}
  await pool.end()
 }
}
main().catch(e=>{
 const message=messages[e.message]||(e.message==='MIGRATION_ALREADY_RUNNING'?'Another migration is running. Retry after it finishes.':'Database operation failed. Check connection, network, TLS and database permissions. Connection details are not printed.')
 process.stderr.write(message+'\n');process.exitCode=1
})
