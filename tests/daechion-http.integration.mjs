// Runs only against the disposable CI PostgreSQL and a loopback Next server.
// Google transport is simulated; actual Google publication has separate live QA.
import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { randomUUID, randomBytes } from 'node:crypto'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import migrations from '../scripts/daechion-migrations.cjs'
import sheetsWorker from '../.daechion-worker-build/lib/daechion/sheets-worker.js'
import sheetView from '../.daechion-worker-build/lib/daechion/sheets-view.js'

const root = fileURLToPath(new URL('../',import.meta.url))
const connectionString = process.env.DAECHION_TEST_POSTGRES_URL

test('real HTTP intake persists to PostgreSQL and reaches the Sheets outbox', {skip:!connectionString,timeout:120000}, async t => {
  const url = new URL(connectionString)
  assert.ok(['127.0.0.1','localhost'].includes(url.hostname))
  assert.equal(url.pathname,'/daechion_ci'); assert.equal(url.username,'daechion_ci')
  await readFile(path.join(root,'.next','BUILD_ID'))
  const client = new pg.Client({connectionString})
  await client.connect()
  const temp = await mkdtemp(path.join(tmpdir(),'pkjmath-daechion-http-'))
  let child
  try {
    const identity = (await client.query('SELECT current_database() AS db,current_user AS username')).rows[0]
    assert.equal(identity.db,'daechion_ci'); assert.equal(identity.username,'daechion_ci')
    await client.query('DROP SCHEMA IF EXISTS daechion_automation CASCADE')
    await migrations.migrate(client)
    const baseClass = { visible:true,name:'[가상 검수] HTTP 신청',category:'수리논술',image:null,duration:'검수',
      modes:{online:{enabled:true,price:1200,campuses:[]},offline:{enabled:false,price:0,campuses:[]}},
      textbook:{included:false,price:0},description:'',keywords:['','',''],createdAt:'2026-11-07',updatedAt:'2026-11-07' }
    const productId = 'isolated-http-process-two'
    await writeFile(path.join(temp,'classes.json'),JSON.stringify([
      {...baseClass,id:productId,purchaseProcess:'PROCESS_2',daechionBinding:{tenantId:'test-only',lectures:[{id:101,name:'ID 연결 검수'}],verifiedAt:'2026-11-07T00:00:00Z'}},
      {...baseClass,id:'12course'}, {...baseClass,id:'chuweol'},
    ]))
    const reservation = createServer(); reservation.listen(0,'127.0.0.1'); await once(reservation,'listening')
    const port = reservation.address().port
    await new Promise((resolve,reject)=>reservation.close(e=>e?reject(e):resolve()))
    const origin = `http://127.0.0.1:${port}`
    const adminPassword = randomBytes(24).toString('hex')
    const callbackKey = randomBytes(24).toString('hex')
    const env = {...process.env,NODE_ENV:'production',DATA_DIR:temp,ADMIN_PASSWORD:adminPassword,ADMIN_SECRET:randomBytes(32).toString('hex'),
      DAECHION_CATALOG_FIXTURE:'local-only',NODE_OPTIONS:`--require ${JSON.stringify(path.join(root,'tests','daechion-catalog-fixture.cjs'))}`,
      DAECHION_INTAKE_ENABLED:'true',DAECHION_ADMIN_ENABLED:'true',DAECHION_DATABASE_URL:connectionString,DAECHION_ORDERS_ENABLED:'false',
      DAECHION_TENANT_ID:'test-only',DAECHION_APP_ORIGIN:origin,DAECHION_ADDITIONAL_ORIGINS:'',DAECHION_PRODUCT_BINDINGS_JSON:'[]',
      DAECHION_BILLING_WORKER_ENABLED:'false',DAECHION_BILLING_SEND_ENABLED:'false',DAECHION_PAYMENT_READ_ENABLED:'false',
      DAECHION_ENROLLMENT_ENABLED:'false',DAECHION_READY_MESSAGE_ENABLED:'false',DAECHION_SHEETS_ENABLED:'false',
      DAECHION_API_KEY:'synthetic-fixture-only',GOOGLE_SERVICE_ACCOUNT_JSON:'',GOOGLE_SHEET_ID:'',PAYSSAM_API_KEY:callbackKey,PAYSSAM_MEMBER:'',PAYSSAM_MERCHANT:'',
      DAECHION_PAYSSAM_CALLBACK_ENABLED:'true',
      SOLAPI_API_KEY:'',SOLAPI_API_SECRET:'',LECTURES_DATABASE_URL:'',LECTURES_WORKER_ENABLED:'false',LECTURES_WORKER_TOKEN:''}
    child = spawn(process.execPath,[path.join(root,'node_modules','next','dist','bin','next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env,stdio:'ignore',windowsHide:true})
    let startError; child.on('error',e=>{startError=e})
    const request = (route,{body,cookie,method,requestOrigin=origin,timeout=15000}={})=>fetch(origin+route,{
      method:method??(body===undefined?'GET':'POST'),redirect:'manual',signal:AbortSignal.timeout(timeout),
      headers:{Origin:requestOrigin,...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},
      ...(body===undefined?{}:{body:JSON.stringify(body)})})
    let ready = false
    for(let i=0;i<80;i++) {
      if(startError)throw startError
      if(child.exitCode!==null)throw Error('Disposable Next server stopped')
      try { const r=await request('/api/classes',{timeout:750});await r.arrayBuffer();if(r.status===200){ready=true;break} }catch{}
      await new Promise(resolve=>setTimeout(resolve,250))
    }
    assert.ok(ready)
    const input = {requestKey:randomUUID(),productId,studentHistory:'NEW',applicantType:'GUARDIAN',studentName:'가상 HTTP 학생',guardianName:'가상 HTTP 보호자',
      studentPhone:'010-0000-0771',guardianPhone:'010-0000-0772',payerPhone:'010-0000-0773',mode:'ONLINE',campus:'',expectedTotalWon:1200,confirmPayment:true,agreePrivacy:true}
    let applicationId,adminCookie,qaSheetPorts,readPublishedRow,readSheetWrites
    await t.test('administrator creates and edits an explicitly typed private bundle without changing existing products',async()=>{
      const before=JSON.parse(await readFile(path.join(temp,'classes.json'),'utf8'))
      const body={id:'bundle-http-fixture',saleKind:'BUNDLE',purchaseProcess:'PROCESS_2',visible:false,name:'가상 묶음상품',
        modes:{online:{enabled:true,price:900},offline:{enabled:false,price:0,campuses:[]}},textbook:{included:false,price:0},
        duration:'가상 일정',daechionLectureIds:[101,102]}
      assert.equal((await request('/api/admin/classes',{body})).status,401)
      const login=await request('/api/admin/login',{body:{password:adminPassword}})
      const cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie)
      for(const invalid of [{...body,visible:true},{...body,daechionLectureIds:[101,101]},{...body,purchaseProcess:'PROCESS_1'},
        {...body,modes:{...body.modes,online:{enabled:true,price:1.5}}}])assert.equal((await request('/api/admin/classes',{body:invalid,cookie})).status,400)
      const created=await request('/api/admin/classes',{body,cookie});assert.equal(created.status,201)
      const bundle=await created.json()
      assert.equal(bundle.saleKind,'BUNDLE');assert.equal(bundle.duration,'가상 일정');assert.equal(bundle.modes.online.price,900)
      assert.deepEqual(bundle.daechionBinding.lectures,[{id:101,name:'가상 강의'},{id:102,name:'가상 강의'}])
      const image=()=>{const form=new FormData();form.append('image',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'fixture.png');form.append('expectedUpdatedAt',bundle.updatedAt);return form}
      const uploaded=await fetch(origin+'/api/admin/classes/'+body.id+'/image',{method:'POST',headers:{Cookie:cookie},body:image()})
      assert.equal(uploaded.status,200)
      const imageResult=await uploaded.json();assert.ok(imageResult.updatedAt>bundle.updatedAt)
      assert.equal((await fetch(origin+'/api/admin/classes/'+body.id+'/image',{method:'POST',headers:{Cookie:cookie},body:image()})).status,409)
      const update={expectedUpdatedAt:imageResult.updatedAt,modes:{...body.modes,online:{enabled:true,price:19900}}}
      const changed=await request('/api/admin/classes/'+body.id,{body:update,cookie,method:'PUT'})
      assert.equal(changed.status,200);assert.equal((await changed.json()).modes.online.price,19900)
      assert.equal((await request('/api/admin/classes/'+body.id,{body:update,cookie,method:'PUT'})).status,409)
      assert.equal((await request('/api/admin/classes/'+body.id,{body:{saleKind:'SINGLE'},cookie,method:'PUT'})).status,400)
      assert.equal((await request('/api/admin/classes/'+productId,{body:{saleKind:'BUNDLE'},cookie,method:'PUT'})).status,400)
      const after=JSON.parse(await readFile(path.join(temp,'classes.json'),'utf8'))
      assert.deepEqual(after.filter(c=>c.id!==body.id),before)
      assert.ok(!(await (await request('/api/classes')).json()).some(c=>c.id===body.id))
    })
    await t.test('new cart endpoints stay unavailable while the original process-two intake runs',async()=>{
      assert.deepEqual(await (await request('/api/daechion/orders/catalog')).json(),{available:false,products:[]})
      for(const route of ['/api/daechion/orders/cart','/api/daechion/orders/quotes','/api/daechion/orders']){
        const response=await request(route,{body:{}})
        assert.equal(response.status,503)
        assert.equal((await response.json()).code,'ORDERS_UNAVAILABLE')
        assert.equal(response.headers.get('cache-control'),'no-store')
      }
    })
    await t.test('only the configured process-two product is available; old route cannot accept it',async()=>{
      assert.equal((await (await request(`/api/daechion/applications?productId=${productId}`)).json()).available,true)
      for(const id of ['12course','chuweol'])assert.equal((await (await request(`/api/daechion/applications?productId=${id}`)).json()).available,false)
      assert.equal((await request('/api/apply',{body:{courseId:productId}})).status,503)
      assert.equal((await request('/api/apply',{body:{}})).status,400)
    })
    await t.test('origin, declared history, amount and original-product protections reject before saving',async()=>{
      assert.equal((await request('/api/daechion/applications',{body:input,requestOrigin:'https://untrusted.invalid'})).status,403)
      const missing = {...input};delete missing.studentHistory
      assert.equal((await request('/api/daechion/applications',{body:missing})).status,400)
      assert.equal((await request('/api/daechion/applications',{body:{...input,expectedTotalWon:1}})).status,409)
      for(const productId of ['12course','chuweol'])assert.equal((await request('/api/daechion/applications',{body:{...input,productId}})).status,503)
      assert.equal(Number((await client.query('SELECT count(*) FROM daechion_automation.applications')).rows[0].count),0)
    })
    await t.test('HTTP receipt means one durable unpaid application, one registration and one Sheets job',async()=>{
      const response = await request('/api/daechion/applications',{body:input});assert.equal(response.status,201)
      const data=await response.json();assert.equal(data.success,true);assert.equal(data.status,'RECEIVED');applicationId=data.applicationId
      const app=(await client.query('SELECT * FROM daechion_automation.applications WHERE id=$1',[applicationId])).rows[0]
      assert.equal(app.payment_state,'PENDING');assert.equal(app.submission.studentPhone,'01000000771');assert.equal(app.submission.guardianPhone,'01000000772');assert.equal(app.submission.payerPhone,'01000000773')
      assert.equal(app.submission.daechionTenantId,'test-only');assert.equal(app.submission.totalWon,1200)
      assert.deepEqual((await client.query('SELECT lecture_id,state FROM daechion_automation.registrations WHERE application_id=$1',[applicationId])).rows,[{lecture_id:'101',state:'PENDING'}])
      assert.equal(Number((await client.query('SELECT count(*) FROM daechion_automation.bills')).rows[0].count),0)
    })
    await t.test('same request replays without duplicates; edited replay is rejected',async()=>{
      const replay=await request('/api/daechion/applications',{body:input});assert.equal(replay.status,200)
      const data=await replay.json();assert.equal(data.applicationId,applicationId);assert.equal(data.created,false)
      assert.equal((await request('/api/daechion/applications',{body:{...input,studentName:'다른 이름'}})).status,409)
      assert.equal(Number((await client.query('SELECT count(*) FROM daechion_automation.applications')).rows[0].count),1)
      assert.equal(Number((await client.query("SELECT count(*) FROM daechion_automation.outbox WHERE kind='SHEETS'")).rows[0].count),1)
    })
    await t.test('existing administrator authentication can read the new receipt; anonymous access cannot',async()=>{
      const route=`/api/admin/daechion/applications?id=${applicationId}`
      assert.equal((await request(route)).status,401)
      const login=await request('/api/admin/login',{body:{password:adminPassword}});assert.equal(login.status,200)
      adminCookie=login.headers.getSetCookie().find(value=>value.startsWith('admin_session=')).split(';')[0]
      const response=await request(route,{cookie:adminCookie});assert.equal(response.status,200)
      assert.ok(JSON.stringify(await response.json()).includes(applicationId))
    })
    await t.test('public callbacks cannot assert paid status or grant access, even with a valid receipt key',async()=>{
      const route='/api/daechion/payssam/notification'
      const receipt={apikey:callbackKey,bill_id:'20261107000000000001',appr_state:'F',appr_price:'1'}
      assert.equal((await request(route,{body:{...receipt,apikey:'forged'}})).status,401)
      for(const appr_state of ['F','F','C','D']){
        const response=await request(route,{body:{...receipt,appr_state},requestOrigin:''})
        assert.equal(response.status,200);assert.deepEqual(await response.json(),{code:'0000',msg:'OK'})
      }
      assert.equal((await client.query('SELECT payment_state FROM daechion_automation.applications WHERE id=$1',[applicationId])).rows[0].payment_state,'PENDING')
      assert.equal((await client.query('SELECT state FROM daechion_automation.registrations WHERE application_id=$1',[applicationId])).rows[0].state,'PENDING')
      assert.equal(Number((await client.query('SELECT count(*) FROM daechion_automation.bills')).rows[0].count),0)
      assert.equal(Number((await client.query('SELECT count(*) FROM daechion_automation.ready_receipts')).rows[0].count),0)
      assert.equal((await request('/api/lectures/payssam/notification',{body:receipt})).status,410)
    })
    await t.test('the HTTP-created DB job reaches the real publisher once, without legacy-sheet access',async()=>{
      const target={spreadsheetId:'isolated-new-sheet-http-test',legacySpreadsheetId:'isolated-old-sheet-http-test',sheetId:7}
      let publishedRow,inserts=0,updates=0
      const api={call:async(method,requestPath,body)=>{
        assert.ok(requestPath.startsWith('/spreadsheets/'+target.spreadsheetId))
        if(requestPath.includes('developerMetadata:search'))return body.dataFilters[0].developerMetadataLookup.metadataKey==='pkjmath_process2_sheet_v1'?{matchedDeveloperMetadata:[{developerMetadata:{metadataId:1,location:{sheetId:7}}}]}:publishedRow?{matchedDeveloperMetadata:[{developerMetadata:{metadataId:45,location:{dimensionRange:{sheetId:7,dimension:'ROWS',startIndex:1,endIndex:2}}}}]}:{}
        if(requestPath.includes('?fields='))return {sheets:[{properties:{sheetId:7,title:'검수'}}]}
        if(method==='GET')return {values:[sheetView.SHEET_HEADERS]}
        if(requestPath.endsWith('/values:batchUpdateByDataFilter')){
          assert.equal(body.valueInputOption,'RAW');assert.equal(body.data[0].dataFilter.developerMetadataLookup.metadataId,45)
          publishedRow=body.data[0].values[0];updates++
          return {spreadsheetId:target.spreadsheetId,totalUpdatedRows:1}
        }
        assert.equal(requestPath,`/spreadsheets/${target.spreadsheetId}:batchUpdate`)
        publishedRow=body.requests.find(r=>r.updateCells).updateCells.rows[0].values.map(c=>c.userEnteredValue.stringValue??c.userEnteredValue.numberValue)
        inserts++
        return {spreadsheetId:target.spreadsheetId,replies:[{},{},{}]}
      }}
      const ports={api,target,withClient:run=>run(client)}
      qaSheetPorts=ports;readPublishedRow=()=>publishedRow
      readSheetWrites=()=>({inserts,updates})
      assert.equal(await sheetsWorker.syncOneApplication(ports),'DONE')
      assert.equal(await sheetsWorker.syncOneApplication(ports),'SKIPPED')
      assert.equal(publishedRow[0],applicationId);assert.equal(publishedRow[4],input.studentName)
      assert.deepEqual(publishedRow.slice(6,9),['01000000771','01000000772','01000000773'])
      assert.equal(publishedRow[9],baseClass.name);assert.equal(publishedRow[16],1200)
      assert.equal(publishedRow[21],'미발송');assert.equal(publishedRow[26],'미납');assert.equal(publishedRow[36],'조회 대기')
      assert.equal((await client.query("SELECT state FROM daechion_automation.outbox WHERE kind='SHEETS'")).rows[0].state,'DONE')
    })
    await t.test('authenticated manual hold rejects incomplete and stale edits, replays once and reaches the operational sheet',async()=>{
      const route='/api/admin/daechion/applications'
      const version=(await client.query('SELECT version::text FROM daechion_automation.applications WHERE id=$1',[applicationId])).rows[0].version
      const action={requestKey:randomUUID(),applicationId,expectedVersion:version,action:'HOLD',operatorName:'검수 담당자',reason:'가상 수동 처리 검수',confirmed:true}
      assert.equal((await request(route,{body:action})).status,401)
      assert.equal((await request(route,{body:action,cookie:adminCookie,requestOrigin:'https://untrusted.invalid'})).status,403)
      for(const invalid of [{...action,operatorName:''},{...action,reason:''},{...action,confirmed:false}])
        assert.equal((await request(route,{body:invalid,cookie:adminCookie})).status,400)
      const response=await request(route,{body:action,cookie:adminCookie});assert.equal(response.status,200)
      assert.equal((await response.json()).success,true)
      const held=(await client.query('SELECT version::text,automation_state,review_code FROM daechion_automation.applications WHERE id=$1',[applicationId])).rows[0]
      assert.equal(held.automation_state,'HOLD');assert.equal(held.review_code,'manual_hold')
      assert.notEqual(held.version,version)
      assert.equal((await client.query('SELECT state FROM daechion_automation.registrations WHERE application_id=$1',[applicationId])).rows[0].state,'STOPPED')
      const replay=await request(route,{body:action,cookie:adminCookie});assert.equal(replay.status,200);assert.equal((await replay.json()).replayed,true)
      const stale=await request(route,{body:{...action,requestKey:randomUUID()},cookie:adminCookie});assert.equal(stale.status,409)
      const detail=await (await request(route+'?id='+applicationId,{cookie:adminCookie})).json()
      assert.equal(detail.app.current_version,held.version);assert.equal(detail.actions.length,1)
      assert.equal(detail.actions[0].operator_name,action.operatorName);assert.equal(detail.actions[0].reason,action.reason)
      assert.equal(await sheetsWorker.syncOneApplication(qaSheetPorts),'DONE')
      assert.equal(readPublishedRow()[30],'보류');assert.equal(readPublishedRow()[32],'관리자가 자동 처리를 보류함')
      assert.equal(readPublishedRow().includes('manual_hold'),false)
      assert.deepEqual(readSheetWrites(),{inserts:1,updates:1})
    })
  } finally {
    if(child?.pid&&child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill();await exited}
    await client.end()
    assert.equal(path.dirname(path.resolve(temp)),path.resolve(tmpdir()))
    assert.ok(path.basename(temp).startsWith('pkjmath-daechion-http-'))
    await rm(temp,{recursive:true,force:true})
  }
})
