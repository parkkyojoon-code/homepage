import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,writeFileSync,rmSync,realpathSync} from 'node:fs'
import {join,dirname,basename} from 'node:path'
import {tmpdir} from 'node:os'
import {fileURLToPath} from 'node:url'
import {PGlite} from '@electric-sql/pglite'
import migrations from '../scripts/lecture-migrations.cjs'
const {loadMigrations,migrationStatus,migrate,checkSchema}=migrations
const files=loadMigrations(fileURLToPath(new URL('../db/lectures',import.meta.url)))
async function scenario(run){
 const db=new PGlite()
 const client={query:async(sql,params)=>!params&&/;\s*\S/.test(sql)?(await db.exec(sql),{rows:[]}):db.query(sql,params)}
 try{await run(db,client)}finally{await db.close()}
}
test('empty database status is read-only; migrations apply once and account schema is ready',()=>scenario(async(db,client)=>{
 const before=await migrationStatus(client,files)
 assert.equal(before.tracked,false);assert.equal(before.pending.length,files.length)
 assert.equal((await db.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'")).rows[0].n,0)
 assert.deepEqual(await migrate(client,files),files.map(f=>f.name))
 assert.deepEqual(await migrate(client,files),[])
 assert.deepEqual((await migrationStatus(client,files)).pending,[])
 await db.query('SELECT access_control,version FROM lecture_orders LIMIT 0')
 await db.query('SELECT version FROM lecture_admin_users LIMIT 0')
 await checkSchema(client)
 await db.query('ALTER TABLE lecture_orders DROP COLUMN access_control')
 await assert.rejects(checkSchema(client))
}))
test('manually initialized database is not silently adopted or overwritten',()=>scenario(async(db,client)=>{
 await db.exec('CREATE TABLE existing_students(id integer PRIMARY KEY);INSERT INTO existing_students VALUES(7)')
 await assert.rejects(migrate(client,files),/UNTRACKED_DATABASE_NOT_EMPTY/)
 assert.equal((await db.query('SELECT id FROM existing_students')).rows[0].id,7)
 assert.equal((await migrationStatus(client,files)).tracked,false)
}))
test('migration errors roll back both DDL and history; checksum/gap mismatches stop application',()=>scenario(async(db,client)=>{
 await migrate(client,files)
 const broken={name:'032_broken.sql',checksum:'fake-checksum',sql:'CREATE TABLE should_rollback(id integer); SELECT missing_column FROM missing_table;'}
 await assert.rejects(migrate(client,[...files,broken]))
 assert.equal((await db.query("SELECT to_regclass('public.should_rollback') AS name")).rows[0].name,null)
 assert.equal((await migrationStatus(client,files)).applied.length,files.length)
 await assert.rejects(migrationStatus(client,[{...files[0],checksum:'changed'},...files.slice(1)]),/MIGRATION_HISTORY_MISMATCH/)
 await assert.rejects(migrationStatus(client,files.filter((_,i)=>i!==1)),/MIGRATION_HISTORY_MISMATCH/)
}))
test('Windows and Linux SQL line endings yield the same checksum',()=>{
 const directory=mkdtempSync(join(tmpdir(),'lecture-migration-'))
 try{
  const source=readFileSync(fileURLToPath(new URL('../db/lectures/001_initial.sql',import.meta.url)),'utf8').replace(/\r\n/g,'\n')
  writeFileSync(join(directory,'001_initial.sql'),source)
  const lf=loadMigrations(directory)[0].checksum
  writeFileSync(join(directory,'001_initial.sql'),source.replace(/\n/g,'\r\n'))
  assert.equal(loadMigrations(directory)[0].checksum,lf)
 }finally{const target=realpathSync(directory);if(dirname(target)!==realpathSync(tmpdir())||!basename(target).startsWith('lecture-migration-'))throw new Error('Unexpected cleanup path');rmSync(target,{recursive:true,force:true})}
})
