// Explicit local UI regression: temporary catalog, synthetic responses, no provider access.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {once} from 'node:events'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'

if(process.argv.slice(2).join(' ')!=='--local-only')throw Error('Explicit --local-only required')
const root=fileURLToPath(new URL('../',import.meta.url)),dir=await mkdtemp(path.join(tmpdir(),'pkjmath-catalog-ui-'))
const product={id:'fixture',name:'저장 보호 검수',visible:true,purchaseProcess:'PROCESS_1',category:'수리논술',badge:'',image:null,
  description:'',duration:'',keywords:['','',''],modes:{online:{enabled:true,price:900,campuses:[]},offline:{enabled:false,price:0,campuses:[]}},
  textbook:{included:false,price:0},createdAt:'2026-11-15T00:00:00Z',updatedAt:'2026-11-15T00:00:00Z'}
await writeFile(path.join(dir,'classes.json'),JSON.stringify([product]))
const reservation=createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening')
const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve))
const origin=`http://127.0.0.1:${port}`
const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{
  cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,NODE_ENV:'production',DATA_DIR:dir,
    ADMIN_PASSWORD:'disposable-catalog-ui',ADMIN_SECRET:'disposable-catalog-ui-session',
    DAECHION_DATABASE_URL:'',LECTURES_DATABASE_URL:'',DAECHION_ORDERS_ENABLED:'false',DAECHION_ADMIN_ENABLED:'false',
    DAECHION_API_KEY:'',PAYSSAM_API_KEY:'',SOLAPI_API_KEY:'',GOOGLE_SERVICE_ACCOUNT_JSON:''}})
let browser,startError;child.on('error',error=>{startError=error})
try{
  let ready=false
  for(let n=0;n<100;n++){
    if(startError)throw startError
    if(child.exitCode!==null)throw Error('LOCAL_SERVER_STOPPED')
    try{const response=await fetch(origin+'/api/classes',{signal:AbortSignal.timeout(500)});if(response.ok){await response.arrayBuffer();ready=true;break}}catch{}
    await new Promise(resolve=>setTimeout(resolve,100))
  }
  assert.ok(ready)
  const require=createRequire(import.meta.url)
  browser=await require('../workers/daechion/browser/node_modules/playwright').chromium.launch({headless:true,channel:'chrome'})
  const context=await browser.newContext()
  await context.addCookies([{name:'admin_session',value:'disposable-catalog-ui-session',url:origin}])
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort())
  const page=await context.newPage()
  let unavailable=true,reads=0,writes=0
  const failure={error:'수업 데이터를 읽거나 저장하지 못했습니다. 관리자에게 확인을 요청해주세요.',code:'CATALOG_UNAVAILABLE'}
  await page.route('**/api/admin/classes',route=>{
    reads++
    return route.fulfill(unavailable?{status:503,json:failure}:{json:[product],headers:{'X-Catalog-Revision':'a'.repeat(64)}})
  })
  await page.route('**/api/admin/classes/fixture',route=>{writes++;unavailable=true;return route.fulfill({status:503,json:failure})})
  await page.goto(origin+'/admin/classes')
  await page.getByRole('button',{name:'목록 다시 불러오기',exact:true}).waitFor()
  assert.equal(await page.getByRole('button',{name:'+ 수업 추가',exact:true}).isDisabled(),true)
  assert.equal(await page.getByText('등록된 수업이 없습니다.',{exact:true}).count(),0)
  unavailable=false
  await page.getByRole('button',{name:'목록 다시 불러오기',exact:true}).click()
  await page.getByRole('button',{name:'수정',exact:true}).waitFor()
  assert.equal(await page.getByRole('button',{name:'+ 수업 추가',exact:true}).isEnabled(),true)
  await page.getByRole('button',{name:'수정',exact:true}).click()
  await page.getByLabel('수업명',{exact:true}).fill('입력 내용 보존')
  await page.getByRole('button',{name:'저장',exact:true}).click()
  await page.getByRole('button',{name:'목록 다시 불러오기',exact:true}).waitFor()
  assert.equal(await page.getByLabel('수업명',{exact:true}).inputValue(),'입력 내용 보존')
  assert.equal(await page.getByRole('button',{name:'저장',exact:true}).isDisabled(),true)
  assert.equal(writes,1)
  unavailable=false
  await page.getByRole('button',{name:'목록 다시 불러오기',exact:true}).click()
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='저장').disabled)
  assert.equal(await page.getByLabel('수업명',{exact:true}).inputValue(),'입력 내용 보존')
  assert.equal(writes,1);assert.ok(reads>=3)
  let publicReads=0
  await page.route('**/api/classes',route=>{publicReads++;return route.fulfill(publicReads===1?{status:503,json:failure}:{json:[product]})})
  await page.goto(origin+'/classes')
  await page.getByRole('button',{name:/다시 시도/}).click()
  await page.getByText(product.name,{exact:true}).first().waitFor()
  assert.equal(publicReads,2)
  console.log('Catalog UI regression passed: unavailable/read retry/save guard/form preservation/public retry.')
}finally{
  if(browser)await browser.close()
  if(child.exitCode===null){const stopped=once(child,'exit');child.kill();await stopped}
  const absolute=path.resolve(dir)
  assert.equal(path.dirname(absolute),path.resolve(tmpdir()));assert.ok(path.basename(absolute).startsWith('pkjmath-catalog-ui-'))
  await rm(absolute,{recursive:true,force:true,maxRetries:5,retryDelay:100})
}
