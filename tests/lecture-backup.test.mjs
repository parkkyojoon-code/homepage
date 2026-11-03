import {test} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdtemp,readFile,writeFile,rm,realpath} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,dirname,basename} from 'node:path'
import {fileURLToPath} from 'node:url'
import pg from 'pg'
import backupTools from '../scripts/lecture-backup.cjs'
import migrations from '../scripts/lecture-migrations.cjs'
import {testDatabaseUrl} from './lecture-postgres-fixture.mjs'
const {connectionEnv,backup,restore}=backupTools

test('credentials and TLS stay in child environment; unsupported options fail closed',()=>{
 const url=new URL('postgresql://fake_user@127.0.0.1:55439/lecture_test_backup?sslmode=verify-full&sslrootcert=ca.crt')
 url.password='fake@password'
 const env=connectionEnv(url.toString())
 assert.equal(env.PGPASSWORD,'fake@password');assert.equal(env.PGSSLMODE,'verify-full')
 assert.equal(env.PGSSLROOTCERT,'ca.crt');assert.equal(env.PGDATABASE,'lecture_test_backup')
 assert.throws(()=>connectionEnv('postgresql://fake_user@localhost/lecture_test_backup?options=anything'),/UNSUPPORTED_CONNECTION_OPTION/)
 assert.throws(()=>connectionEnv('https://localhost/anything'),/INVALID_CONNECTION/)
})

test('real PostgreSQL backup restores data and history; occupied targets and modified archives are rejected',{skip:!process.env.LECTURES_TEST_POSTGRES_URL},async()=>{
 const base=new URL(testDatabaseUrl(process.env.LECTURES_TEST_POSTGRES_URL))
 const suffix=randomUUID().replaceAll('-','')
 const sourceName='lecture_test_backup_'+suffix,targetName='lecture_restore_'+suffix
 const control=new pg.Client({connectionString:base.toString()})
 const directory=await mkdtemp(join(tmpdir(),'lecture-backup-test-'))
 const archiveDir=join(directory,'snapshot')
 const urlFor=name=>{const url=new URL(base);url.pathname='/'+name;return url.toString()}
 let source,target
 const created=[]
 await control.connect()
 try{
  for(const name of [sourceName,targetName]){await control.query('CREATE DATABASE "'+name+'"');created.push(name)}
  source=new pg.Client({connectionString:urlFor(sourceName)});await source.connect()
  const files=migrations.loadMigrations(fileURLToPath(new URL('../db/lectures',import.meta.url)))
  await migrations.migrate(source,files)
  await source.query("INSERT INTO lecture_users(id,username,name,phone,password_hash) VALUES($1,'backup_buyer','가상 복원 구매자','01000000000','fake-hash')",[randomUUID()])
  const options={connectionString:urlFor(sourceName),database:sourceName,directory:archiveDir}
  await assert.rejects(backup({...options,database:'wrong_database'}),/DATABASE_NAME_MISMATCH/)
  assert.equal((await backup(options)).archiveChecked,true)
  await assert.rejects(backup(options),/EEXIST/)
  await assert.rejects(restore(options),/RESTORE_TARGET_REJECTED/)
  const targetOptions={connectionString:urlFor(targetName),database:targetName,directory:archiveDir}
  assert.equal((await restore(targetOptions)).countsMatched,true)
  target=new pg.Client({connectionString:urlFor(targetName)});await target.connect()
  assert.equal((await target.query("SELECT name FROM lecture_users WHERE username='backup_buyer'")).rows[0].name,'가상 복원 구매자')
  assert.deepEqual((await migrations.migrationStatus(target,files)).pending,[])
  await assert.rejects(restore(targetOptions),/RESTORE_TARGET_NOT_EMPTY/)
  const file=join(archiveDir,'database.dump'),bytes=await readFile(file)
  await writeFile(file,Buffer.concat([bytes,Buffer.from('tampered')]))
  await assert.rejects(restore(targetOptions),/ARCHIVE_MISMATCH/)
  assert.equal((await source.query('SELECT count(*)::int AS n FROM lecture_users')).rows[0].n,1)
 }finally{
  if(source)await source.end();if(target)await target.end()
  for(const name of created){if(!/^lecture_(test_backup|restore)_[a-f0-9]{32}$/.test(name))throw new Error('Unexpected test DB cleanup target');await control.query('DROP DATABASE "'+name+'"')}
  await control.end()
  const actual=await realpath(directory)
  if(dirname(actual)!==await realpath(tmpdir())||!basename(actual).startsWith('lecture-backup-test-'))throw new Error('Unexpected file cleanup target')
  await rm(actual,{recursive:true,force:true})
 }
})
