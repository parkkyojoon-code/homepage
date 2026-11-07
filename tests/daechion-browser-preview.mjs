// Disposable browser QA only. Real PostgreSQL/Google integration is tested separately.
// Binds loopback, uses an in-memory DB, blank provider credentials and fake products.
import { PGlite } from '@electric-sql/pglite'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp,writeFile,readFile,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import migrations from '../scripts/daechion-migrations.cjs'
import intakeHttp from '../.daechion-worker-build/lib/daechion/intake-http.js'
import sheetsWorker from '../.daechion-worker-build/lib/daechion/sheets-worker.js'
import sheetView from '../.daechion-worker-build/lib/daechion/sheets-view.js'

if(process.argv.slice(2).join(' ')!=='--local-only')throw Error('Explicit --local-only required')
const root=fileURLToPath(new URL('../',import.meta.url))
await readFile(path.join(root,'.next','BUILD_ID'))
const dataDir=await mkdtemp(path.join(tmpdir(),'pkjmath-browser-qa-'))
const db=new PGlite()
const client={query:async(sql,values)=>{
  if(/^SELECT pg_advisory_xact_lock\(/.test(sql))return {rows:[]}
  if(!values&&sql.includes(';')){await db.exec(sql);return {rows:[]}}
  return db.query(sql,values)
}}
await migrations.migrate(client)
const product={id:'browser-preview-process-two',visible:true,purchaseProcess:'PROCESS_2',name:'[검수 전용] 신규 강의 신청',category:'수리논술',
  image:null,duration:'가상 검수',modes:{online:{enabled:true,price:1200,campuses:[]},offline:{enabled:false,price:0,campuses:[]}},
  textbook:{included:false,price:0},description:'실제 결제와 수강 등록이 발생하지 않는 로컬 검수 상품입니다.',keywords:['검수','',''],
  daechionBinding:{tenantId:'test-only',lectures:[{id:101,name:'가상 강의 ID'}],verifiedAt:'2026-11-07T00:00:00Z'}}
await writeFile(path.join(dataDir,'classes.json'),JSON.stringify([product]))
const nextServer=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3103'],{
  cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,DATA_DIR:dataDir,NODE_ENV:'production',DAECHION_DATABASE_URL:'',DAECHION_INTAKE_ENABLED:'false',
    DAECHION_ADMIN_ENABLED:'false',DAECHION_API_KEY:'',LECTURES_DATABASE_URL:'',GOOGLE_SERVICE_ACCOUNT_JSON:'',GOOGLE_SHEET_ID:'',
    PAYSSAM_API_KEY:'',PAYSSAM_MEMBER:'',PAYSSAM_MERCHANT:'',SOLAPI_API_KEY:'',SOLAPI_API_SECRET:'',DAECHION_BILLING_SEND_ENABLED:'false',
    DAECHION_ENROLLMENT_ENABLED:'false',DAECHION_READY_MESSAGE_ENABLED:'false',DAECHION_PAYMENT_READ_ENABLED:'false',DAECHION_SHEETS_ENABLED:'false'}})
let serial=Promise.resolve(),projectedRow=null
function exclusive(run){const result=serial.then(()=>run(client));serial=result.catch(()=>{});return result}
const origin='http://127.0.0.1:3102'
const ports={settings:{origins:[origin],bindings:[]},bindings:[],tenantId:'test-only',loadProduct:id=>id===product.id?product:null,
  withClient:exclusive,ready:async()=>{}}
const target={spreadsheetId:'browser-preview-new-sheet-only',legacySpreadsheetId:'browser-preview-old-sheet-only',sheetId:7}
const api={call:async(method,requestPath,body)=>{
  if(!requestPath.startsWith('/spreadsheets/'+target.spreadsheetId))throw Error('Unexpected target')
  if(requestPath.includes('developerMetadata:search'))return body.dataFilters[0].developerMetadataLookup.metadataKey==='pkjmath_process2_sheet_v1'?{matchedDeveloperMetadata:[{developerMetadata:{metadataId:1,location:{sheetId:7}}}]}:{}
  if(requestPath.includes('?fields='))return {sheets:[{properties:{sheetId:7,title:'가상 업무 시트'}}]}
  if(method==='GET')return {values:[sheetView.SHEET_HEADERS]}
  projectedRow=body.requests.find(r=>r.updateCells).updateCells.rows[0].values.map(c=>c.userEnteredValue.stringValue??c.userEnteredValue.numberValue)
  return {spreadsheetId:target.spreadsheetId,replies:[{},{},{}]}
}}
const server=createServer(async(req,res)=>{
  try{
    if(req.url.startsWith('/api/daechion/applications')){
      const chunks=[];let size=0
      for await(const chunk of req){size+=chunk.length;if(size>8192){res.writeHead(413).end();return}chunks.push(chunk)}
      const request=new Request(origin+req.url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})})
      const response=req.method==='GET'?await intakeHttp.intakeAvailability(new URL(request.url).searchParams.get('productId'),ports):await intakeHttp.intakePost(request,ports)
      if(response.ok&&req.method==='POST')await sheetsWorker.syncOneApplication({api,target,withClient:exclusive})
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return
    }
    if(req.url==='/__preview/status'){
      const result=await exclusive(async c=>({applications:(await c.query('SELECT id,submission,payment_state FROM daechion_automation.applications')).rows,
        outbox:(await c.query('SELECT kind,state FROM daechion_automation.outbox')).rows,projectedRow}))
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(result));return
    }
    const response=await fetch('http://127.0.0.1:3103'+req.url,{method:req.method,headers:{...req.headers,host:'127.0.0.1:3103'},redirect:'manual'})
    const headers=Object.fromEntries(response.headers);delete headers['content-encoding'];delete headers['content-length'];delete headers['transfer-encoding']
    res.writeHead(response.status,headers);res.end(Buffer.from(await response.arrayBuffer()))
  }catch{res.writeHead(503,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Local preview request failed'}))}
})
server.listen(3102,'127.0.0.1');await once(server,'listening')
console.log(JSON.stringify({preview:origin+'/apply/'+product.id,localOnly:true,realSending:false,dataDir}))
async function stop(){server.close();if(nextServer.exitCode===null){const exit=once(nextServer,'exit');nextServer.kill();await exit}await db.close();
  if(path.dirname(path.resolve(dataDir))!==path.resolve(tmpdir())||!path.basename(dataDir).startsWith('pkjmath-browser-qa-'))throw Error('Invalid temporary path')
  await rm(dataDir,{recursive:true,force:true});process.exit(0)}
process.once('SIGINT',stop);process.once('SIGTERM',stop)
