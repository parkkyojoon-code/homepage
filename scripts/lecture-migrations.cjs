const { readdirSync, readFileSync } = require('node:fs')
const { join } = require('node:path')
const { createHash } = require('node:crypto')

function loadMigrations(directory) {
  const migrations = readdirSync(directory).filter(name => /^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort().map(name => {
    // Stable across Windows checkout CRLF and Linux GitHub/Railway checkout LF.
    const source = readFileSync(join(directory,name),'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n')
    const sql = source.replace(/^\s*(?:--[^\n]*\n\s*)*BEGIN\s*;/i,'').replace(/COMMIT\s*;\s*$/i,'')
    if(sql===source || !/^\s*(?:--[^\n]*\n\s*)*BEGIN\s*;/i.test(source) || !/COMMIT\s*;\s*$/i.test(source)) throw new Error('MIGRATION_TRANSACTION_WRAPPER')
    return {name,checksum:createHash('sha256').update(source).digest('hex'),sql}
  })
  if(!migrations.length || new Set(migrations.map(m=>m.name.slice(0,3))).size!==migrations.length) throw new Error('MIGRATION_NUMBER_CONFLICT')
  return migrations
}
async function migrationStatus(client,migrations) {
  const exists=(await client.query("SELECT to_regclass('public.lecture_schema_migrations') IS NOT NULL AS present")).rows[0].present
  const applied=exists?(await client.query('SELECT name,checksum FROM public.lecture_schema_migrations ORDER BY name')).rows:[]
  for(let i=0;i<applied.length;i++) {
    if(!migrations[i] || applied[i].name!==migrations[i].name || applied[i].checksum!==migrations[i].checksum)throw new Error('MIGRATION_HISTORY_MISMATCH')
  }
  return {tracked:exists,applied:applied.map(m=>m.name),pending:migrations.slice(applied.length).map(m=>m.name)}
}
// The production CLI holds a session advisory lock around this entire function.
async function migrate(client,migrations) {
  const status=await migrationStatus(client,migrations)
  if(!status.tracked) {
    const {rows}=await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")
    if(rows.length)throw new Error('UNTRACKED_DATABASE_NOT_EMPTY')
    await client.query(`CREATE TABLE public.lecture_schema_migrations(
      name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())`)
  }
  const completed=[]
  for(const entry of migrations.filter(m=>status.pending.includes(m.name))) {
    await client.query('BEGIN')
    try {
      await client.query(entry.sql)
      await client.query('INSERT INTO public.lecture_schema_migrations(name,checksum) VALUES($1,$2)',[entry.name,entry.checksum])
      await client.query('COMMIT');completed.push(entry.name)
    } catch(e) {await client.query('ROLLBACK');throw e}
  }
  return completed
}
async function checkSchema(client) {
  // Validate the current application's required columns without reading member or order data.
  for(const sql of [
    'SELECT id,username,password_hash,disabled_at,credential_version,must_change_password,password_expires_at FROM public.lecture_users LIMIT 0',
    'SELECT token_hash,user_id,expires_at,credential_version FROM public.lecture_sessions LIMIT 0',
    'SELECT id,title,price_won,sale_status,video_url,version FROM public.lectures LIMIT 0',
    'SELECT id,user_id,request_key,status,total_won,access_control,version,request_hash,recipient_type,recipient_name,recipient_phone FROM public.lecture_orders LIMIT 0',
    'SELECT id,order_id,lecture_id,title_snapshot,price_won FROM public.lecture_order_items LIMIT 0',
    'SELECT id,user_id,lecture_id,order_item_id,revoked_at FROM public.lecture_entitlements LIMIT 0',
    'SELECT id,username,name,role,password_hash,disabled_at,version FROM public.lecture_admin_users LIMIT 0',
    'SELECT token_hash,admin_id,expires_at FROM public.lecture_admin_sessions LIMIT 0',
    'SELECT token_hash,admin_id,purpose,issued_by,expires_at,used_at FROM public.lecture_admin_tokens LIMIT 0',
    'SELECT admin_id,order_id,request_key,request_hash,before_state,after_state FROM public.lecture_admin_actions LIMIT 0',
    'SELECT order_id,bill_id,amount_won,state,sent_at,due_at,lease_hash,lease_kind,lease_until,lease_version,checked_order_version,checked_event_id,refresh_sequence,lease_refresh_sequence FROM public.lecture_billing_requests LIMIT 0',
    'SELECT order_id,admin_id,sequence,request_key,completed_at,result_event_id FROM public.lecture_billing_refreshes LIMIT 0',
    'SELECT order_id,claim_hash,kind,fingerprint,result,applied FROM public.lecture_billing_events LIMIT 0',
    'SELECT user_id,admin_id,credential_version,request_key,expires_at,completed_at FROM public.lecture_account_recoveries LIMIT 0',
    'SELECT lecture_id,admin_id,version,before_state,after_state FROM public.lecture_catalog_changes LIMIT 0',
    'SELECT actor_id,target_id,action,detail FROM public.lecture_admin_account_events LIMIT 0',
  ])await client.query(sql)
}
module.exports={loadMigrations,migrationStatus,migrate,checkSchema}
