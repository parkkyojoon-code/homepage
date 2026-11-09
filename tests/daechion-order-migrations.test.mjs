import {test} from 'node:test'
import assert from 'node:assert/strict'
import {PGlite} from '@electric-sql/pglite'
import pg from 'pg'
import migrations from '../scripts/daechion-order-migrations.cjs'
import command from '../scripts/daechion-order-db.cjs'

async function database(){
  if(!process.env.DAECHION_TEST_POSTGRES_URL){
    const db=new PGlite()
    // node-postgres supports unparameterised multi-statement DDL; PGlite needs exec.
    return {query:async(sql,values)=>values?db.query(sql,values):(await db.exec(sql)).at(-1),exec:sql=>db.exec(sql),close:()=>db.close()}
  }
  const url=new URL(process.env.DAECHION_TEST_POSTGRES_URL)
  if(!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!=='/daechion_ci'||url.username!=='daechion_ci')throw Error('ISOLATED_ORDER_TEST_DATABASE_REQUIRED')
  const client=new pg.Client({connectionString:url.toString()});await client.connect()
  return {query:(sql,values)=>client.query(sql,values),exec:sql=>client.query(sql),close:()=>client.end()}
}
test('isolated order migration operations fail closed and preserve the existing schema',async t=>{
  const db=await database()
  const reset=()=>db.exec('DROP SCHEMA IF EXISTS daechion_orders CASCADE')
  try{
    await reset()
    // The CLI must never adopt or modify an existing untracked namespace.
    await t.test('status and check are read-only and check refuses an absent schema',async()=>{
      const expected=migrations.loadMigrations().map(m=>m.name)
      assert.deepEqual(await command.run(db,[]),{reachable:true,schema:'daechion_orders',tracked:false,pending:expected})
      await assert.rejects(command.run(db,['check']),/ORDER_SCHEMA_NOT_READY/)
      assert.equal((await db.query("SELECT to_regnamespace('daechion_orders') AS namespace")).rows[0].namespace,null)
      for(const args of [['drop'],['status','extra'],['migrate'],['migrate','--database',''],['check','--database','x']])assert.throws(()=>command.parseCommand(args),/ORDER_INVALID_DB_COMMAND/)
      await assert.rejects(command.run(db,['migrate','--database','definitely_wrong_database']),/ORDER_DATABASE_NAME_MISMATCH/)
    })
    await t.test('untracked objects are rejected without dropping or adopting them',async()=>{
      await db.exec('CREATE SCHEMA daechion_orders; CREATE TABLE daechion_orders.keep_me(value integer); INSERT INTO daechion_orders.keep_me VALUES(42)')
      await assert.rejects(migrations.migrate(db),/ORDER_UNTRACKED_SCHEMA/)
      assert.equal((await db.query('SELECT value FROM daechion_orders.keep_me')).rows[0].value,42)
      await reset()
    })
    await t.test('failure after initial DDL rolls back the entire batch including migration history',async()=>{
      const list=migrations.loadMigrations()
      list[1]={...list[1],body:list[1].body+'\nSELECT nonexistent_order_migration_function();'}
      await assert.rejects(migrations.migrate(db,list),/nonexistent_order_migration_function/)
      assert.equal((await migrations.status(db)).tracked,false)
    })
    await t.test('a tracked older version upgrades only pending files; incomplete histories are rejected',async()=>{
      const first=migrations.loadMigrations()[0]
      await db.exec(first.body)
      await db.exec('CREATE TABLE daechion_orders.schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())')
      await assert.rejects(migrations.status(db),/ORDER_MIGRATION_HISTORY_MISMATCH/)
      await db.query('INSERT INTO daechion_orders.schema_migrations(name,checksum) VALUES($1,$2)',[first.name,first.checksum])
      await assert.rejects(migrations.checkReady(db),/ORDER_SCHEMA_NOT_READY/)
      assert.deepEqual(await migrations.migrate(db),['002_workers.sql','003_delivery.sql','004_admin.sql','005_manual_review.sql','006_recovery.sql','007_manual_access.sql','008_identity_recovery.sql','009_intake_review.sql','010_scheduler.sql'])
      await migrations.checkReady(db)
      await db.query('DELETE FROM daechion_orders.schema_migrations WHERE name=$1',[first.name])
      await assert.rejects(migrations.status(db),/ORDER_MIGRATION_HISTORY_MISMATCH/)
      await reset()
    })
    await t.test('all migrations apply once and leave legacy schema and records unchanged',async()=>{
      // Separate probe schema avoids touching the legacy suites in the same CI database.
      await db.exec('CREATE SCHEMA IF NOT EXISTS order_migration_probe; CREATE TABLE order_migration_probe.keep_me(value integer); INSERT INTO order_migration_probe.keep_me VALUES(73)')
      const legacyBefore=(await db.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='daechion_automation' ORDER BY table_name,ordinal_position")).rows
      assert.deepEqual(await migrations.migrate(db),migrations.loadMigrations().map(m=>m.name))
      assert.deepEqual(await migrations.migrate(db),[])
      assert.deepEqual(await command.run(db,['check']),{reachable:true,schema:'daechion_orders',tracked:true,pending:[],schemaChecked:true})
      assert.equal((await db.query('SELECT value FROM order_migration_probe.keep_me')).rows[0].value,73)
      assert.deepEqual((await db.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='daechion_automation' ORDER BY table_name,ordinal_position")).rows,legacyBefore)
      const hash=(await db.query('SELECT checksum FROM daechion_orders.schema_migrations WHERE name=$1',['001_initial.sql'])).rows[0].checksum
      await db.query("UPDATE daechion_orders.schema_migrations SET checksum=$1 WHERE name=$2",['0'.repeat(64),'001_initial.sql'])
      await assert.rejects(migrations.migrate(db),/ORDER_MIGRATION_HISTORY_MISMATCH/)
      await db.query('UPDATE daechion_orders.schema_migrations SET checksum=$1 WHERE name=$2',[hash,'001_initial.sql'])
    })
    await t.test('out-of-order and future histories and missing delivery columns block readiness',async()=>{
      const last=migrations.loadMigrations().at(-1)
      await db.query('DELETE FROM daechion_orders.schema_migrations WHERE name=$1',[last.name])
      assert.deepEqual((await migrations.status(db)).pending,[last.name])
      await assert.rejects(migrations.checkReady(db),/ORDER_SCHEMA_NOT_READY/)
      await db.query('INSERT INTO daechion_orders.schema_migrations(name,checksum) VALUES($1,$2)',[last.name,last.checksum])
      await db.query("INSERT INTO daechion_orders.schema_migrations(name,checksum) VALUES('999_future.sql',$1)",['f'.repeat(64)])
      await assert.rejects(migrations.checkReady(db),/ORDER_MIGRATION_HISTORY_MISMATCH/)
      await db.query("DELETE FROM daechion_orders.schema_migrations WHERE name='999_future.sql'")
      await db.exec('ALTER TABLE daechion_orders.grants DISABLE TRIGGER guard_worker_grant')
      await assert.rejects(command.run(db,['check']),/ORDER_SCHEMA_GUARDS_NOT_READY/)
      await db.exec('ALTER TABLE daechion_orders.grants ENABLE TRIGGER guard_worker_grant')
      await migrations.checkReady(db)
      await db.exec('ALTER TABLE daechion_orders.jobs DROP COLUMN last_error')
      await assert.rejects(command.run(db,['check']),/last_error/)
    })
  }finally{
    await reset();await db.exec('DROP SCHEMA IF EXISTS order_migration_probe CASCADE');await db.close()
  }
})
