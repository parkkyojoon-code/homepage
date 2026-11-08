// Isolated loopback UI QA. All order APIs are synthetic; no remote mutations.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {once} from 'node:events'
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from '../workers/daechion/browser/node_modules/playwright/index.mjs'
if(process.argv.slice(2).join(' ')!=='--local-only')throw Error('Explicit --local-only required')
const root=fileURLToPath(new URL('../',import.meta.url)),dir=await mkdtemp(path.join(tmpdir(),'pkjmath-order-admin-'))
const output=path.resolve(root,'../../outputs');await mkdir(output,{recursive:true});await writeFile(path.join(dir,'classes.json'),'[]')
const reserve=createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');const port=reserve.address().port
await new Promise((resolve,reject)=>reserve.close(error=>error?reject(error):resolve()))
const origin=`http://127.0.0.1:${port}`,env={...process.env,NODE_ENV:'production',DATA_DIR:dir,NODE_OPTIONS:'',
  DAECHION_DATABASE_URL:'',LECTURES_DATABASE_URL:'',DAECHION_API_KEY:'',DAECHION_ORDER_ADMIN_ENABLED:'false',DAECHION_ADMIN_ENABLED:'false',
  DAECHION_ORDERS_ENABLED:'false',DAECHION_INTAKE_ENABLED:'false',DAECHION_PAYSSAM_CALLBACK_ENABLED:'false',DAECHION_ORDER_WORKER_ENABLED:'false',
  DAECHION_BILLING_SEND_ENABLED:'false',DAECHION_ENROLLMENT_ENABLED:'false',DAECHION_READY_MESSAGE_ENABLED:'false',DAECHION_SHEETS_ENABLED:'false',
  PAYSSAM_API_KEY:'',PAYSSAM_MEMBER:'',PAYSSAM_MERCHANT:'',SOLAPI_API_KEY:'',SOLAPI_API_SECRET:'',GOOGLE_SERVICE_ACCOUNT_JSON:''}
const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env,windowsHide:true,stdio:'ignore'})
let browser
try{
  let online=false
  for(let n=0;n<150;n++){try{if((await fetch(origin+'/admin/daechion/orders')).ok){online=true;break}}catch{};await new Promise(resolve=>setTimeout(resolve,200))}
  assert.ok(online,'Local preview must start')
  browser=await chromium.launch({channel:'chrome',headless:true})
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage()
  const id='10000000-0000-4000-8000-000000000001',contact={studentName:'가상 학생',studentPhone:'01000001234',guardianName:'가상 보호자',guardianPhone:'01000005678',payerPhone:'01000009999',studentHistory:'EXISTING',applicantType:'STUDENT'}
  const detail={order:{id,version:'10',total_won:43500,checkout_state:'READY',payment_state:'PAID',identity_state:'PASSED',notification_state:'NOT_READY',student_id:'1001',review_code:null,contact_snapshot:contact},
    canHold:true,items:[{product_id:'bundle',title:'가상 파이널 묶음',sale_kind:'BUNDLE',price_won:25000},{product_id:'single',title:'가상 개별 강의',sale_kind:'SINGLE',price_won:18500}],
    bills:[{bill_id:'90000000000000000001',amount_won:43500,state:'SENT',is_current:true,checked_at:new Date().toISOString()}],
    grants:[{lecture_id:'20',state:'REVIEW',review_code:'grant_unknown',enrollment_recorded:true,can_retry:true},{lecture_id:'21',state:'VERIFIED',review_code:null,enrollment_recorded:true,can_retry:false}],messages:[],
    jobs:[{kind:'SHEETS',state:'DONE',attempts:1,last_error:null,event_version:'10'}],actions:[]}
  const rows=()=>({rows:[{...detail.order,student_name:contact.studentName,student_phone:contact.studentPhone,titles:'가상 파이널 묶음 · 가상 개별 강의',created_at:new Date().toISOString()}],page:0,hasMore:false})
  const saved=new Map(),attempts=[],errors=[];let loseReply=true
  page.on('pageerror',error=>errors.push(error.message))
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url())
    if(url.origin!==origin)return route.abort()
    if(url.pathname!=='/api/admin/daechion/orders')return route.continue()
    const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)})
    if(route.request().method()==='GET')return send(url.searchParams.has('id')?detail:rows())
    const body=route.request().postDataJSON()
    if(body.kind==='SEARCH')return send(rows())
    attempts.push(body)
    if(saved.has(body.requestKey)){assert.deepEqual(body,saved.get(body.requestKey));return send({success:true,replayed:true})}
    assert.equal(body.expectedVersion,detail.order.version);assert.equal(body.orderId,id);assert.equal(body.confirmed,true)
    saved.set(body.requestKey,body);const before=detail.order.version;detail.order.version=String(Number(before)+1)
    detail.actions.unshift({action:body.action,lecture_id:body.lectureId?String(body.lectureId):null,operator_name:body.operatorName,reason:body.reason,before_version:before,after_version:detail.order.version,created_at:new Date().toISOString()})
    if(body.action==='RETRY_ACCESS'){assert.equal(body.lectureId,20);detail.grants[0].state='PENDING';detail.grants[0].can_retry=false;detail.grants[0].review_code=null}
    else{assert.equal(body.action,'HOLD');detail.order.checkout_state='REVIEW';detail.order.review_code='admin_hold'}
    if(loseReply){loseReply=false;return send({error:'가상 응답 유실 — 같은 요청으로 확인'},503)}
    return send({success:true,replayed:false})
  })
  await page.goto(origin+'/admin/daechion/orders');await page.getByRole('button',{name:'가상 학생',exact:true}).click()
  await page.getByLabel('처리 종류').selectOption('RETRY_ACCESS')
  await page.getByLabel('담당자',{exact:true}).fill('검수 담당자')
  await page.getByLabel('확인 근거·사유').fill('API 등록 성공 확인\n영상·자료 권한 재검사')
  await page.getByRole('checkbox',{name:/가상 학생 학생의/}).check()
  await page.getByRole('button',{name:'확인 내용 저장'}).click()
  await page.getByRole('button',{name:'같은 요청 결과 다시 확인'}).waitFor()
  assert.equal(await page.getByLabel('담당자',{exact:true}).isDisabled(),true)
  await page.getByRole('button',{name:'같은 요청 결과 다시 확인'}).click()
  await page.getByRole('status').filter({hasText:'처리 기록을 저장했습니다.'}).waitFor()
  assert.equal(attempts.length,2);assert.deepEqual(attempts[0],attempts[1]);assert.equal(saved.size,1)
  await page.getByText('현재 재확인을 대기시킬 수 있는 강의가 없습니다.',{exact:false}).waitFor()
  await page.getByLabel('담당자',{exact:true}).fill('검수 담당자')
  await page.getByLabel('확인 근거·사유').fill('전체 자동 처리 보류 검수')
  await page.getByRole('checkbox',{name:/가상 학생 학생의/}).check()
  await page.getByRole('button',{name:'확인 내용 저장'}).click()
  await page.getByText('관리자가 자동 처리를 보류함',{exact:true}).first().waitFor()
  assert.equal(saved.size,2);assert.equal(detail.order.version,'12');assert.deepEqual(errors,[])
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}))
  await page.waitForFunction(()=>scrollY===0)
  await page.screenshot({path:path.join(output,'주문-관리자-화면-20261108.png'),fullPage:true})
  await page.setViewportSize({width:390,height:844})
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}))
  await page.screenshot({path:path.join(output,'주문-관리자-모바일-20261108.png'),fullPage:true})
  console.log(JSON.stringify({ok:true,uniqueActions:saved.size,replayedSameRequest:true,mobileFits:true,pageErrors:errors.length}))
}finally{
  await browser?.close()
  if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill();await exited}
  assert.equal(path.dirname(path.resolve(dir)),path.resolve(tmpdir()));assert.ok(path.basename(dir).startsWith('pkjmath-order-admin-'))
  await rm(dir,{recursive:true,force:true})
}
