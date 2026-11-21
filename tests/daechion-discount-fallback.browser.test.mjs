// Temporary loopback web server and fresh headless browser only. Order APIs
// use synthetic page.route responses; no production/provider connection occurs.
import test from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {once} from 'node:events'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'

const enabled=process.env.DAECHION_DISCOUNT_BROWSER_TEST==='true'
const apiPattern=/\/api\/daechion\/orders(?:\/(?:catalog|cart|quotes))?(?:\?.*)?$/
const products=[
  {productId:'single-a',title:'가상 개별 강의 A',saleKind:'SINGLE',priceWon:12900,lectureCount:1},
  {productId:'single-b',title:'가상 개별 강의 B',saleKind:'SINGLE',priceWon:18500,lectureCount:1},
  {productId:'bundle',title:'가상 파이널 묶음',saleKind:'BUNDLE',priceWon:25000,lectureCount:2},
]
const rules={'single-a':{LIVE2026:10000,WELCOME2026:11000},bundle:{LIVE2026:20000}}
const invalidCode={code:'DISCOUNT_NOT_APPLICABLE',error:'선택한 상품에 적용 가능한 할인코드가 아닙니다. 코드를 확인하거나 해제해주세요.'}
const noticeText='입력한 할인코드는 선택한 상품에 적용되지 않아 할인 없이 계산합니다. 정상가를 확인한 뒤 신청해주세요.'
const requestButton=page=>page.getByRole('button',{name:'신청 내용 확인',exact:true})
const finalButton=page=>page.getByRole('button',{name:'강의 구매 신청',exact:true})
const finalCheck=page=>page.getByRole('checkbox',{name:'위 상품과 최종 금액을 확인했습니다.',exact:true})
const paymentCheck=page=>page.getByRole('checkbox',{name:/선택한 상품과/})
const notice=page=>page.getByRole('status',{name:'할인코드 안내',exact:true})
const input=(page,name)=>page.locator(`input[name="${name}"]`)
const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
function cart(body){
  const selected=products.filter(p=>body.items.some(i=>i.productId===p.productId)),code=body.discountCode??''
  const items=selected.map(({productId,title,priceWon})=>({productId,title,priceWon:rules[productId]?.[code]??priceWon,regularPriceWon:priceWon}))
  if(code&&!items.some(item=>item.priceWon<item.regularPriceWon))return {status:409,body:invalidCode}
  const conflict=selected.some(p=>p.productId==='single-a')&&selected.some(p=>p.productId==='bundle')
  const regularTotalWon=items.reduce((total,item)=>total+item.regularPriceWon,0),totalWon=items.reduce((total,item)=>total+item.priceWon,0)
  return {status:conflict?409:200,body:{status:conflict?'CART_CONFLICT':'READY',totalWon,items,
    ...(code?{discountCode:code,regularTotalWon,discountWon:regularTotalWon-totalWon}:{}),
    conflicts:conflict?[{lectureId:101,lectureName:'가상 강의 A',productIds:['single-a','bundle'],productTitles:['가상 개별 강의 A','가상 파이널 묶음']}]:[]}}
}
async function until(check,message='Expected operation',timeout=10000){
  const deadline=Date.now()+timeout
  while(!check()){if(Date.now()>deadline)throw Error(message);await new Promise(resolve=>setTimeout(resolve,15))}
}
async function ready(page){
  await requestButton(page).waitFor()
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='신청 내용 확인')?.disabled)
}
async function apply(page,code){await page.getByRole('textbox',{name:'할인코드',exact:true}).fill(code);await page.getByRole('button',{name:'적용',exact:true}).click()}
async function fill(page){
  await page.getByRole('checkbox',{name:'신규 수강생',exact:true}).check()
  await page.getByRole('radio',{name:'학생 본인',exact:true}).check()
  await input(page,'studentName').fill('가상할인검수학생')
  await input(page,'studentPhone').fill('010-0000-1234')
  await input(page,'payerPhone').fill('010-0000-2345')
  await paymentCheck(page).check()
  await page.getByRole('checkbox',{name:/신청·결제·수강 등록을 위한/}).check()
}
async function quote(f){
  await ready(f.page);await fill(f.page)
  f.page.once('dialog',dialog=>dialog.accept());await requestButton(f.page).click()
  await f.page.getByRole('region',{name:'최종 신청 확인',exact:true}).waitFor()
}
async function complete(f,total){
  await finalCheck(f.page).check();await finalButton(f.page).click()
  await f.page.getByRole('heading',{name:'신청이 접수되었습니다.',exact:true}).waitFor()
  assert.equal(f.calls.orders.length,1);assert.equal(f.calls.orders[0].expectedTotalWon,total)
}

test('discount rejection restores a verified regular-price checkout without weakening other checks',{
  skip:!enabled,timeout:180000,
},async t=>{
  const root=fileURLToPath(new URL('../',import.meta.url)),directory=await mkdtemp(path.join(tmpdir(),'pkjmath-discount-fallback-'))
  await writeFile(path.join(directory,'classes.json'),'[]')
  const reservation=createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening')
  const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve))
  const origin=`http://127.0.0.1:${port}`
  const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{
    cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',DATA_DIR:directory,NODE_OPTIONS:'',
      ADMIN_PASSWORD:'',ADMIN_SECRET:'',DAECHION_DATABASE_URL:'',LECTURES_DATABASE_URL:'',DAECHION_API_KEY:'',
      DAECHION_ORDERS_ENABLED:'false',DAECHION_INTAKE_ENABLED:'false',DAECHION_ADMIN_ENABLED:'false',DAECHION_PAYSSAM_CALLBACK_ENABLED:'false',
      DAECHION_BILLING_SEND_ENABLED:'false',DAECHION_ENROLLMENT_ENABLED:'false',DAECHION_READY_MESSAGE_ENABLED:'false',DAECHION_PAYMENT_READ_ENABLED:'false',DAECHION_SHEETS_ENABLED:'false',
      DAECHION_ORDER_WORKER_ENABLED:'false',DAECHION_ORDER_SEND_ENABLED:'false',DAECHION_ORDER_PAYMENT_READ_ENABLED:'false',DAECHION_ORDER_ENROLLMENT_ENABLED:'false',
      PAYSSAM_API_KEY:'',PAYSSAM_MEMBER:'',PAYSSAM_MERCHANT:'',SOLAPI_API_KEY:'',SOLAPI_API_SECRET:'',GOOGLE_SERVICE_ACCOUNT_JSON:'',GOOGLE_SHEET_ID:''}})
  let serverError,output='',browser
  server.on('error',error=>{serverError=error})
  for(const stream of [server.stdout,server.stderr])stream.on('data',bytes=>{output=(output+bytes.toString()).slice(-2000)})
  const results=[]
  async function fixture(options={}){
    const context=await browser.newContext(options.mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{})
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort())
    const page=await context.newPage(),calls={catalog:[],cart:[],quotes:[],orders:[]},handlers={...options.handlers}
    const f={page,context,calls,handlers,close:()=>context.close()}
    await page.route(apiPattern,async route=>{
      const key=new URL(route.request().url()).pathname.split('/').at(-1),body=route.request().method()==='POST'?route.request().postDataJSON():null
      calls[key].push(body)
      if(handlers[key])return handlers[key](route,body,f)
      if(key==='catalog')return json(route,{available:true,products})
      if(key==='cart'){const response=cart(body);return json(route,response.body,response.status)}
      if(key==='quotes'){
        const response=cart(body);if(response.status!==200)return json(route,response.body,response.status)
        assert.equal(body.expectedTotalWon,response.body.totalWon,'Quote must use the newest server-computed amount')
        return json(route,{...response.body,status:'READY',quoteId:randomUUID(),quoteToken:'a'.repeat(64),expiresAt:new Date((await page.evaluate(()=>Date.now()))+600000).toISOString(),excluded:[],reasons:[]})
      }
      return json(route,{status:'RECEIVED',orderId:randomUUID(),created:true,reviewRequired:false})
    })
    await page.goto(origin+'/classes/cart?productId='+(options.productId??'single-a'))
    return f
  }
  async function scenario(name,run){
    if(process.env.DAECHION_DISCOUNT_BROWSER_CASE&&!name.includes(process.env.DAECHION_DISCOUNT_BROWSER_CASE))return
    await t.test(name,async()=>{try{await run();results.push({name,result:'passed'})}catch(error){results.push({name,result:'failed'});throw error}})
  }
  async function expectFallback(f){await notice(f.page).waitFor();assert.equal(await notice(f.page).innerText(),noticeText);await ready(f.page);assert.equal(await paymentCheck(f.page).isChecked(),false)}
  try{
    let started=false
    for(let n=0;n<150;n++){
      if(serverError)throw serverError
      if(server.exitCode!==null)throw Error('LOCAL_NEXT_START_FAILED: '+output)
      try{const response=await fetch(origin+'/api/classes',{signal:AbortSignal.timeout(500)});if(response.ok){await response.arrayBuffer();started=true;break}}catch{}
      await new Promise(resolve=>setTimeout(resolve,100))
    }
    assert.ok(started,'Fresh local Next production build must start')
    const channel=process.env.DAECHION_BROWSER_CHANNEL||(process.platform==='win32'?'chrome':undefined)
    browser=await createRequire(import.meta.url)('../workers/daechion/browser/node_modules/playwright').chromium.launch({headless:true,...(channel?{channel}:{})})

    await scenario('unknown code restores regular pricing and completes a normal order',async()=>{
      const f=await fixture()
      try{
        await ready(f.page);await fill(f.page);await apply(f.page,'PKJ20261119');await expectFallback(f)
        assert.ok(f.calls.cart.some(c=>c.discountCode==='PKJ20261119'));assert.equal(f.calls.cart.at(-1).discountCode,'')
        assert.equal(await input(f.page,'studentName').inputValue(),'가상할인검수학생')
        await requestButton(f.page).click();assert.equal(f.calls.quotes.length,0)
        await quote(f);assert.equal(f.calls.quotes.at(-1).discountCode,'');assert.equal(f.calls.quotes.at(-1).expectedTotalWon,12900)
        await complete(f,12900)
      }finally{await f.close()}
    })
    await scenario('malformed code clears an existing discount without sending malformed data',async()=>{
      const f=await fixture()
      try{
        await ready(f.page);await apply(f.page,'LIVE2026');await ready(f.page);await fill(f.page)
        await apply(f.page,'잘못된 코드?');await expectFallback(f)
        assert.ok(f.calls.cart.every(c=>c.discountCode!=='잘못된 코드?'))
        await quote(f);assert.equal(f.calls.quotes.at(-1).discountCode,'');assert.equal(f.calls.quotes.at(-1).expectedTotalWon,12900)
      }finally{await f.close()}
    })
    await scenario('malformed code entered twice from regular pricing rechecks the price each time',async()=>{
      const f=await fixture()
      try{
        await ready(f.page);await fill(f.page);const before=f.calls.cart.length
        for(const [index,code] of ['잘못된 코드?','다른 잘못된 코드?'].entries()){
          await apply(f.page,code);await expectFallback(f);await until(()=>f.calls.cart.length===before+index+1)
          assert.equal(f.calls.cart.at(-1).discountCode,'');assert.ok(f.calls.cart.every(c=>c.discountCode===''))
        }
        await quote(f);assert.equal(f.calls.quotes.at(-1).discountCode,'');assert.equal(f.calls.quotes.at(-1).expectedTotalWon,12900)
      }finally{await f.close()}
    })
    await scenario('invalid replacement invalidates the discounted quote and requires regular-price consent',async()=>{
      const f=await fixture()
      try{
        await ready(f.page);await apply(f.page,' live2026 ');await ready(f.page);await quote(f)
        assert.equal(f.calls.quotes.at(-1).discountCode,'LIVE2026');assert.equal(f.calls.quotes.at(-1).expectedTotalWon,10000)
        await finalCheck(f.page).check();await apply(f.page,'UNKNOWN2026');await expectFallback(f)
        assert.equal(await f.page.getByRole('region',{name:'최종 신청 확인',exact:true}).count(),0)
        await quote(f);assert.equal(f.calls.quotes.at(-1).discountCode,'');assert.equal(f.calls.quotes.at(-1).expectedTotalWon,12900)
        assert.equal(await finalCheck(f.page).isChecked(),false);assert.equal(f.calls.orders.length,0)
      }finally{await f.close()}
    })
    await scenario('partially applicable code discounts only eligible items',async()=>{
      const f=await fixture()
      try{
        await ready(f.page);await f.page.getByRole('checkbox',{name:/가상 개별 강의 B/}).check();await ready(f.page)
        await apply(f.page,'LIVE2026');await ready(f.page)
        await f.page.getByRole('status').filter({hasText:'적용 코드: LIVE2026'}).waitFor();assert.equal(await notice(f.page).count(),0)
        await quote(f);assert.equal(f.calls.quotes.at(-1).discountCode,'LIVE2026');assert.equal(f.calls.quotes.at(-1).expectedTotalWon,28500)
        const section=f.page.getByRole('region',{name:'최종 신청 확인',exact:true});assert.match(await section.innerText(),/10,000원/);assert.match(await section.innerText(),/18,500원/)
        await complete(f,28500)
      }finally{await f.close()}
    })
    await scenario('removing the last eligible item clears the code and requotes the other item normally',async()=>{
      const f=await fixture()
      try{
        await ready(f.page);await f.page.getByRole('checkbox',{name:/가상 개별 강의 B/}).check();await ready(f.page)
        await apply(f.page,'LIVE2026');await ready(f.page);await fill(f.page)
        await f.page.getByRole('checkbox',{name:/가상 개별 강의 A/}).uncheck();await expectFallback(f)
        await quote(f);const request=f.calls.quotes.at(-1);assert.deepEqual(request.items,[{productId:'single-b'}]);assert.equal(request.discountCode,'');assert.equal(request.expectedTotalWon,18500)
      }finally{await f.close()}
    })
    await scenario('code deleted before quoting returns to a fresh regular-price confirmation',async()=>{
      const f=await fixture({handlers:{quotes:(route,body,f)=>{
        if(body.discountCode)return json(route,invalidCode,409)
        const response=cart(body);assert.equal(body.expectedTotalWon,response.body.totalWon)
        return json(route,{...response.body,status:'READY',quoteId:randomUUID(),quoteToken:'a'.repeat(64),expiresAt:new Date(Date.now()+600000).toISOString(),excluded:[],reasons:[]})
      }}})
      try{
        await ready(f.page);await apply(f.page,'LIVE2026');await ready(f.page);await fill(f.page)
        f.page.once('dialog',d=>d.accept());await requestButton(f.page).click();await expectFallback(f)
        assert.equal(f.calls.quotes[0].discountCode,'LIVE2026');assert.equal(await f.page.getByRole('region',{name:'최종 신청 확인',exact:true}).count(),0)
        await quote(f);assert.equal(f.calls.quotes.at(-1).discountCode,'');assert.equal(f.calls.quotes.at(-1).expectedTotalWon,12900)
      }finally{await f.close()}
    })
    await scenario('cart transport failure remains blocked instead of claiming a regular-price fallback',async()=>{
      const f=await fixture({handlers:{cart:(route,body)=>{const response=cart(body);return body.discountCode?json(route,{error:'합성 조회 장애'},503):json(route,response.body,response.status)}}})
      try{
        await ready(f.page);await apply(f.page,'LIVE2026');await f.page.getByRole('alert').filter({hasText:'선택한 상품을 확인하지 못했습니다.'}).waitFor()
        assert.equal(await requestButton(f.page).isDisabled(),true);assert.equal(await notice(f.page).count(),0)
        assert.equal(f.calls.cart.at(-1).discountCode,'LIVE2026');assert.equal(f.calls.cart.length,2);assert.equal(f.calls.quotes.length,0)
      }finally{await f.close()}
    })
    await scenario('a late rejected-code response cannot erase a newer valid code',async()=>{
      let release;const hold=new Promise(resolve=>{release=resolve})
      const f=await fixture({handlers:{cart:async(route,body)=>{
        if(body.discountCode==='LATE2026'){await hold;try{return await json(route,invalidCode,409)}catch{return}}
        const response=cart(body);return json(route,response.body,response.status)
      }}})
      try{
        await ready(f.page);await apply(f.page,'LATE2026');await until(()=>f.calls.cart.some(c=>c.discountCode==='LATE2026'))
        await apply(f.page,'LIVE2026');await ready(f.page);release();await new Promise(resolve=>setTimeout(resolve,100))
        await f.page.getByRole('status').filter({hasText:'적용 코드: LIVE2026'}).waitFor();assert.equal(await notice(f.page).count(),0)
        await quote(f);assert.equal(f.calls.quotes.at(-1).discountCode,'LIVE2026');assert.equal(f.calls.quotes.at(-1).expectedTotalWon,10000)
      }finally{release();await f.close()}
    })
    await scenario('typing a replacement without applying it preserves the applied code',async()=>{
      const f=await fixture()
      try{
        await ready(f.page);await apply(f.page,'LIVE2026');await ready(f.page)
        const callsBefore=f.calls.cart.length;await f.page.getByRole('textbox',{name:'할인코드',exact:true}).fill('NOT_APPLIED')
        assert.equal(f.calls.cart.length,callsBefore);await quote(f)
        assert.equal(f.calls.quotes.at(-1).discountCode,'LIVE2026');assert.equal(f.calls.quotes.at(-1).expectedTotalWon,10000)
      }finally{await f.close()}
    })
    await scenario('a valid bundle code retains its discounted final price',async()=>{
      const f=await fixture({productId:'bundle'})
      try{
        await ready(f.page);await apply(f.page,'LIVE2026');await ready(f.page);await quote(f)
        assert.equal(await notice(f.page).count(),0);assert.equal(f.calls.quotes.at(-1).discountCode,'LIVE2026');assert.equal(f.calls.quotes.at(-1).expectedTotalWon,20000)
        await complete(f,20000)
      }finally{await f.close()}
    })
    await scenario('invalid-code fallback cannot bypass overlapping course protection',async()=>{
      const f=await fixture()
      try{
        await ready(f.page);await f.page.getByRole('checkbox',{name:/가상 파이널 묶음/}).check()
        await f.page.getByRole('heading',{name:'중복된 강의가 포함되어 있습니다.',exact:true}).waitFor()
        await apply(f.page,'UNKNOWN2026');await notice(f.page).waitFor()
        await f.page.getByRole('heading',{name:'중복된 강의가 포함되어 있습니다.',exact:true}).waitFor()
        assert.equal(await requestButton(f.page).isDisabled(),true);assert.equal(f.calls.quotes.length,0);assert.equal(f.calls.orders.length,0)
      }finally{await f.close()}
    })
    await scenario('mobile viewport restores normal pricing after an unknown code',async()=>{
      const f=await fixture({mobile:true})
      try{
        await ready(f.page);await fill(f.page);await apply(f.page,'PKJ20261119');await expectFallback(f)
        assert.equal(await f.page.evaluate(()=>innerWidth),390)
        if(process.env.DAECHION_DISCOUNT_SCREENSHOT_PATH)await f.page.screenshot({path:process.env.DAECHION_DISCOUNT_SCREENSHOT_PATH,fullPage:true})
        await quote(f);assert.equal(f.calls.quotes.at(-1).discountCode,'');assert.equal(f.calls.quotes.at(-1).expectedTotalWon,12900)
        await complete(f,12900)
      }finally{await f.close()}
    })
  }finally{
    if(browser)await browser.close()
    if(server.exitCode===null){const stopped=once(server,'exit');server.kill();await stopped}
    const resolved=path.resolve(directory);assert.equal(path.dirname(resolved),path.resolve(tmpdir()));assert.ok(path.basename(resolved).startsWith('pkjmath-discount-fallback-'))
    await rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:100})
    console.log('DISCOUNT_FALLBACK_BROWSER_REPORT='+JSON.stringify({network:'synthetic page.route only',providerWrites:false,results}))
  }
})
