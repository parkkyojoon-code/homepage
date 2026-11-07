// Local UI QA only: no operational credentials or external writes.
import {spawn} from 'node:child_process'
import {mkdtemp,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
if(process.argv.slice(2).join(' ')!=='--local-only')throw Error('Explicit --local-only required')
const root=fileURLToPath(new URL('../',import.meta.url)),dir=await mkdtemp(path.join(tmpdir(),'pkjmath-bundle-ui-'))
const base={visible:true,name:'기존 수업 검수',category:'수리논술',badge:'',image:null,duration:'',description:'',keywords:['','',''],
  modes:{online:{enabled:true,price:900,campuses:[]},offline:{enabled:false,price:0,campuses:[]}},textbook:{included:false,price:0},
  createdAt:'2026-11-08T00:00:00Z',updatedAt:'2026-11-08T00:00:00Z'}
await writeFile(path.join(dir,'classes.json'),JSON.stringify([{...base,id:'12course'},{...base,id:'chuweol'}]))
const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3106'],{
  cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,NODE_ENV:'production',DATA_DIR:dir,
    ADMIN_PASSWORD:'local-bundle-preview',ADMIN_SECRET:'local-bundle-preview-session-only',
    DAECHION_ADMIN_ENABLED:'true',DAECHION_API_KEY:'synthetic-fixture-only',DAECHION_TENANT_ID:'test-only',
    DAECHION_CATALOG_FIXTURE:'local-only',NODE_OPTIONS:`--require ${JSON.stringify(path.join(root,'tests','daechion-catalog-fixture.cjs'))}`,
    DAECHION_DATABASE_URL:'',LECTURES_DATABASE_URL:'',DAECHION_ORDERS_ENABLED:'false',DAECHION_INTAKE_ENABLED:'false',
    DAECHION_PAYSSAM_CALLBACK_ENABLED:'false',DAECHION_BILLING_SEND_ENABLED:'false',DAECHION_ENROLLMENT_ENABLED:'false',
    DAECHION_READY_MESSAGE_ENABLED:'false',DAECHION_PAYMENT_READ_ENABLED:'false',DAECHION_SHEETS_ENABLED:'false',
    PAYSSAM_API_KEY:'',PAYSSAM_MEMBER:'',PAYSSAM_MERCHANT:'',SOLAPI_API_KEY:'',SOLAPI_API_SECRET:'',GOOGLE_SERVICE_ACCOUNT_JSON:'',GOOGLE_SHEET_ID:''}})
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{child.kill();process.exit(0)})
child.on('exit',code=>process.exit(code??1))
console.log('Local synthetic bundle admin preview: http://127.0.0.1:3106/admin')
console.log('Disposable preview password: local-bundle-preview')
