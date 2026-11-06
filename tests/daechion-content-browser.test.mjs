import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import provider from '../workers/daechion/browser/provider.cjs'
const require=createRequire(import.meta.url)
const env={DAECHION_CONTENT_BROWSER_ENABLED:'true',DAECHION_CONTENT_BROWSER_VERIFIED:'true',DAECHION_TENANT_ID:'116',
  DAECHION_BROWSER_STORAGE_STATE:JSON.stringify({cookies:[],origins:[{origin:'https://parkkyojoon.daechion.com',localStorage:[{name:'fixture',value:'synthetic-only'}]}]})}
const input={studentId:77,lectureId:10,weeklyLectureIds:[100],studentName:'검수학생',studentPhone:'01000000001',beforeWrite:async()=>{}}
const api={me:async()=>({tenantId:116}),student:async()=>({id:77,name:'검수학생',studentPhoneNumber:'010-0000-0001',active:false}),
  students:async()=>[{id:77}],
  lectures:async()=>[{id:10,name:'같은 이름',opened:true,weeklyLectures:[{id:100,name:'차시 A'}]}]}

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
const fixture=`<!doctype html><meta charset="utf-8"><div id="app"></div><script>
const app=document.querySelector('#app'),path=location.pathname;
const row=(checked=false,wrong=false)=>'<table><tbody><tr><td><input type="checkbox" '+(checked?'checked':'')+'></td><td><p>'+(wrong?'다른학생':'검수학생')+'</p></td><td>010-0000-0001</td></tr></tbody></table>';
const button=(text,fn)=>{const b=document.createElement('button');b.textContent=text;b.onclick=fn;app.append(b);return b};
const modal=(heading,body)=>{const d=document.createElement('div');d.setAttribute('role','dialog');d.setAttribute('aria-label',heading);d.innerHTML='<h2>'+heading+'</h2>'+body;app.append(d);return d};
function grant(){const d=modal('권한 부여',${JSON.stringify(provider.ACCESS_LABELS)}.map(n=>'<label><input type="checkbox">'+n+'</label>').join('')+'<label><input type="checkbox" checked>직전 차시 출결 메모 불러오기</label>');const b=document.createElement('button');b.textContent='확인 Enter';b.onclick=()=>{if([...d.querySelectorAll('input')].slice(0,3).some(x=>!x.checked)||d.querySelectorAll('input')[3].checked)throw Error('Incorrect settings');localStorage.setItem('granted','yes');localStorage.setItem('writes',String(Number(localStorage.getItem('writes')||0)+1));d.remove()};d.append(b)}
function weeks(){const d=modal('차시 선택','<label><input type="checkbox" checked>차시 A</label>');const b=document.createElement('button');b.textContent='일괄 추가';b.onclick=()=>{d.remove();grant()};d.append(b)}
function picker(){const d=modal('일괄 학생 추가','<input aria-label="검색어 입력 (초성 검색 가능)">'+row(false,localStorage.getItem('wrong')==='yes'));const b=document.createElement('button');b.textContent='1명 추가 Ctrl+Enter';b.onclick=()=>{if(!d.querySelector('input[type=checkbox]').checked)throw Error('No student selected');d.remove();weeks()};d.append(b)}
function file(title){const d=modal('상세 정보','<h3>'+title+'</h3>');const b=document.createElement('button');b.textContent='권한 관리';b.onclick=()=>{d.remove();const p=modal('파일 권한 부여','<input aria-label="검색어 입력 (초성 검색 가능)">'+row(localStorage.getItem('granted')==='yes'&&localStorage.getItem('missing')!=='yes'));const c=document.createElement('button');c.textContent='취소';c.onclick=()=>p.remove();p.append(c)};d.append(b)}
function collection(kind,library=false){app.querySelectorAll('[data-collection]').forEach(x=>x.remove());const d=document.createElement('div');d.setAttribute('data-collection','yes');if(library){d.innerHTML='<button>파일 추가</button><table><tbody></tbody></table>'}else if(kind==='video'){d.innerHTML='<button>영상 추가</button><div data-row-index="0"><p>검수영상</p></div>';d.querySelector('p').onclick=()=>file('검수영상')}else{d.innerHTML='<button>파일 추가</button><table><tbody><tr>'+Array.from({length:9},(_,i)=>'<td>'+(i===2?'검수자료.pdf':'')+'</td>').join('')+'</tr></tbody></table>';d.querySelectorAll('td')[2].onclick=()=>file('검수자료.pdf')};app.append(d)}
if(path.endsWith('/participants')){button('일괄 학생 추가',picker);const b=button('강의 자료실 0개',()=>collection('material',true));b.setAttribute('role','tab')}else{for(const [name,kind] of [['영상','video'],['자료','material']]){const b=button(name,()=>collection(kind));b.setAttribute('role','tab')}}
</script>`

test('real browser grants only the selected student, clears attendance copying and verifies persisted video/material rights',
  {skip:process.env.DAECHION_BROWSER_FIXTURE_TEST!=='true',timeout:90000},async()=>{
  const {chromium}=require('../workers/daechion/browser/node_modules/playwright')
  for(const mode of ['success','wrong','missing','hold','identity-changed']){
    let fences=0,writes=0,closed=false
    const launch=async options=>{
      const browser=await chromium.launch(options)
      return {newContext:async options=>{
        const context=await browser.newContext(options)
        const newPage=context.newPage.bind(context)
        context.newPage=async()=>{
          const page=await newPage()
          await page.addInitScript(({mode})=>{if(mode==='wrong')localStorage.setItem('wrong','yes');if(mode==='missing')localStorage.setItem('missing','yes')},{mode})
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
    else {await assert.rejects(promise,/CONTENT_ACCESS_UNCONFIRMED/);assert.equal(writes,mode==='missing'?1:0)}
    assert.equal(closed,true)
  }
})
