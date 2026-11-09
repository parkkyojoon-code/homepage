// Explicit loopback-only cart QA: in-memory PostgreSQL, synthetic ownership,
// no provider credentials, bills, enrollment, SMS or Google writes.
import {PGlite} from '@electric-sql/pglite'
import {createServer} from 'node:http'
import {spawn} from 'node:child_process'
import {mkdtemp,writeFile,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import http from '../.daechion-test-build/lib/daechion/orders/http.js'
if(process.argv.slice(2).join(' ')!=='--local-only')throw Error('Explicit --local-only required')
const root=fileURLToPath(new URL('../',import.meta.url)),dir=await mkdtemp(path.join(tmpdir(),'pkjmath-cart-ui-'))
const make=(productId,title,ids,priceWon)=>({productId,title,saleKind:ids.length>1?'BUNDLE':'SINGLE',priceWon,tenantId:'local-fixture',revision:'r1',purchaseProcess:'PROCESS_2',visible:true,lectures:ids.map(id=>({id,name:`가상 강의 ${id}`}))})
const products=[make('single-a','가상 개별 강의 A',[101],12901),make('single-b','가상 개별 강의 B',[102],18500),make('bundle','가상 파이널 묶음',[101,103],25000)]
products[0].discountPrices=[{code:'LIVE2026',priceWon:10000},{code:'WELCOME2026',priceWon:11000}]
products[2].discountPrices=[{code:'LIVE2026',priceWon:20000}]
await writeFile(path.join(dir,'classes.json'),'[]')
const db=new PGlite()
await db.exec(await readFile(path.join(root,'db/daechion/001_initial.sql'),'utf8'))
await db.exec(await readFile(path.join(root,'db/daechion-orders/001_initial.sql'),'utf8'))
let tail=Promise.resolve()
const withClient=run=>{const next=tail.then(()=>run(db));tail=next.catch(()=>{});return next}
const ports={settings:{origins:['http://127.0.0.1:3107']},tenantId:'local-fixture',subjectSecret:'local-synthetic-cart-secret-only-123456',catalog:async()=>products,ready:async()=>{},withClient,
  ownership:async(cart,contact,subjectKey)=>({cartFingerprint:cart.fingerprint,subjectKey,checkedAt:new Date().toISOString(),existingStudent:contact.studentHistory==='EXISTING'?'EXISTING':'NEW',identity:contact.studentHistory==='EXISTING'?'REVIEW':'PASSED',
    lectures:cart.items.flatMap(i=>i.lectures.map(l=>({id:l.id,state:contact.studentPhone.endsWith('6666')&&l.id===101?'OWNED':contact.studentHistory==='EXISTING'?'UNKNOWN':'NOT_OWNED'})))})}
const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3108'],{
  cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,NODE_ENV:'production',DATA_DIR:dir,NODE_OPTIONS:'',
    DAECHION_DATABASE_URL:'',LECTURES_DATABASE_URL:'',DAECHION_API_KEY:'',DAECHION_ORDERS_ENABLED:'false',DAECHION_INTAKE_ENABLED:'false',
    DAECHION_ADMIN_ENABLED:'false',DAECHION_PAYSSAM_CALLBACK_ENABLED:'false',DAECHION_BILLING_SEND_ENABLED:'false',DAECHION_ENROLLMENT_ENABLED:'false',
    DAECHION_READY_MESSAGE_ENABLED:'false',DAECHION_PAYMENT_READ_ENABLED:'false',DAECHION_SHEETS_ENABLED:'false',
    PAYSSAM_API_KEY:'',PAYSSAM_MEMBER:'',PAYSSAM_MERCHANT:'',SOLAPI_API_KEY:'',SOLAPI_API_SECRET:'',GOOGLE_SERVICE_ACCOUNT_JSON:'',GOOGLE_SHEET_ID:''}})
let droppedReceipt=false
const server=createServer(async(req,res)=>{
  try{
    let response
    if(req.url==='/__preview/status'){
      const result=await withClient(async c=>({orders:(await c.query('SELECT count(*)::int AS n FROM daechion_orders.orders')).rows[0].n,
        bills:(await c.query('SELECT count(*)::int AS n FROM daechion_orders.bills')).rows[0].n}))
      res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(result));return
    }
    if(req.url==='/api/daechion/orders/catalog')response=await http.orderCatalog(ports)
    else if(['/api/daechion/orders/cart','/api/daechion/orders/quotes','/api/daechion/orders'].includes(req.url)){
      const chunks=[];let size=0
      for await(const chunk of req){size+=chunk.length;if(size>16384){res.writeHead(413).end();return}chunks.push(chunk)}
      const request=new Request('http://127.0.0.1:3107'+req.url,{method:'POST',headers:req.headers,body:Buffer.concat(chunks)})
      response=await http.orderPost(req.url.endsWith('/cart')?'cart':req.url.endsWith('/quotes')?'quotes':'orders',request,ports)
      // Persist successfully, then simulate a lost first receipt. Retrying must
      // return the same order rather than charge or create an order twice.
      if(req.url==='/api/daechion/orders'&&response.ok&&!droppedReceipt){droppedReceipt=true;response=Response.json({error:'접수 결과를 확인하지 못했습니다. 같은 접수를 다시 확인해주세요.'},{status:503})}
    }else response=await fetch('http://127.0.0.1:3108'+req.url,{method:req.method,headers:{...req.headers,host:'127.0.0.1:3108'},redirect:'manual'})
    const headers=Object.fromEntries(response.headers);delete headers['content-encoding'];delete headers['content-length']
    res.writeHead(response.status,headers);res.end(Buffer.from(await response.arrayBuffer()))
  }catch{res.writeHead(503).end('Local preview unavailable')}
})
server.listen(3107,'127.0.0.1',()=>console.log('Synthetic cart preview: http://127.0.0.1:3107/classes/cart'))
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{child.kill();server.close();process.exit(0)})
child.on('exit',code=>{server.close();process.exit(code??1)})
