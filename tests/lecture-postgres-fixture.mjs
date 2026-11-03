import {randomUUID} from 'node:crypto'
import pg from 'pg'

export function testDatabaseUrl(value){
 const url=new URL(value)
 const database=decodeURIComponent(url.pathname.slice(1))
 if(!['postgres:','postgresql:'].includes(url.protocol)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!(database==='lecture_ci'||/^lecture_test_[a-z0-9_]+$/.test(database)))throw new Error('Use a dedicated loopback lecture_test_* or lecture_ci database only.')
 return value
}
export async function postgresFixture(value){
 const connectionString=testDatabaseUrl(value),schema='lecture_test_'+randomUUID().replaceAll('-','')
 const settings={connectionString,connectionTimeoutMillis:5000,statement_timeout:15000,lock_timeout:10000}
 const client=new pg.Client(settings)
 await client.connect()
 try{await client.query(`CREATE SCHEMA "${schema}"`);await client.query(`SET search_path TO "${schema}"`);await client.query("SET TIME ZONE 'UTC'")}
 catch(e){await client.end();throw e}
 return {
  query:async(sql,params)=>{const r=await client.query(sql,params);return {rows:r.rows,affectedRows:r.rowCount}},
  exec:async sql=>{await client.query(sql)},
  connect:async()=>{const c=new pg.Client(settings);await c.connect();await c.query(`SET search_path TO "${schema}"`);await c.query("SET TIME ZONE 'UTC'");return c},
  close:async()=>{
   try{
    if(!/^lecture_test_[a-f0-9]{32}$/.test(schema))throw new Error('Unexpected test schema; cleanup refused')
    await client.query('ROLLBACK');await client.query('SET search_path TO public');await client.query(`DROP SCHEMA "${schema}" CASCADE`)
   }finally{await client.end()}
  },
 }
}
