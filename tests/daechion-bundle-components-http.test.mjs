// Disposable loopback web server and synthetic read-only LMS transport; no DB or provider writes.
import test from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {once} from 'node:events'
import {randomBytes} from 'node:crypto'
import {mkdtemp,writeFile,readFile,unlink,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

for(const publishingReady of [false,true])test('website-product bundle HTTP validates composition and environment publication policy: '+publishingReady,{timeout:90000},async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url)),dir=await mkdtemp(path.join(tmpdir(),'pkjmath-bundle-sources-'))
  const base={name:'동일 상품명',visible:false,purchaseProcess:'PROCESS_2',saleKind:'SINGLE',category:'수리논술',image:null,
    modes:{online:{enabled:true,price:900},offline:{enabled:false,price:0}},textbook:{included:false,price:0},
    createdAt:'2026-11-09T00:00:00Z',updatedAt:'2026-11-09T00:00:00Z'}
  const binding=id=>({tenantId:'test-only',lectures:[{id,name:'동일 강의명'}],verifiedAt:base.createdAt})
  await writeFile(path.join(dir,'classes.json'),JSON.stringify([
    {...base,id:'source-a',daechionBinding:binding(101),legacyUnknown:{keep:true},modes:{...base.modes,online:{...base.modes.online,futureField:'retain'}}},{...base,id:'source-b',daechionBinding:binding(102)},
    {...base,id:'12course',visible:true,purchaseProcess:'PROCESS_1',legacyUnknown:{original:true}},
    {...base,id:'purchase-entry-single',visible:true,daechionBinding:binding(101)},
  ]))
  const reservation=createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening')
  const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve))
  const origin=`http://127.0.0.1:${port}`,password=randomBytes(24).toString('hex')
  const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{
    cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,NODE_ENV:'production',DATA_DIR:dir,
      ADMIN_PASSWORD:password,ADMIN_SECRET:randomBytes(32).toString('hex'),DAECHION_ADMIN_ENABLED:'true',
      DAECHION_API_KEY:'synthetic-only',DAECHION_TENANT_ID:'test-only',DAECHION_CATALOG_FIXTURE:'local-only',
      NODE_OPTIONS:`--require ${JSON.stringify(path.join(root,'tests/daechion-catalog-fixture.cjs'))}`,
      DAECHION_DATABASE_URL:'',LECTURES_DATABASE_URL:'',DAECHION_ORDERS_ENABLED:publishingReady?'true':'false',DAECHION_BUNDLE_PUBLISH_ENABLED:publishingReady?'true':'false',DAECHION_INTAKE_ENABLED:'false',
      DAECHION_PAYSSAM_CALLBACK_ENABLED:'false',DAECHION_BILLING_SEND_ENABLED:'false',DAECHION_ENROLLMENT_ENABLED:'false',
      DAECHION_READY_MESSAGE_ENABLED:'false',DAECHION_SHEETS_ENABLED:'false',PAYSSAM_API_KEY:'',SOLAPI_API_KEY:'',GOOGLE_SERVICE_ACCOUNT_JSON:''}})
  let cookie='',startError;child.on('error',error=>{startError=error})
  const request=(route,body,method=body===undefined?'GET':'POST')=>fetch(origin+route,{
    method,headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)})
  try{
    let ready=false
    for(let i=0;i<100;i++){
      if(startError)throw startError
      if(child.exitCode!==null)throw Error('LOCAL_PREVIEW_STOPPED')
      try{const res=await fetch(origin+'/api/classes',{signal:AbortSignal.timeout(500)});if(res.ok){await res.arrayBuffer();ready=true;break}}catch{}
      await new Promise(resolve=>setTimeout(resolve,200))
    }
    assert.ok(ready)
    assert.equal((await request('/api/admin/classes')).status,401)
    const legacy=await (await request('/api/classes/12course')).json();assert.equal(legacy.orderCheckout,false)
    const single=await (await request('/api/classes/purchase-entry-single')).json();assert.equal(single.orderCheckout,publishingReady)
    assert.equal((await request('/api/classes/source-a')).status,404)
    const login=await request('/api/admin/login',{password});cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie)
    assert.equal((await request('/api/admin/classes')).headers.get('X-Bundle-Publishing-Ready'),String(publishingReady))
    const promo=[{code:' live2026 ',priceWon:500},{code:'WELCOME2026',priceWon:600}]
    const discounted=await request('/api/admin/classes/purchase-entry-single',{discountPrices:promo},'PUT')
    assert.equal(discounted.status,200);assert.equal((await discounted.json()).discountPrices[0].code,'LIVE2026')
    for(const route of ['/api/classes','/api/classes/purchase-entry-single']){
      const publicData=await (await request(route)).json()
      assert.ok(!JSON.stringify(publicData).includes('LIVE2026'));assert.ok(!JSON.stringify(publicData).includes('discountPrices'))
    }
    for(const discountPrices of [[{code:'LIVE2026',priceWon:0}],[{code:'LIVE2026',priceWon:900}],[{code:'a',priceWon:500},{code:'A',priceWon:600}]])assert.equal((await request('/api/admin/classes/purchase-entry-single',{discountPrices},'PUT')).status,400)
    assert.equal((await request('/api/admin/classes/12course',{discountPrices:promo},'PUT')).status,400)
    assert.equal((await request('/api/admin/classes/purchase-entry-single',{name:'  ',visible:true},'PUT')).status,400)
    const components=[{productId:'source-a',lectureId:101,tenantId:'test-only'},{productId:'source-b',lectureId:102,tenantId:'test-only'}]
    const body={...base,id:'website-bundle',name:'홈페이지 상품 묶음',saleKind:'BUNDLE',bundleProductIds:['source-b','source-a'],
      expectedBundleComponents:components,modes:{...base.modes,online:{enabled:true,price:1200}}}
    const direct={...body,bundleProductIds:undefined,daechionLectureIds:[101,102]}
    assert.equal((await request('/api/admin/classes',direct)).status,400)
    assert.equal((await request('/api/admin/classes',{...body,bundleProductIds:['source-a','12course']})).status,400)
    assert.equal((await request('/api/admin/classes',{...body,expectedBundleComponents:components.map(c=>({...c,tenantId:'other'}))})).status,400)
    const created=await request('/api/admin/classes',{...body,daechionLectureIds:[103],bundleComponents:[{forged:true}]})
    assert.equal(created.status,201);const bundle=await created.json()
    assert.deepEqual(bundle.bundleComponents,components)
    assert.deepEqual(bundle.daechionBinding.lectures.map(l=>l.id),[101,102])
    assert.equal(bundle.bundleProductIds,undefined);assert.equal(bundle.expectedBundleComponents,undefined)
    // Request fields cannot override the server's release switch. Publishing
    // and hiding keep the same saved binding and source composition.
    const publish=await request('/api/admin/classes/website-bundle',{visible:true,expectedUpdatedAt:bundle.updatedAt,publishingReady:true},'PUT')
    assert.equal(publish.status,publishingReady?200:400)
    if(publishingReady){
      const published=await publish.json();assert.equal(published.visible,true)
      assert.deepEqual(published.bundleComponents,components)
      const hide=await request('/api/admin/classes/website-bundle',{visible:false,expectedUpdatedAt:published.updatedAt},'PUT')
      assert.equal(hide.status,200);Object.assign(bundle,await hide.json())
    }
    const publicId='묶음상품1-fixture',publicPath=encodeURIComponent(publicId)
    const publicCreate=await request('/api/admin/classes',{...body,id:publicId,visible:true,publishingReady:true})
    assert.equal(publicCreate.status,publishingReady?201:400)
    if(publishingReady){
      const info=await request('/api/classes/'+publicPath);assert.equal(info.headers.get('Cache-Control'),'no-store');assert.equal((await info.json()).orderCheckout,true)
      if(process.env.DAECHION_BROWSER_FIXTURE_TEST==='true'){
        const {createRequire}=await import('node:module'),require=createRequire(import.meta.url)
        const browser=await require('../workers/daechion/browser/node_modules/playwright').chromium.launch({headless:true})
        try{
          const page=await browser.newPage(),cart={productId:publicId,title:body.name,saleKind:'BUNDLE',priceWon:1200,lectureCount:2}
          await page.route('**/api/daechion/orders/catalog',route=>route.fulfill({json:{available:true,products:[cart]}}))
          await page.route('**/api/daechion/orders/cart',route=>{
            assert.deepEqual(route.request().postDataJSON(),{items:[{productId:publicId}]})
            return route.fulfill({json:{status:'READY',totalWon:1200,items:[{productId:cart.productId,title:cart.title,priceWon:1200}],conflicts:[]}})
          })
          const assertSelected=async()=>{
            await page.getByRole('heading',{name:'강의 장바구니',exact:true}).waitFor()
            await page.getByRole('checkbox',{name:/홈페이지 상품 묶음/}).waitFor()
            assert.equal(await page.getByRole('checkbox',{name:/홈페이지 상품 묶음/}).isChecked(),true)
            await page.getByRole('button',{name:'신청 내용 확인',exact:true}).waitFor({state:'visible'})
            await page.waitForFunction(()=>!document.querySelector('button[type="submit"]').disabled)
            assert.match(await page.getByRole('region',{name:'선택한 상품',exact:true}).innerText(),/1,200원/)
          }
          await page.goto(origin+'/classes/'+publicPath)
          await page.getByRole('button',{name:'지금 수강 신청하기',exact:true}).click()
          await page.waitForURL(origin+'/classes/cart?productId='+publicPath);await assertSelected()
          // Existing bookmarks must also use the order API, never the disabled
          // legacy applications endpoint. No personal data or quote is sent.
          await page.route('**/api/daechion/applications**',()=>{throw Error('LEGACY_INTAKE_MUST_NOT_BE_USED')})
          await page.goto(origin+'/apply/'+publicPath+'?option=online');await assertSelected()
          await page.goto(origin+'/classes/cart?productId=private-or-missing')
          await page.getByRole('alert').filter({hasText:'선택한 상품은 현재 구매할 수 없습니다.'}).waitFor()
          assert.equal(await page.getByRole('checkbox',{name:/홈페이지 상품 묶음/}).isChecked(),false)
        }finally{await browser.close()}
      }
    }
    const bundleFromList=async()=>{const response=await request('/api/admin/classes');assert.equal(response.status,200);return (await response.json()).find(item=>item.id===body.id)}
    assert.equal((await bundleFromList()).bundleCompositionIssue,null)
    assert.equal((await request('/api/admin/classes/source-a',{name:'변경된 개별상품명',modes:{...base.modes,online:{enabled:true,price:9900}}},'PUT')).status,200)
    assert.equal((await bundleFromList()).bundleCompositionIssue,null)
    assert.equal((await bundleFromList()).modes.online.price,1200)
    const changed=await request('/api/admin/classes/source-b',{daechionLectureIds:[101]},'PUT');assert.equal(changed.status,200)
    assert.ok((await bundleFromList()).bundleCompositionIssue)
    const staleSave=await request('/api/admin/classes/website-bundle',{...body,expectedUpdatedAt:bundle.updatedAt},'PUT')
    assert.equal(staleSave.status,400)
    assert.equal((await bundleFromList()).updatedAt,bundle.updatedAt)
    assert.deepEqual((await bundleFromList()).daechionBinding.lectures.map(l=>l.id),[101,102])
    assert.equal((await request('/api/admin/classes/source-b',{daechionLectureIds:[102]},'PUT')).status,200)
    assert.equal((await bundleFromList()).bundleCompositionIssue,null)
    const update=await request('/api/admin/classes/website-bundle',{...body,expectedUpdatedAt:bundle.updatedAt},'PUT')
    assert.equal(update.status,200);const updated=await update.json();assert.ok(updated.updatedAt>bundle.updatedAt)
    assert.equal((await request('/api/admin/classes/website-bundle',{...body,expectedUpdatedAt:bundle.updatedAt},'PUT')).status,409)
    assert.equal((await request('/api/admin/classes/source-b',undefined,'DELETE')).status,200)
    assert.ok((await bundleFromList()).bundleCompositionIssue)
    const disk=JSON.parse(await readFile(path.join(dir,'classes.json'),'utf8'))
    assert.deepEqual(disk.find(item=>item.id==='website-bundle').bundleComponents,components)
    assert.ok(!disk.some(item=>Object.hasOwn(item,'expectedBundleComponents')||Object.hasOwn(item,'bundleProductIds')||Object.hasOwn(item,'bundleCompositionIssue')))
    assert.deepEqual(await (await request('/api/daechion/orders/catalog')).json(),{available:false,products:[]})
    // All products use the optional item fence; file CAS also protects callers
    // that await LMS validation before saving a freshly read complete catalog.
    const file=path.join(dir,'classes.json'),readRaw=()=>readFile(file,'utf8')
    const adminList=async()=>{const response=await request('/api/admin/classes');assert.equal(response.status,200);return {rows:await response.json(),revision:response.headers.get('X-Catalog-Revision')}}
    const singleBefore=(await adminList()).rows.find(item=>item.id==='source-a')
    let bytes=await readRaw()
    const stale=await request('/api/admin/classes/source-a',{name:'오래된 편집',expectedUpdatedAt:'1900-01-01T00:00:00.000Z'},'PUT')
    assert.equal(stale.status,409);assert.equal(await readRaw(),bytes)
    const edit=await request('/api/admin/classes/source-a',{name:'개별상품 저장 검수',expectedUpdatedAt:singleBefore.updatedAt},'PUT')
    assert.equal(edit.status,200);const edited=await edit.json();assert.ok(edited.updatedAt>singleBefore.updatedAt)
    assert.deepEqual(edited.legacyUnknown,{keep:true});assert.equal(edited.modes.online.futureField,'retain')
    bytes=await readRaw()
    const staleDelete=await fetch(origin+'/api/admin/classes/source-a',{method:'DELETE',headers:{origin,cookie,'X-Class-Updated-At':singleBefore.updatedAt}})
    assert.equal(staleDelete.status,409);assert.equal(await readRaw(),bytes)
    const upload=async expected=>{
      const data=new FormData();data.set('expectedUpdatedAt',expected);data.set('image',new Blob([Buffer.from('synthetic local image')],{type:'image/png'}),'fixture.png')
      return fetch(origin+'/api/admin/classes/source-a/image',{method:'POST',headers:{origin,cookie},body:data})
    }
    assert.equal((await upload(singleBefore.updatedAt)).status,409);assert.equal(await readRaw(),bytes)
    const image=await upload(edited.updatedAt);assert.equal(image.status,200)
    const imageResult=await image.json();assert.ok(imageResult.updatedAt>edited.updatedAt)
    assert.equal((await readFile(path.join(dir,'class-images',imageResult.filename))).toString(),'synthetic local image')
    const current=await adminList();assert.match(current.revision,/^[a-f0-9]{64}$/)
    const ids=current.rows.map(item=>item.id).reverse();bytes=await readRaw()
    const reorder=(revision)=>fetch(origin+'/api/admin/classes/reorder',{method:'PUT',headers:{origin,cookie,'content-type':'application/json','X-Catalog-Revision':revision},body:JSON.stringify({ids})})
    assert.equal((await reorder('a'.repeat(64))).status,409);assert.equal(await readRaw(),bytes)
    const reordered=await reorder(current.revision);assert.equal(reordered.status,200);assert.deepEqual((await reordered.json()).map(item=>item.id),ids)
    const preserved=JSON.parse(await readRaw())
    assert.deepEqual(preserved.find(item=>item.id==='12course').legacyUnknown,{original:true})
    assert.deepEqual(preserved.find(item=>item.id==='source-a').legacyUnknown,{keep:true})
    assert.equal(preserved.find(item=>item.id==='source-a').modes.online.futureField,'retain')

    const validBytes=await readRaw(),backupBytes=await readFile(file+'.bak','utf8'),corrupt='{intentionally incomplete catalog'
    await writeFile(file,corrupt)
    for(const route of ['/api/classes','/api/classes/12course','/api/admin/classes']){
      const response=await request(route);assert.equal(response.status,503);assert.equal((await response.json()).code,'CATALOG_UNAVAILABLE')
    }
    const mutations=[
      ()=>request('/api/admin/classes',{...base,id:'must-not-be-created',purchaseProcess:'PROCESS_1'}),
      ()=>request('/api/admin/classes/source-a',{visible:true},'PUT'),
      ()=>request('/api/admin/classes/source-a',undefined,'DELETE'),
      ()=>request('/api/admin/classes/reorder',{ids},'PUT'),
      ()=>upload(imageResult.updatedAt),
      ()=>fetch(origin+'/api/admin/classes/source-a/gallery',{method:'POST',headers:{origin,cookie},body:new FormData()}),
      ()=>request('/api/admin/classes/source-a/gallery',{filename:imageResult.filename},'DELETE'),
    ]
    for(const mutate of mutations){const response=await mutate();assert.equal(response.status,503);assert.equal((await response.json()).code,'CATALOG_UNAVAILABLE');assert.equal(await readRaw(),corrupt)}
    assert.equal(await readFile(file+'.bak','utf8'),backupBytes)
    await unlink(file)
    for(const route of ['/api/classes','/api/classes/12course','/api/admin/classes'])assert.equal((await request(route)).status,503)
    assert.equal((await mutations[0]()).status,503);await assert.rejects(readRaw(),{code:'ENOENT'})
    assert.equal(await readFile(file+'.bak','utf8'),backupBytes)
    // Operator restoration is explicit; subsequent reads use the recovered
    // file and preserve both original and new products without a default reset.
    await writeFile(file,validBytes)
    const restored=await adminList();assert.deepEqual(restored.rows.map(item=>item.id),ids)
    assert.equal((await request('/api/classes/12course')).status,200)
    assert.equal((await request('/api/classes/purchase-entry-single')).status,200)
    assert.equal(await readRaw(),validBytes)
  }finally{
    child.kill();if(child.exitCode===null)await Promise.race([once(child,'exit'),new Promise(resolve=>setTimeout(resolve,3000))])
    if(path.dirname(path.resolve(dir))!==path.resolve(tmpdir())||!path.basename(dir).startsWith('pkjmath-bundle-sources-'))throw Error('UNSAFE_TEST_DIRECTORY')
    await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100})
  }
})
