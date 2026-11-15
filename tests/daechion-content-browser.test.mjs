import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {EventEmitter} from 'node:events'
import provider from '../workers/daechion/browser/provider.cjs'
import contentVerify from '../scripts/daechion-content-verify.cjs'
import sessionStore from '../workers/daechion/browser/session-store.cjs'
import tokenState from '../workers/daechion/browser/token-state.cjs'
import sessionCheck from '../scripts/daechion-session-check.cjs'
const require=createRequire(import.meta.url)
const env={DAECHION_CONTENT_BROWSER_ENABLED:'true',DAECHION_CONTENT_BROWSER_VERIFIED:'true',DAECHION_TENANT_ID:'116',
  DAECHION_BROWSER_STORAGE_STATE:JSON.stringify({cookies:[],origins:[{origin:'https://parkkyojoon.daechion.com',localStorage:[{name:'fixture',value:'synthetic-only'}]}]})}
const input={studentId:77,lectureId:10,weeklyLectureIds:[100],studentName:'검수학생',studentPhone:'01000000001',beforeWrite:async()=>{}}
const api={me:async()=>({tenantId:116}),student:async()=>({id:77,name:'검수학생',studentPhoneNumber:'010-0000-0001',active:false}),
  students:async()=>[{id:77}],
  lectures:async()=>[{id:10,name:'같은 이름',opened:true,weeklyLectures:[{id:100,name:'차시 A'}]}]}

const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return {promise,resolve}}
const nextTurn=()=>new Promise(resolve=>setImmediate(resolve))
const never=()=>new Promise(()=>{})
const shortDeadline={operationTimeoutMs:100,cleanupTimeoutMs:30}
function refreshFixture(overrides={}){
  let currentUrl=''
  const locator={waitFor:async()=>{},getAttribute:async()=>'/crm/admin'}
  const page={getByRole:()=>locator,goto:async value=>{currentUrl=value},url:()=>currentUrl,...overrides.page}
  const context={setDefaultTimeout:()=>{},route:async()=>{},newPage:async()=>page,storageState:async()=>JSON.parse(env.DAECHION_BROWSER_STORAGE_STATE),close:async()=>{},...overrides.context}
  return {page,context,browser:{newContext:async()=>context,close:async()=>{},...overrides.browser}}
}

test('the whole browser lifetime bounds hung lease/API checks, launch, context, routing, page creation, refresh and save',
  {timeout:5000},async()=>{
  for(const at of ['acquire','lease','api','launch','context','route','page','refresh','save','release']){
    let launched=0,closed=0,saves=0
    const fixture=refreshFixture({
      page:at==='refresh'?{goto:never}:{},
      context:{...(at==='route'?{route:never}:{}),...(at==='page'?{newPage:never}:{})},
      browser:{...(at==='context'?{newContext:never}:{}),close:async()=>{closed++}},
    })
    const sessions={run:async work=>{
      if(at==='acquire')return never()
      const result=await work({state:env.DAECHION_BROWSER_STORAGE_STATE,signal:new AbortController().signal,
        assert:at==='lease'?never:async()=>{},save:async()=>{saves++;if(at==='save')await never()}})
      if(at==='release')return never()
      return result
    }}
    const access=provider.browserAccessProvider(env,{...api,...(at==='api'?{me:never}:{})},{...shortDeadline,sessions,
      launch:async()=>{launched++;return at==='launch'?never():fixture.browser}})
    const started=Date.now()
    await assert.rejects(access.refreshSession(),error=>error.message==='CONTENT_ACCESS_UNCONFIRMED'&&
      error.stage===({acquire:'API_PREFLIGHT',lease:'API_PREFLIGHT',api:'API_PREFLIGHT',launch:'BROWSER_LAUNCH',context:'BROWSER_CONTEXT',route:'BROWSER_CONTEXT',page:'BROWSER_CONTEXT',refresh:'SESSION_REFRESH',save:'SESSION_REFRESH',release:'SESSION_REFRESH'})[at])
    assert.ok(Date.now()-started<1000,at+' must finish within its injected lifetime bound')
    assert.equal(launched,['acquire','lease','api'].includes(at)?0:1,at)
    assert.equal(closed,['acquire','lease','api','launch'].includes(at)?0:1,at)
    assert.equal(saves,['save','release'].includes(at)?1:0,at)
  }
})

test('a late launch is closed and a late context is discarded after the deadline without opening a page',
  {timeout:2000},async()=>{
  for(const at of ['launch','context']){
    const pending=deferred();let closed=0,contexts=0,contextCloses=0,pages=0
    const fixture=refreshFixture({context:{newPage:async()=>{pages++;throw Error('must not create a page')},close:async()=>{contextCloses++}},
      browser:{close:async()=>{closed++}}})
    fixture.browser.newContext=async()=>{contexts++;return at==='context'?pending.promise:fixture.context}
    const access=provider.browserAccessProvider(env,api,{...shortDeadline,launch:()=>at==='launch'?pending.promise:fixture.browser})
    await assert.rejects(access.refreshSession(),/CONTENT_ACCESS_UNCONFIRMED/)
    pending.resolve(at==='launch'?fixture.browser:fixture.context)
    await nextTurn()
    assert.equal(closed,1);assert.equal(contexts,at==='context'?1:0);assert.equal(contextCloses,at==='context'?1:0);assert.equal(pages,0)
  }
})

test('DB abort is installed before a pending context and retains the shared lease until browser close confirms',
  {timeout:2000},async()=>{
  const controller=new AbortController(),contextPending=deferred(),contextEntered=deferred(),closing=deferred(),closed=deferred()
  let released=0,pages=0,saves=0,lateContextCloses=0
  const context={close:async()=>{lateContextCloses++},newPage:async()=>{pages++}}
  const sessions={run:async work=>{try{return await work({state:env.DAECHION_BROWSER_STORAGE_STATE,signal:controller.signal,assert:async()=>{},save:async()=>{saves++}})}finally{released++}}}
  const access=provider.browserAccessProvider(env,api,{operationTimeoutMs:1000,cleanupTimeoutMs:500,sessions,launch:async()=>({
    newContext:()=>{contextEntered.resolve();return contextPending.promise},close:()=>{closing.resolve();return closed.promise},
  })})
  const result=access.refreshSession(),rejection=assert.rejects(result,error=>error.message==='CONTENT_ACCESS_UNCONFIRMED'&&error.stage==='BROWSER_CONTEXT')
  await contextEntered.promise
  controller.abort()
  await closing.promise
  assert.equal(released,0,'the browser must stop before the DB lease is released')
  closed.resolve()
  await rejection
  assert.equal(released,1)
  contextPending.resolve(context)
  await nextTurn()
  assert.equal(lateContextCloses,1);assert.equal(pages,0);assert.equal(saves,0)
})

test('an already-aborted DB lease never starts API authentication or a browser',async()=>{
  const controller=new AbortController();controller.abort();let calls=0
  const sessions={run:work=>work({state:env.DAECHION_BROWSER_STORAGE_STATE,signal:controller.signal,assert:async()=>{calls++},save:async()=>{calls++}})}
  const access=provider.browserAccessProvider(env,{...api,me:async()=>{calls++}},{...shortDeadline,sessions,launch:async()=>{calls++}})
  await assert.rejects(access.refreshSession(),error=>error.stage==='API_PREFLIGHT')
  assert.equal(calls,0)
})

test('DB connection loss immediately kills an owned browser instead of waiting through the close grace period',
  {timeout:2000},async()=>{
  const controller=new AbortController(),entered=deferred();let killed=0,released=0,saves=0
  const fixture=refreshFixture({page:{goto:()=>{entered.resolve();return never()}},browser:{close:never}})
  const server={close:never,kill:async()=>{killed++},wsEndpoint:()=> 'ws://127.0.0.1/synthetic'}
  const chromium={launchServer:async()=>server,connect:async()=>fixture.browser}
  const sessions={run:async work=>{try{return await work({state:env.DAECHION_BROWSER_STORAGE_STATE,signal:controller.signal,assert:async()=>{},save:async()=>{saves++}})}finally{released++}}}
  const access=provider.browserAccessProvider(env,api,{operationTimeoutMs:1000,cleanupTimeoutMs:500,chromium,sessions})
  const result=access.refreshSession(),rejection=assert.rejects(result,error=>error.stage==='SESSION_REFRESH')
  await entered.promise
  controller.abort()
  await nextTurn()
  assert.equal(killed,1,'kill must start immediately after DB loss')
  await rejection
  assert.equal(released,1);assert.equal(saves,0)
})

test('a cancelled registration fence cannot submit a write when its late DB result arrives',
  {timeout:2000},async()=>{
  const controller=new AbortController(),fence=deferred(),entered=deferred();let writes=0,recorded=0,currentUrl=''
  const row={waitFor:async()=>{},count:async()=>1,getByText:()=>row,getByRole:()=>row,setChecked:async()=>{}}
  const picker={filter(){return this},getByRole(role,options){
    return role==='row'?{filter:()=>row}:{fill:async()=>{},press:async()=>{},click:async()=>{if(/^1명 추가/.test(String(options.name)))writes++}}
  }}
  const ready={waitFor:async()=>{},or(){return this},isVisible:async()=>true,click:async()=>{}}
  const page={goto:async value=>{currentUrl=value},url:()=>currentUrl,getByText:()=>ready,
    getByRole:role=>role==='dialog'?picker:ready}
  const fixture=refreshFixture({context:{newPage:async()=>page}})
  const sessions={run:work=>work({state:env.DAECHION_BROWSER_STORAGE_STATE,signal:controller.signal,assert:async()=>{},save:async()=>{}})}
  const access=provider.browserAccessProvider(env,api,{operationTimeoutMs:1000,cleanupTimeoutMs:100,sessions,launch:async()=>fixture.browser})
  const result=access.ensureFirstLessonAccess({...input,weeklyLectureId:100,enrollmentRecorded:false,
    beforeWrite:()=>{entered.resolve();return fence.promise},recordEnrollment:async()=>{recorded++}})
  const rejection=assert.rejects(result,/CONTENT_ACCESS_UNCONFIRMED/)
  await entered.promise
  controller.abort()
  await rejection
  fence.resolve()
  await nextTurn()
  assert.equal(writes,0);assert.equal(recorded,0)
})

test('owned browser processes are force-terminated when graceful close or the BrowserServer kill promise hangs',
  {timeout:2000},async()=>{
  for(const hungKill of [false,true]){
    let killed=0,signals=0,launched=0,connected=0
    const child=new EventEmitter();child.exitCode=null;child.signalCode=null
    child.kill=signal=>{assert.equal(signal,'SIGKILL');signals++;child.signalCode=signal;child.emit('exit');return true}
    const fixture=refreshFixture({browser:{close:never}})
    const server={close:never,kill:async()=>{killed++;if(hungKill)await never()},process:()=>child,wsEndpoint:()=> 'ws://127.0.0.1/synthetic'}
    const chromium={launchServer:async options=>{assert.equal(options.headless,true);assert.ok(options.timeout>0);launched++;return server},
      connect:async endpoint=>{assert.equal(endpoint,server.wsEndpoint());connected++;return fixture.browser}}
    const access=provider.browserAccessProvider(env,api,{...shortDeadline,chromium})
    assert.deepEqual(await access.refreshSession(),{refreshed:true})
    assert.equal(killed,1);assert.equal(signals,hungKill?1:0);assert.equal(launched,1);assert.equal(connected,1)
  }
})

test('unconfirmed browser termination returns a bounded redacted failure, holds the lease and prevents another launch',
  {timeout:2000},async()=>{
  let acquired=0,released=0,launched=0
  const fixture=refreshFixture({browser:{close:never}})
  const sessions={run:async work=>{acquired++;try{return await work({state:env.DAECHION_BROWSER_STORAGE_STATE,signal:new AbortController().signal,assert:async()=>{},save:async()=>{}})}finally{released++}}}
  const access=provider.browserAccessProvider(env,api,{...shortDeadline,sessions,launch:async()=>{launched++;return fixture.browser}})
  assert.equal(access.isAvailable(),true)
  for(let attempt=0;attempt<2;attempt++)await assert.rejects(access.refreshSession(),error=>
    error.message==='CONTENT_ACCESS_UNCONFIRMED'&&error.browserTerminationUnconfirmed===true&&!error.message.includes('synthetic'))
  assert.equal(access.isAvailable(),false)
  assert.equal(acquired,1);assert.equal(launched,1);assert.equal(released,0)
})

const fixtureToken=exp=>Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({exp})).toString('base64url')+'.synthetic-signature'
test('expiration acceptance changes only an isolated access-token copy and preserves the refresh cookie',()=>{
  const raw=JSON.stringify({cookies:[{domain:'parkkyojoon.daechion.com',name:'refresh',value:'private-refresh-fixture'}],
    origins:[{origin:'https://parkkyojoon.daechion.com',localStorage:[{name:'auth',value:fixtureToken(2000000000)}]}]})
  const expired=tokenState.expiredAccessCopy(raw)
  assert.equal(tokenState.accessExpiry(expired),1);assert.equal(tokenState.accessExpiry(raw),2000000000)
  assert.deepEqual(JSON.parse(expired).cookies,JSON.parse(raw).cookies)
  assert.throws(()=>tokenState.expiredAccessCopy(env.DAECHION_BROWSER_STORAGE_STATE),/REFRESH_TEST_UNAVAILABLE/)
})
test('session acceptance is read-only, reloads persistence and requires explicit reset and target matching',async()=>{
  const settings={DAECHION_TENANT_ID:'116',DAECHION_CONTENT_TEST_ONLY:'true',DAECHION_CONTENT_TEST_LECTURE_ID:'10'},calls=[]
  const ports={api,storeFactory:()=>({reset:async()=>{calls.push('reset')}}),accessFactory:()=>({refreshSession:async(id,options)=>{
    calls.push({id,expired:options?.exerciseExpiredAccess===true});return {refreshed:true,...(options?.exerciseExpiredAccess?{expiredAccessExercised:true}:{})}
  }})}
  await assert.rejects(sessionCheck.checkSession(['--lecture-id','11'],settings,ports),/TARGET_REQUIRED/)
  await assert.rejects(sessionCheck.checkSession(['--lecture-id','10','--grant'],settings,ports),/ARGUMENTS_REQUIRED/)
  assert.equal(calls.length,0)
  assert.deepEqual(await sessionCheck.checkSession(['--lecture-id','10','--exercise-expired-access'],settings,ports),{readOnly:true,refreshed:true,reloaded:true,expiredAccessExercised:true,lectureId:10})
  assert.deepEqual(calls,[{id:10,expired:true},{id:10,expired:false}])
  calls.length=0
  await sessionCheck.checkSession(['--lecture-id','10','--reset-session'],settings,ports)
  assert.equal(calls[0],'reset')
})

test('browser authentication uses randomized authenticated encryption bound to key and academy',()=>{
  const raw=env.DAECHION_BROWSER_STORAGE_STATE,cipher=sessionStore.sessionCipher('a'.repeat(48),'116')
  const first=cipher.encrypt(raw),second=cipher.encrypt(raw)
  assert.notEqual(first,second);assert.equal(cipher.decrypt(first),raw);assert.equal(first.includes('synthetic-only'),false)
  for(const other of [sessionStore.sessionCipher('b'.repeat(48),'116'),sessionStore.sessionCipher('a'.repeat(48),'117')])
    assert.throws(()=>other.decrypt(first),/^Error: CONTENT_SESSION_STORAGE_UNCONFIRMED$/)
  const broken=JSON.parse(first);broken.tag=Buffer.alloc(16).toString('base64')
  assert.throws(()=>cipher.decrypt(JSON.stringify(broken)),/^Error: CONTENT_SESSION_STORAGE_UNCONFIRMED$/)
})

test('real acceptance CLI is limited to explicit test targets and never enables normal runtime flags',async()=>{
  const argv=['--student-id','77','--lecture-id','10','--verify']
  const settings={...env,DAECHION_API_KEY:'synthetic',DAECHION_CONTENT_TEST_ONLY:'true',DAECHION_CONTENT_TEST_STUDENT_ID:'77',DAECHION_CONTENT_TEST_LECTURE_ID:'10',
    DAECHION_CONTENT_BROWSER_ENABLED:'false',DAECHION_CONTENT_BROWSER_VERIFIED:'false'}
  let calls=0
  const accessFactory=()=>({ensureFirstLessonAccess:async target=>{calls++;await target.beforeWrite();await target.recordEnrollment();return {...target,weeklyLectureIds:[target.weeklyLectureId],verified:true}}})
  for(const changes of [{DAECHION_CONTENT_TEST_ONLY:'false'},{DAECHION_CONTENT_TEST_STUDENT_ID:'78'},{DAECHION_CONTENT_TEST_LECTURE_ID:'11'}])
    await assert.rejects(contentVerify.verifyContent(argv,{...settings,...changes},{api,accessFactory}),/CONTENT_TEST_CONFIGURATION_REQUIRED/)
  await assert.rejects(contentVerify.verifyContent([],settings,{api,accessFactory}),/CONTENT_TEST_ARGUMENTS_REQUIRED/)
  assert.equal(calls,0)
  assert.deepEqual(await contentVerify.verifyContent(argv,settings,{api,accessFactory}),{testOnly:true,verified:true,studentId:77,lectureId:10,weeklyLectureCount:1})
  assert.equal(settings.DAECHION_CONTENT_BROWSER_ENABLED,'false');assert.equal(settings.DAECHION_CONTENT_BROWSER_VERIFIED,'false')
})

test('browser credentials and flags fail closed without launching a browser or exposing secrets',()=>{
  for(const settings of [{},{...env,DAECHION_CONTENT_BROWSER_ENABLED:'false'},{...env,DAECHION_CONTENT_BROWSER_VERIFIED:'false'}])
    assert.throws(()=>provider.browserAccessProvider(settings,api,{launch:()=>{throw Error('must not launch')}}),/CONTENT_BROWSER_DISABLED/)
  for(const state of ['secret-bad-json','{}','{"cookies":[],"origins":[]}',JSON.stringify({cookies:[{domain:'.evil.test',value:'secret'}],origins:[]})])
    assert.throws(()=>provider.storageState(state),/^Error: CONTENT_BROWSER_AUTH_REQUIRED$/)
})
test('identity, tenant, duplicate week labels and changed lecture targets stop before browser writes',async()=>{
  let launched=0
  const launch=async()=>{launched++;throw Error('not expected')}
  for(const changes of [
    {me:async()=>({tenantId:999})},
    {student:async()=>({id:999,name:input.studentName,studentPhoneNumber:input.studentPhone})},
    {student:async()=>({id:77,name:'동명이인 아님',studentPhoneNumber:input.studentPhone})},
    {student:async()=>({id:77,name:input.studentName,studentPhoneNumber:'01099999999'})},
    {lectures:async()=>[{id:10,opened:true,weeklyLectures:[{id:101,name:'차시 A'}]}]},
    {lectures:async()=>[{id:10,opened:true,weeklyLectures:[{id:100,name:'차시 A'},{id:101,name:'차시 A'}]}]},
  ])await assert.rejects(provider.browserAccessProvider(env,{...api,...changes},{launch}).ensureContentAccess(input),/^Error: CONTENT_ACCESS_UNCONFIRMED$/)
  assert.equal(launched,0)
})

// A real Chromium executes this synthetic UI contract in CI. Every page request
// is fulfilled locally; no vendor accounts, student data or network calls exist.
test('academy API authentication failure is reported before browser launch and without leaking upstream errors',async()=>{
  let launched=0
  for(const me of [async()=>({tenantId:999}),async()=>{throw Error('private upstream credentials')}]){
    const access=provider.browserAccessProvider(env,{...api,me},{launch:async()=>{launched++;throw Error('must not launch')}})
    await assert.rejects(access.refreshSession(),error=>error.stage==='API_PREFLIGHT'&&!error.message.includes('private'))
  }
  assert.equal(launched,0)
})
test('production BrowserServer launch/connect/close APIs terminate the owned Chromium process after a local refresh',
  {skip:process.env.DAECHION_BROWSER_FIXTURE_TEST!=='true',timeout:20000},async()=>{
  const {chromium}=require('../workers/daechion/browser/node_modules/playwright')
  let server,saves=0
  const ownedChromium={launchServer:async options=>{server=await chromium.launchServer(options);return server},
    connect:async(...args)=>{
      const browser=await chromium.connect(...args),newContext=browser.newContext.bind(browser)
      browser.newContext=async options=>{
        const context=await newContext(options),newPage=context.newPage.bind(context)
        context.newPage=async()=>{
          const page=await newPage()
          await page.route('**/*',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><h2>강의 관리</h2><button role="tab">강의 목록</button><a href="/crm/admin">관리자</a>'}))
          return page
        }
        return context
      }
      return browser
    }}
  const sessions={run:work=>work({state:env.DAECHION_BROWSER_STORAGE_STATE,signal:new AbortController().signal,assert:async()=>{},save:async()=>{saves++}})}
  try{
    const access=provider.browserAccessProvider(env,api,{chromium:ownedChromium,sessions})
    assert.deepEqual(await access.refreshSession(),{refreshed:true})
    assert.equal(saves,1)
    const child=server.process()
    assert.ok(child.exitCode!==null||child.signalCode!==null,'the owned browser process must exit before returning')
  }finally{if(server)await server.kill()}
})

test('academy health ignores deleted courses and empty catalogs, is read-only and rejects missing admin identity',
  {skip:process.env.DAECHION_BROWSER_FIXTURE_TEST!=='true',timeout:20000},async()=>{
  const {chromium}=require('../workers/daechion/browser/node_modules/playwright')
  for(const mode of ['empty','populated','login','wrong-route','button-only','wrong-admin']){
    let saves=0,clicks=-1
    const launch=async options=>{
      const browser=await chromium.launch(options);let page
      return {newContext:async settings=>{
        const context=await browser.newContext(settings)
        return {setDefaultTimeout:ms=>context.setDefaultTimeout(ms),route:(...args)=>context.route(...args),storageState:()=>context.storageState(),
          newPage:async()=>{
            page=await context.newPage();page.setDefaultTimeout(300)
            const name=mode==='login'?'로그인':'강의 관리'
            const tab=['login','button-only'].includes(mode)?'':'<button role="tab">강의 목록</button>'
            const admin=mode==='login'?'':`<a href="${mode==='wrong-admin'?'/student':'/crm/admin'}">관리자</a>`
            const html=`<!doctype html><meta charset="utf-8"><h2>${name}</h2>${tab}${admin}<p>진행 중 ${mode==='empty'?0:11}개</p>${mode==='button-only'?'<button>일괄 학생 추가</button>':''}<script>window.clicks=0;document.addEventListener('click',()=>window.clicks++)</script>`
            await page.route('**/*',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:html}))
            const goto=page.goto.bind(page)
            if(mode==='wrong-route')page.goto=()=>goto('https://parkkyojoon.daechion.com/student')
            return page
          }}
      },close:async()=>{if(page)clicks=await page.evaluate(()=>window.clicks);await browser.close()}}
    }
    const sessions={run:async run=>run({state:env.DAECHION_BROWSER_STORAGE_STATE,signal:new AbortController().signal,assert:async()=>{},save:async()=>{saves++}})}
    const independentApi={...api,lectures:async()=>{throw Error('Deleted QA course must not affect academy health')}}
    const access=provider.browserAccessProvider(env,independentApi,{launch,sessions})
    if(['empty','populated'].includes(mode)){
      assert.deepEqual(await access.refreshSession(mode==='empty'?undefined:6008507),{refreshed:true});assert.equal(saves,1)
    }else{
      await assert.rejects(access.refreshSession(),error=>error.stage==='SESSION_REFRESH');assert.equal(saves,0)
    }
    assert.equal(clicks,0)
  }
})

const fixture=`<!doctype html><meta charset="utf-8"><div id="app"></div><script>
const app=document.querySelector('#app'),path=location.pathname;
const row=(checked=false,wrong=false)=>'<table><tbody><tr><td><input type="checkbox" '+(checked?'checked':'')+'></td><td><p>'+(wrong?'다른학생':'검수학생')+'</p></td><td>010-0000-0001</td></tr></tbody></table>';
const button=(text,fn)=>{const b=document.createElement('button');b.textContent=text;b.onclick=fn;app.append(b);return b};
const modal=(heading,body)=>{const d=document.createElement('div');d.setAttribute('role','dialog');d.setAttribute('aria-label',heading);d.innerHTML='<h2>'+heading+'</h2>'+body;app.append(d);return d};
function grant(){const d=modal('권한 부여',${JSON.stringify(provider.ACCESS_LABELS)}.map(n=>'<label><input type="checkbox">'+n+'</label>').join('')+'<label><input type="checkbox" checked>직전 차시 출결 메모 불러오기</label>');const b=document.createElement('button');b.textContent='확인 Enter';b.onclick=()=>{if([...d.querySelectorAll('input')].slice(0,3).some(x=>!x.checked)||d.querySelectorAll('input')[3].checked)throw Error('Incorrect settings');localStorage.setItem('granted','yes');localStorage.setItem('writes',String(Number(localStorage.getItem('writes')||0)+1));d.remove()};d.append(b)}
function weeks(){const list=JSON.parse(localStorage.getItem('weeks')||'[{"id":100,"name":"차시 A"}]');const d=modal('차시 선택',list.map(w=>'<label><input type="checkbox" checked data-week="'+w.id+'">'+w.name+'</label>').join(''));const b=document.createElement('button');b.textContent='일괄 추가';b.onclick=()=>{localStorage.setItem('selectedWeeks',JSON.stringify([...d.querySelectorAll('input:checked')].map(x=>Number(x.dataset.week))));d.remove();grant()};d.append(b)}
function picker(){const d=modal('일괄 학생 추가','<input aria-label="검색어 입력 (초성 검색 가능)">'+row(false,localStorage.getItem('wrong')==='yes'));const b=document.createElement('button');b.textContent='1명 추가 Ctrl+Enter';b.onclick=()=>{if(!d.querySelector('input[type=checkbox]').checked)throw Error('No student selected');d.remove();weeks()};d.append(b)}
function singlePicker(){const d=modal('학생 추가','<button role="tab">기존 학생 추가</button><input aria-label="검색어 입력 (초성 검색 가능)">'+row(false));const b=document.createElement('button');b.textContent='1명 추가 Ctrl+Enter';b.onclick=()=>{if(!d.querySelector('input[type=checkbox]').checked)throw Error('No student selected');localStorage.setItem('selectedWeeks',JSON.stringify([Number(path.split('/').at(-2))]));d.remove();grant()};d.append(b)}
function file(title){const d=modal('상세 정보','<h3>'+title+'</h3>');const b=document.createElement('button');b.textContent='권한 관리';b.onclick=()=>{d.remove();const p=modal('파일 권한 부여','<input aria-label="검색어 입력 (초성 검색 가능)">'+row(localStorage.getItem('granted')==='yes'&&localStorage.getItem('missing')!=='yes'));const c=document.createElement('button');c.textContent='취소';c.onclick=()=>p.remove();p.append(c)};d.append(b)}
function collection(kind,library=false){app.querySelectorAll('[data-collection]').forEach(x=>x.remove());const d=document.createElement('div');d.setAttribute('data-collection','yes');if(library){d.innerHTML='<button>파일 추가하기</button><p>등록된 자료가 없어요.</p>'}else if(kind==='video'){d.innerHTML='<button>영상 추가</button><div data-row-index="0"><p>검수영상</p></div>';d.querySelector('p').onclick=()=>file('검수영상')}else{d.innerHTML='<button>파일 추가</button><table><tbody><tr>'+Array.from({length:9},(_,i)=>'<td>'+(i===2?'검수자료.pdf':'')+'</td>').join('')+'</tr></tbody></table>';d.querySelectorAll('td')[2].onclick=()=>file('검수자료.pdf')};app.append(d)}
if(path.endsWith('/participants')){if(localStorage.getItem('emptyCourse')==='yes'){const p=document.createElement('p');p.textContent='차시에서 수강생 추가가 가능해요.';app.append(p)}else button('일괄 학생 추가',picker);const b=button(localStorage.getItem('library')==='yes'?'강의 자료실 1개':'강의 자료실 0개',()=>collection('material',true));b.setAttribute('role','tab')}else if(path.endsWith('/attendance')){button(localStorage.getItem('wrongLesson')==='yes'?'다른 차시':'차시 A',()=>{});button('학생 추가하기',singlePicker)}else{for(const [name,kind] of [['영상','video'],['자료','material']]){const b=button(name,()=>collection(kind));b.setAttribute('role','tab')}}
</script>`

test('real browser grants only the selected student, clears attendance copying and verifies persisted video/material rights',
  {skip:process.env.DAECHION_BROWSER_FIXTURE_TEST!=='true',timeout:90000},async()=>{
  const {chromium}=require('../workers/daechion/browser/node_modules/playwright')
  for(const mode of ['success','wrong','missing','hold','identity-changed','library-nonempty']){
    let fences=0,writes=0,closed=false
    const launch=async options=>{
      const browser=await chromium.launch(options)
      return {newContext:async options=>{
        const context=await browser.newContext(options)
        const newPage=context.newPage.bind(context)
        context.newPage=async()=>{
          const page=await newPage()
          await page.addInitScript(({mode})=>{if(mode==='wrong')localStorage.setItem('wrong','yes');if(mode==='missing')localStorage.setItem('missing','yes');if(mode==='library-nonempty')localStorage.setItem('library','yes')},{mode})
          await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:fixture}))
          context.fixturePage=page
          return page
        }
        browser.fixtureContext=context
        return context
      },close:async()=>{
        if(closed)return;closed=true
        const page=browser.fixtureContext?.fixturePage
        if(page&&!page.isClosed())writes=await page.evaluate(()=>Number(localStorage.getItem('writes')||0))
        await browser.close()
      }}
    }
    let identityReads=0
    const guardedApi=mode==='identity-changed'?{...api,student:async()=>{
      const row=await api.student();return ++identityReads===1?row:{...row,studentPhoneNumber:'01099999999'}
    }}:api
    const service=provider.browserAccessProvider(env,guardedApi,{launch})
    const promise=service.ensureContentAccess({...input,beforeWrite:async()=>{fences++;if(mode==='hold'&&fences===2)throw Error('Hold')}})
    if(mode==='success'){assert.deepEqual(await promise,{verified:true,lectureId:10,studentId:77,weeklyLectureIds:[100]});assert.equal(writes,1);assert.equal(fences,2)}
    else {await assert.rejects(promise,/CONTENT_ACCESS_UNCONFIRMED/);assert.equal(writes,['missing','library-nonempty'].includes(mode)?1:0)}
    assert.equal(closed,true)
  }
})

test('first-lesson browser clears all later selections, keeps shared-library rights, and records enrollment before verification',
  {skip:process.env.DAECHION_BROWSER_FIXTURE_TEST!=='true',timeout:90000},async()=>{
  const {chromium}=require('../workers/daechion/browser/node_modules/playwright')
  // More than twenty course lessons are valid: only one is granted/verified.
  const weeks=[{id:900,name:'차시 A'},...Array.from({length:24},(_,i)=>({id:100+i,name:`후속 차시 ${i+2}`}))]
  for(const mode of ['success','wrong-ui-order','record-unknown']){
    let writes=0,recorded=0,selected=[],visited=[]
    const launch=async options=>{
      const browser=await chromium.launch(options);let context,page
      return {newContext:async options=>{
        context=await browser.newContext(options)
        const original=context.newPage.bind(context)
        context.newPage=async()=>{
          page=await original()
          await page.addInitScript(({weeks,mode})=>{localStorage.setItem('weeks',JSON.stringify(mode==='wrong-ui-order'?[weeks[1],weeks[0],...weeks.slice(2)]:weeks))},{weeks,mode})
          await page.route('**/*',route=>{
            const match=new URL(route.request().url()).pathname.match(/\/crm\/lectures\/10\/(\d+)$/)
            if(match)visited.push(Number(match[1]))
            return route.fulfill({contentType:'text/html',body:fixture})
          })
          return page
        }
        return context
      },close:async()=>{
        if(page&&!page.isClosed()){
          writes=await page.evaluate(()=>Number(localStorage.getItem('writes')||0))
          selected=await page.evaluate(()=>JSON.parse(localStorage.getItem('selectedWeeks')||'[]'))
        }
        await browser.close()
      }}
    }
    const service=provider.browserAccessProvider(env,{...api,lectures:async()=>[{id:10,opened:true,weeklyLectures:weeks}]},{launch})
    const promise=service.ensureFirstLessonAccess({studentId:77,lectureId:10,weeklyLectureId:900,studentName:input.studentName,studentPhone:input.studentPhone,
      enrollmentRecorded:false,beforeWrite:async()=>{},recordEnrollment:async()=>{recorded++;if(mode==='record-unknown')throw Error('Unknown DB acknowledgement')}})
    if(mode==='success'){
      assert.deepEqual(await promise,{verified:true,lectureId:10,studentId:77,weeklyLectureIds:[900]})
      assert.equal(recorded,1);assert.equal(writes,1);assert.deepEqual(selected,[900]);assert.ok(visited.length);assert.ok(visited.every(id=>id===900))
    }else{
      await assert.rejects(promise,/CONTENT_ACCESS_UNCONFIRMED/)
      assert.equal(writes,mode==='record-unknown'?1:0);assert.equal(recorded,mode==='record-unknown'?1:0);assert.deepEqual(visited,[])
    }
  }
})

test('first student of an empty course is added only to the pinned lesson with payment and acknowledgement fences',
  {skip:process.env.DAECHION_BROWSER_FIXTURE_TEST!=='true',timeout:90000},async()=>{
  const {chromium}=require('../workers/daechion/browser/node_modules/playwright')
  for(const mode of ['success','hold','wrong-lesson','record-unknown']){
    let writes=0,recorded=0,selected=[],visited=[]
    const launch=async options=>{
      const browser=await chromium.launch(options);let page
      return {newContext:async options=>{
        const context=await browser.newContext(options),original=context.newPage.bind(context)
        context.newPage=async()=>{
          page=await original()
          await page.addInitScript(mode=>{localStorage.setItem('emptyCourse','yes');if(mode==='wrong-lesson')localStorage.setItem('wrongLesson','yes')},mode)
          await page.route('**/*',route=>{
            visited.push(new URL(route.request().url()).pathname)
            return route.fulfill({contentType:'text/html',body:fixture})
          })
          return page
        };return context
      },close:async()=>{
        if(page&&!page.isClosed()){
          writes=await page.evaluate(()=>Number(localStorage.getItem('writes')||0))
          selected=await page.evaluate(()=>JSON.parse(localStorage.getItem('selectedWeeks')||'[]'))
        };await browser.close()
      }}
    }
    const service=provider.browserAccessProvider(env,{...api,lectures:async()=>[{id:10,opened:true,weeklyLectures:[{id:100,name:'차시 A'},{id:200,name:'후속 차시'}]}]},{launch})
    const result=service.ensureFirstLessonAccess({studentId:77,lectureId:10,weeklyLectureId:100,studentName:input.studentName,studentPhone:input.studentPhone,
      enrollmentRecorded:false,beforeWrite:async()=>{if(mode==='hold')throw Error('Hold')},recordEnrollment:async()=>{recorded++;if(mode==='record-unknown')throw Error('Unknown acknowledgement')}})
    if(mode==='success')assert.deepEqual(await result,{verified:true,lectureId:10,studentId:77,weeklyLectureIds:[100]})
    else await assert.rejects(result,/CONTENT_ACCESS_UNCONFIRMED/)
    assert.equal(writes,['success','record-unknown'].includes(mode)?1:0)
    assert.equal(recorded,['success','record-unknown'].includes(mode)?1:0)
    assert.deepEqual(selected,['success','record-unknown'].includes(mode)?[100]:[])
    assert.ok(visited.includes('/crm/lectures/10/100/attendance'))
    assert.ok(visited.every(path=>!path.includes('/200')))
  }
})

test('file verification waits for delayed saved permissions without checking or saving them',
  {skip:process.env.DAECHION_BROWSER_FIXTURE_TEST!=='true',timeout:20000},async()=>{
  const {chromium}=require('../workers/daechion/browser/node_modules/playwright')
  const browser=await chromium.launch({headless:true})
  try{
    const page=await browser.newPage()
    await page.route('**/*',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><meta charset="utf-8"><p>검수파일</p><button onclick="document.querySelector('#rights').hidden=false">권한 관리</button><div id="rights" role="dialog" hidden><h6>파일 권한 부여</h6><input aria-label="검색어 입력 (초성 검색 가능)"><table><tr><td><input id="permission" type="checkbox" onchange="window.edited=true"></td><td>검수학생</td><td>010-0000-0001</td></tr></table><button onclick="window.saved=true">저장</button><button onclick="document.querySelector('#rights').hidden=true">취소</button></div><script>document.querySelector('button').addEventListener('click',()=>setTimeout(()=>document.querySelector('#permission').checked=true,500))</script>`}))
    await page.goto('https://parkkyojoon.daechion.com/crm/lectures/10/participants')
    await provider.verifyFile(page,'검수파일',input)
    assert.deepEqual(await page.evaluate(()=>({saved:!!window.saved,edited:!!window.edited,selected:document.querySelector('#permission').checked,closed:document.querySelector('#rights').hidden})),{saved:false,edited:false,selected:true,closed:true})
  }finally{await browser.close()}
})

test('empty weekly collections require their loaded empty control and explicit placeholder',
  {skip:process.env.DAECHION_BROWSER_FIXTURE_TEST!=='true',timeout:45000},async()=>{
  const {chromium}=require('../workers/daechion/browser/node_modules/playwright')
  const browser=await chromium.launch({headless:true})
  try{
    for(const kind of ['video','material'])for(const mode of ['empty','missing-placeholder','contradictory','short-control']){
      const page=await browser.newPage()
      const label=kind==='video'?'영상':'파일',tab=kind==='video'?'영상':'자료'
      const placeholder=kind==='video'?'영상을 끌어서 업로드해주세요.':'자료를 끌어서 업로드해주세요.'
      const row=kind==='video'?'<div data-row-index="0"><p>검수파일</p></div>':'<table><tr>'+Array.from({length:9},(_,i)=>'<td>'+(i===2?'검수파일':'')+'</td>').join('')+'</tr></table>'
      await page.route('**/*',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><meta charset="utf-8"><button role="tab">${tab}</button><button>${label} 추가${mode==='short-control'?'':'하기'}</button>${mode==='missing-placeholder'?'':'<p>'+placeholder+'</p>'}${mode==='contradictory'?row:''}`}))
      const result=provider.verifyCollection(page,'https://parkkyojoon.daechion.com/crm/lectures/10/100',tab,kind,input)
      if(mode==='empty')assert.equal(await result,0)
      else await assert.rejects(result,/CONTENT_ACCESS_UNCONFIRMED/)
      await page.close()
    }
  }finally{await browser.close()}
})

test('nonempty library checks every category and file without saving permission lists',
  {skip:process.env.DAECHION_BROWSER_FIXTURE_TEST!=='true',timeout:90000},async()=>{
  const {chromium}=require('../workers/daechion/browser/node_modules/playwright')
  const browser=await chromium.launch({headless:true})
  try{
    for(const mode of ['success','missing','duplicate','changed']){
      const context=await browser.newContext(),page=await context.newPage()
      await page.route('**/*',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><meta charset="utf-8"><div id="app"></div><script>
        const mode=${JSON.stringify(mode)},app=document.querySelector('#app');
        const button=(name,fn,parent=app)=>{const b=document.createElement('button');b.textContent=name;b.onclick=fn;parent.append(b);return b};
        const names=['자습용 자료','손필기 자료','암기자료'];
        function file(title){const d=document.createElement('div');d.innerHTML='<h3>'+title+'</h3>';app.append(d);button('권한 관리',()=>{
          d.remove();const p=document.createElement('div');p.setAttribute('role','dialog');p.innerHTML='<h6>파일 권한 부여</h6><input aria-label="검색어 입력 (초성 검색 가능)"><table><tr><td><input type="checkbox" '+(mode==='missing'&&title==='자료B'?'':'checked')+'></td><td>검수학생</td><td>010-0000-0001</td></tr></table>';
          button('취소',()=>{p.remove();if(mode==='changed')localStorage.setItem('changed','yes')},p);button('저장',()=>localStorage.setItem('writes','yes'),p);app.append(p);
        },d)}
        function category(i){app.querySelector('[data-files]')?.remove();const d=document.createElement('div');d.setAttribute('data-files','yes');app.append(d);
          if(i===2){d.innerHTML='<p>등록된 자료가 없어요.</p><button>파일 추가하기</button>';return}
          const title=i===0?(localStorage.getItem('changed')==='yes'?'바뀐자료':'자료A'):'자료B';
          d.innerHTML='<h6>'+names[i]+'</h6><button>업로드</button><table><tbody>'+Array.from({length:mode==='duplicate'?2:1},()=>'<tr>'+Array.from({length:9},(_,j)=>'<td>'+(j===2?title:'')+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
          d.querySelectorAll('td:nth-child(3)').forEach(c=>c.onclick=()=>file(title));
        }
        button('강의 자료실 '+(mode==='duplicate'?4:2)+'개',()=>{
          names.forEach((name,i)=>button(name+' '+(i===2?0:mode==='duplicate'?2:1)+'개',()=>category(i)));category(0)
        }).setAttribute('role','tab');
      </script>`}))
      const result=provider.verifyLibrary(page,'https://parkkyojoon.daechion.com/crm/lectures/10/participants',input)
      if(mode==='success')assert.equal(await result,2)
      else await assert.rejects(result,/CONTENT_ACCESS_UNCONFIRMED/)
      assert.equal(await page.evaluate(()=>localStorage.getItem('writes')),null)
      await context.close()
    }
  }finally{await browser.close()}
})

test('real browser captures refreshed credentials and a cold provider reloads them without participant actions',
  {skip:process.env.DAECHION_BROWSER_FIXTURE_TEST!=='true',timeout:45000},async()=>{
  const {chromium}=require('../workers/daechion/browser/node_modules/playwright')
  const old=fixtureToken(Math.floor(Date.now()/1000)+600),fresh=fixtureToken(Math.floor(Date.now()/1000)+3600)
  const settings={...env,DAECHION_CONTENT_TEST_ONLY:'true',DAECHION_CONTENT_TEST_LECTURE_ID:'10',DAECHION_BROWSER_STORAGE_STATE:JSON.stringify({cookies:[],origins:[{origin:'https://parkkyojoon.daechion.com',localStorage:[{name:'auth',value:old}]}]})}
  let saved=settings.DAECHION_BROWSER_STORAGE_STATE,saves=0,contexts=0
  const sessions={run:async work=>work({state:saved,signal:new AbortController().signal,assert:async()=>{},save:async value=>{saved=value;saves++}})}
  const launch=async options=>{
    const browser=await chromium.launch(options)
    return {newContext:async options=>{
      contexts++
      if(contexts===1)assert.equal(tokenState.accessExpiry(JSON.stringify(options.storageState)),1)
      else assert.equal(options.storageState.origins[0].localStorage.find(item=>item.name==='auth').value,fresh,'saved token is reloaded')
      const context=await browser.newContext(options),newPage=context.newPage.bind(context)
      context.newPage=async()=>{
        const page=await newPage()
          await page.route('**/*',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><h2>강의 관리</h2><button role="tab">강의 목록</button><a href="/crm/admin">관리자</a><script>localStorage.setItem("auth",'+JSON.stringify(fresh)+');</script>'}))
        browser.fixturePage=page;return page
      }
      return context
    },close:async()=>{if(browser.fixturePage&&!browser.fixturePage.isClosed())assert.equal(await browser.fixturePage.evaluate(()=>window.actions??0),0);await browser.close()}}
  }
  const first=provider.browserAccessProvider(settings,api,{launch,sessions})
  assert.deepEqual(await first.refreshSession(10,{exerciseExpiredAccess:true}),{refreshed:true,expiredAccessExercised:true})
  const restarted=provider.browserAccessProvider(settings,api,{launch,sessions})
  assert.deepEqual(await restarted.refreshSession(10),{refreshed:true})
  assert.equal(saves,2);assert.equal(contexts,2);assert.equal(settings.DAECHION_BROWSER_STORAGE_STATE.includes(old),true)
})
