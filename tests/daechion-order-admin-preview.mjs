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
  let id='10000000-0000-4000-8000-000000000001'
  const contact={studentName:'가상 학생',studentPhone:'01000001234',guardianName:'가상 보호자',guardianPhone:'01000005678',payerPhone:'01000009999',studentHistory:'EXISTING',applicantType:'STUDENT'}
  const detail={order:{id,version:'10',total_won:43500,checkout_state:'READY',payment_state:'PAID',identity_state:'PASSED',notification_state:'NOT_READY',student_id:'1001',review_code:null,contact_snapshot:contact},
    workerStatus:{session_issue:true,started_at:new Date().toISOString(),finished_at:new Date().toISOString(),result:'OK',next_run_at:new Date(Date.now()+30000).toISOString()},
    canHold:true,canApproveExisting:false,canResumeUnbilled:false,canResumePaid:false,canReconcileSheets:false,sheetRecoveryJobId:null,recoveries:[],items:[{product_id:'bundle',title:'가상 파이널 묶음',sale_kind:'BUNDLE',price_won:25000},{product_id:'single',title:'가상 개별 강의',sale_kind:'SINGLE',price_won:18500}],
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
    detail.actions.unshift({action:body.action,lecture_id:body.lectureId?String(body.lectureId):null,student_id:['APPROVE_EXISTING','RECONCILE_IDENTITY'].includes(body.action)?String(body.studentId):null,target_ids:body.targetIds??[],recovery_evidence:body.action==='RESUME_PAID'?{billId:body.billId,amountWon:43500,paidAt:new Date().toISOString()}:body.action==='RECONCILE_SHEETS'?{jobId:body.jobId}:['MANUAL_ACCESS','RECORD_REVOKED'].includes(body.action)?{studentId:body.studentId,weeklyLectureIds:body.action==='MANUAL_ACCESS'?[2000]:[]}: {},operator_name:body.operatorName,reason:body.reason,before_version:before,after_version:detail.order.version,created_at:new Date().toISOString()})
    if(body.action==='CONFIRM_NEW_INTAKE'){assert.equal(body.confirmNewStudent,true);detail.order.checkout_state='READY';detail.order.review_code=null;detail.canConfirmNewIntake=false}
    else if(body.action==='CLOSE_INTAKE'){assert.equal(body.confirmClose,true);detail.order.checkout_state='CLOSED';detail.order.review_code='intake_closed';detail.canCloseIntake=false;detail.canConfirmNewIntake=false;detail.canHold=false}
    else if(body.action==='RECONCILE_IDENTITY'){assert.equal(body.studentId,1001);assert.equal(body.confirmCreatedAccount,true);detail.order.identity_state='PASSED';detail.order.student_id='1001';detail.order.review_code='identity_reconciled';detail.canReconcileIdentity=false;detail.canResumePaid=true}
    else if(body.action==='RETRY_ACCESS'){assert.equal(body.lectureId,20);detail.grants[0].state='PENDING';detail.grants[0].can_retry=false;detail.grants[0].review_code=null}
    else if(body.action==='APPROVE_EXISTING'){assert.equal(body.studentId,1001);assert.deepEqual(body.targetIds,[20,21]);assert.equal(body.confirmNotOwned,true);detail.order.checkout_state='READY';detail.order.review_code=null}
    else if(body.action==='RESUME_UNBILLED'){assert.equal(detail.canResumeUnbilled,true);detail.order.checkout_state='READY';detail.order.review_code=null;detail.canResumeUnbilled=false}
    else if(body.action==='RESUME_PAID'){assert.equal(body.billId,detail.bills[0].bill_id);assert.equal(body.confirmPaid,true);detail.order.checkout_state='READY';detail.order.review_code=null;detail.canResumePaid=false}
    else if(body.action==='RECONCILE_SHEETS'){assert.equal(body.jobId,detail.sheetRecoveryJobId);assert.equal(body.confirmExistingRow,true);detail.canReconcileSheets=false;detail.recoveries.push({request_key:body.requestKey,state:'PENDING',result_code:null,created_at:new Date().toISOString()})}
    else if(body.action==='MANUAL_ACCESS'){assert.equal(body.studentId,1001);assert.equal(body.lectureId,20);assert.ok(body.confirmVideo&&body.confirmLessonMaterials&&body.confirmCourseMaterials);detail.grants[0].state='MANUAL';detail.manualGrantIds=[]}
    else if(body.action==='RECORD_REVOKED'){assert.equal(body.studentId,1001);assert.equal(body.lectureId,20);assert.equal(body.confirmRevoked,true);detail.grants[0].state='REVOKED';detail.grants[0].revoked_at=new Date().toISOString();detail.manualRevokeIds=['21'];detail.order.checkout_state='REVIEW';detail.order.review_code='manual_access_revoked';detail.canResumePaid=false}
    else{assert.equal(body.action,'HOLD');detail.order.checkout_state='REVIEW';detail.order.review_code='admin_hold';detail.canResumeUnbilled=detail.bills.length===0;detail.canResumePaid=detail.bills.length>0}
    if(loseReply){loseReply=false;return send({error:'가상 응답 유실 — 같은 요청으로 확인'},503)}
    return send({success:true,replayed:false})
  })
  await page.goto(origin+'/admin/daechion/orders');await page.getByRole('button',{name:'가상 학생',exact:true}).click()
  await page.getByText('대치온 로그인 세션 확인 필요 — 자동 권한 부여 대기',{exact:false}).waitFor()
  await page.screenshot({path:path.join(output,'order-scheduler-admin-20261109.png'),fullPage:true})
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
  await page.setViewportSize({width:1440,height:1000})
  await page.getByLabel('처리 종류').selectOption('RESUME_PAID')
  await page.getByLabel('담당자',{exact:true}).fill('검수 담당자')
  await page.getByLabel('확인 근거·사유').fill('현재 청구서의 승인 금액·시각 확인')
  await page.getByRole('checkbox',{name:/결제선생에서 이 청구서의/}).check()
  await page.getByRole('checkbox',{name:/가상 학생 학생의/}).check()
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}))
  await page.screenshot({path:path.join(output,'주문-결제복구-화면-20261108.png'),fullPage:true})
  await page.getByRole('button',{name:'확인 내용 저장'}).click()
  await page.getByText(/청구서 90000000000000000001 · 43,500원 · 승인/).waitFor()
  detail.canReconcileSheets=true;detail.sheetRecoveryJobId='20000000-0000-4000-8000-000000000001'
  await page.getByRole('button',{name:'새로 불러오기',exact:true}).click()
  await page.getByLabel('처리 종류').selectOption('RECONCILE_SHEETS')
  await page.getByLabel('담당자',{exact:true}).fill('검수 담당자')
  await page.getByLabel('확인 근거·사유').fill('업무 시트의 주문번호 기존 행 확인')
  await page.getByRole('checkbox',{name:/업무 시트에 위 주문번호의/}).check()
  await page.getByRole('checkbox',{name:/가상 학생 학생의/}).check()
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}))
  await page.screenshot({path:path.join(output,'주문-시트복구-화면-20261108.png'),fullPage:true})
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await page.screenshot({path:path.join(output,'주문-시트복구-모바일-20261108.png'),fullPage:true})
  loseReply=true
  await page.getByRole('button',{name:'확인 내용 저장'}).click()
  await page.getByRole('button',{name:'같은 요청 결과 다시 확인'}).click()
  await page.getByText(/Sheets 복구 · 대기/).waitFor()
  assert.equal(detail.recoveries.length,1);assert.equal(saved.size,4)
  detail.manualGrantIds=['20'];detail.manualRevokeIds=['20','21']
  await page.setViewportSize({width:1440,height:1000})
  await page.getByRole('button',{name:'새로 불러오기',exact:true}).click()
  await page.getByLabel('처리 종류').selectOption('MANUAL_ACCESS')
  await page.getByLabel('수동 처리한 강의').selectOption('20')
  await page.getByLabel('담당자',{exact:true}).fill('검수 담당자')
  await page.getByLabel('확인 근거·사유').fill('대치온에서 학생 ID 1001의 영상·자료 권한 직접 확인')
  for(const name of [/위 학생의 차시 영상/,/위 학생의 차시 자료/,/위 학생의 강의 자료/])await page.getByRole('checkbox',{name}).check()
  await page.getByRole('checkbox',{name:/가상 학생 학생의/}).check()
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}))
  await page.screenshot({path:path.join(output,'manual-access-record-20261109.png'),fullPage:true})
  await page.getByRole('button',{name:'확인 내용 저장'}).click()
  await page.getByText(/학생 ID 1001 · 확인한 차시 ID 2000/).waitFor()
  await page.getByLabel('처리 종류').selectOption('RECORD_REVOKED')
  await page.getByLabel('담당자',{exact:true}).fill('검수 담당자')
  await page.getByLabel('확인 근거·사유').fill('대치온에서 강의 ID 20 권한 회수 완료')
  await page.getByRole('checkbox',{name:/위 학생의 선택 강의 권한을 직접 회수/}).check()
  await page.getByRole('checkbox',{name:/가상 학생 학생의/}).check()
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}))
  await page.screenshot({path:path.join(output,'manual-revoke-record-20261109.png'),fullPage:true})
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await page.screenshot({path:path.join(output,'manual-revoke-mobile-20261109.png'),fullPage:true})
  await page.getByRole('button',{name:'확인 내용 저장'}).click()
  await page.getByText('대치온 수동 권한 회수 기록 — 자동 처리 보류',{exact:true}).first().waitFor()
  assert.equal(detail.grants[0].state,'REVOKED');assert.equal(detail.canResumePaid,false)
  // A separate synthetic unpaid scenario exercises the exact-ID attestation UI.
  id='10000000-0000-4000-8000-000000000002';detail.order.id=id;detail.order.version='1';detail.order.payment_state='PENDING';detail.order.identity_state='WAITING';detail.order.student_id=null;detail.order.review_code=null;detail.bills=[];detail.actions=[];detail.canApproveExisting=true;detail.canResumeUnbilled=false
  detail.canResumePaid=false;detail.canReconcileSheets=false;detail.sheetRecoveryJobId=null;detail.recoveries=[]
  detail.manualGrantIds=[];detail.manualRevokeIds=[]
  detail.grants=detail.grants.map(grant=>({...grant,state:'PENDING',review_code:null,enrollment_recorded:false,can_retry:false,revoked_at:null}))
  await page.setViewportSize({width:1440,height:1000})
  await page.getByRole('button',{name:'검색',exact:true}).click()
  await page.getByRole('button',{name:'가상 학생',exact:true}).click()
  await page.getByLabel('처리 종류').selectOption('APPROVE_EXISTING')
  await page.getByLabel('확인한 대치온 학생 ID').fill('1001')
  await page.getByLabel('담당자',{exact:true}).fill('검수 담당자')
  await page.getByLabel('확인 근거·사유').fill('학생·보호자 번호와 전체 구성 강의 미보유 확인')
  await page.getByRole('checkbox',{name:/위 학생이 모든 구성 강의/}).check()
  await page.getByRole('checkbox',{name:/가상 학생 학생의/}).check()
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}))
  await page.screenshot({path:path.join(output,'기존학생-확인-화면-20261108.png'),fullPage:true})
  await page.setViewportSize({width:390,height:844})
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await page.screenshot({path:path.join(output,'기존학생-확인-모바일-20261108.png'),fullPage:true})
  await page.getByRole('button',{name:'확인 내용 저장'}).click()
  await page.getByText(/학생 ID 1001 · 강의 ID 20, 21/).waitFor()
  for(const action of ['HOLD','RESUME_UNBILLED']){
    await page.getByLabel('처리 종류').selectOption(action)
    await page.getByLabel('담당자',{exact:true}).fill('검수 담당자')
    await page.getByLabel('확인 근거·사유').fill('청구 전 관리자 보류·해제 검수')
    await page.getByRole('checkbox',{name:/가상 학생 학생의/}).check()
    await page.getByRole('button',{name:'확인 내용 저장'}).click()
    await page.getByText(`버전 ${Number(detail.order.version)-1} → ${detail.order.version}`,{exact:false}).first().waitFor()
  }
  assert.equal(saved.size,9);assert.deepEqual(errors,[])
  detail.order.checkout_state='REVIEW';detail.order.payment_state='PAID';detail.order.identity_state='REVIEW';detail.order.student_id=null;detail.order.review_code='identity_create_unknown'
  detail.canReconcileIdentity=true;detail.canApproveExisting=false;detail.canResumeUnbilled=false
  await page.getByRole('button',{name:'새로 불러오기',exact:true}).click()
  await page.getByLabel('처리 종류').selectOption('RECONCILE_IDENTITY')
  await page.getByLabel('생성 결과를 확인한 대치온 학생 ID').fill('1001')
  await page.getByLabel('담당자',{exact:true}).fill('검수 담당자')
  await page.getByLabel('확인 근거·사유').fill('응답 유실 후 생성된 계정의 이름·학생·보호자 번호 확인')
  await page.getByRole('checkbox',{name:/이 신청으로 생성된 학생 계정과/}).check()
  await page.getByRole('checkbox',{name:/가상 학생 학생의/}).check()
  await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}))
  await page.screenshot({path:path.join(output,'identity-recovery-admin-20261109.png'),fullPage:true})
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await page.screenshot({path:path.join(output,'identity-recovery-mobile-20261109.png'),fullPage:true})
  await page.getByRole('button',{name:'확인 내용 저장'}).click()
  await page.getByText('학생 생성 결과 대조 완료 — 현재 결제 재조회 후 재개 필요',{exact:true}).first().waitFor()
  assert.equal(detail.order.checkout_state,'REVIEW');assert.equal(detail.order.student_id,'1001');assert.equal(saved.size,10);assert.deepEqual(errors,[])
  detail.order.checkout_state='REVIEW';detail.order.payment_state='PENDING';detail.order.identity_state='WAITING';detail.order.student_id=null;detail.order.review_code=null
  detail.order.contact_snapshot={...contact,studentHistory:'NEW'};detail.bills=[];detail.canReconcileIdentity=false;detail.canResumePaid=false
  detail.canConfirmNewIntake=true;detail.canCloseIntake=true;detail.canHold=true
  await page.getByRole('button',{name:'새로 불러오기',exact:true}).click()
  await page.getByLabel('처리 종류').selectOption('CONFIRM_NEW_INTAKE')
  await page.getByLabel('담당자',{exact:true}).fill('검수 담당자')
  await page.getByLabel('확인 근거·사유').fill('신규 학생 번호 중복·연결 강의 재조회')
  await page.getByRole('checkbox',{name:/이 학생이 신규 수강생이며/}).check()
  await page.getByRole('checkbox',{name:/가상 학생 학생의/}).check()
  await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}))
  await page.screenshot({path:path.join(output,'intake-confirm-admin-20261109.png'),fullPage:true})
  await page.getByRole('button',{name:'확인 내용 저장'}).click()
  await page.getByText(`버전 ${Number(detail.order.version)-1} → ${detail.order.version}`,{exact:false}).first().waitFor()
  assert.equal(detail.order.checkout_state,'READY')
  await page.getByLabel('처리 종류').selectOption('CLOSE_INTAKE')
  await page.getByLabel('담당자',{exact:true}).fill('검수 담당자')
  await page.getByLabel('확인 근거·사유').fill('신청 오류 확인 후 청구 전 종료')
  await page.getByRole('checkbox',{name:/이 신청을 종료하며/}).check()
  await page.getByRole('checkbox',{name:/가상 학생 학생의/}).check()
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}))
  await page.screenshot({path:path.join(output,'intake-close-admin-20261109.png'),fullPage:true})
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await page.screenshot({path:path.join(output,'intake-close-mobile-20261109.png'),fullPage:true})
  loseReply=true
  await page.getByRole('button',{name:'확인 내용 저장'}).click()
  await page.getByRole('button',{name:'같은 요청 결과 다시 확인'}).click()
  await page.getByText('관리자가 청구 전 신청을 종료함',{exact:true}).first().waitFor()
  assert.equal(detail.order.checkout_state,'CLOSED');assert.equal(saved.size,12);assert.deepEqual(errors,[])
  assert.equal(await page.getByRole('button',{name:'확인 내용 저장'}).isDisabled(),true)
  console.log(JSON.stringify({ok:true,uniqueActions:saved.size,replayedSameRequest:true,mobileFits:true,pageErrors:errors.length}))
}finally{
  await browser?.close()
  if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill();await exited}
  assert.equal(path.dirname(path.resolve(dir)),path.resolve(tmpdir()));assert.ok(path.basename(dir).startsWith('pkjmath-order-admin-'))
  await rm(dir,{recursive:true,force:true})
}
