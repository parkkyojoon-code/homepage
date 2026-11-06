// Real HTTP regression checks against a disposable loopback-only Next server.
// Never uses an existing server, real student files, lecture DB, or provider keys.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
test('legacy and lecture authentication remain isolated over HTTP',{timeout:120000},async t=>{
 await readFile(path.join(root,'.next','BUILD_ID')); // Run npm run test:legacy-auth to build first.
 const temp=await mkdtemp(path.join(tmpdir(),'pkjmath-legacy-auth-'));
 const password=randomBytes(24).toString('hex');
 const adminPassword=randomBytes(24).toString('hex');
 const student={id:'isolated-student',name:'회귀검수 학생',class:'검수반',student_phone:'01000000001',parent_phone:'01000000002',
  password:createHash('sha256').update(password).digest('hex'),password_plain:password,
  address:'',address_detail:'',zipcode:'',total_hw:0,submitted_count:0,submission_rate:0,a_count:0,b_count:0,c_count:0,assignments:[],lectureIds:[]};
 const studentFile=path.join(temp,'students_data.json');
 let child;
 try{
  await writeFile(studentFile,JSON.stringify([student]));
  const baseClass={visible:true,name:'검수 수업',category:'수리논술',image:null,duration:'검수',
   modes:{online:{enabled:true,price:1200,campuses:[]},offline:{enabled:false,price:0,campuses:[]}},
   textbook:{included:false,price:0},description:'',keywords:['','',''],createdAt:'2026-01-01',updatedAt:'2026-01-01'};
  await writeFile(path.join(temp,'classes.json'),JSON.stringify([{...baseClass,id:'12course'},{...baseClass,id:'chuweol'}]));
  const reservation=createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');
  const port=reservation.address().port;await new Promise((resolve,reject)=>reservation.close(e=>e?reject(e):resolve()));
  const origin=`http://127.0.0.1:${port}`;
  const env={...process.env,NODE_ENV:'production',DATA_DIR:temp,ADMIN_PASSWORD:adminPassword,ADMIN_SECRET:randomBytes(32).toString('hex'),
   DAECHION_INTAKE_ENABLED:'false',DAECHION_ADMIN_ENABLED:'false',DAECHION_DATABASE_URL:'',
   LECTURES_DATABASE_URL:'',LECTURES_APP_ORIGIN:origin,LECTURES_ADDITIONAL_ORIGINS:'',LECTURES_WORKER_ENABLED:'false',LECTURES_WORKER_TOKEN:'',
   GOOGLE_SERVICE_ACCOUNT_JSON:'',GOOGLE_SHEET_ID:'',PAYSSAM_API_KEY:'',PAYSSAM_MEMBER:'',PAYSSAM_MERCHANT:'',SOLAPI_API_KEY:'',SOLAPI_API_SECRET:'',
   LECTURES_BOOTSTRAP_USERNAME:'',LECTURES_BOOTSTRAP_NAME:'',LECTURES_BOOTSTRAP_PASSWORD:''};
  child=spawn(process.execPath,[path.join(root,'node_modules','next','dist','bin','next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env,stdio:'ignore',windowsHide:true});
  let startError;child.on('error',e=>{startError=e});
  const request=(route,{method='GET',cookie,body,timeout=30000}={})=>fetch(origin+route,{method,redirect:'manual',signal:AbortSignal.timeout(timeout),
   headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},
   ...(body!==undefined?{body:JSON.stringify(body)}:{})});
  let ready=false;
  const readinessDeadline=Date.now()+30000;
  for(let attempt=0;attempt<80&&Date.now()<readinessDeadline;attempt++){
   if(startError)throw startError;
   if(child.exitCode!==null)throw Error('Disposable Next server stopped before readiness');
   try{const r=await request('/api/my/profile',{timeout:1000});await r.arrayBuffer();if(r.status===401){ready=true;break}}catch{}
   await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.ok(ready,'Disposable loopback server must be ready');
  let studentCookie,adminCookie;
  const loginStudent=phone=>request('/api/my/login',{method:'POST',body:{phone,password}});
  const cookieOf=(r,name)=>{const found=r.headers.getSetCookie().find(s=>s.startsWith(name+'='));assert.ok(found,`Expected ${name} cookie`);return found.split(';')[0]};
  const initialLogin=await loginStudent(student.student_phone);assert.equal(initialLogin.status,200);studentCookie=cookieOf(initialLogin,'my_session');
  const assertPrivateProfile=async r=>{assert.equal(r.status,200);const d=await r.json();assert.equal(d.id,student.id);assert.ok(!('password' in d),'Password hash must not be returned');assert.ok(!('password_plain' in d),'Plaintext password must not be returned');return d};
  await t.test('existing student login and profile omit both password fields',async()=>{
   const bad=await request('/api/my/login',{method:'POST',body:{phone:student.student_phone,password:'incorrect'}});assert.equal(bad.status,401);
   const r=await loginStudent(student.student_phone);assert.equal(r.status,200);studentCookie=cookieOf(r,'my_session');
   assert.equal(r.headers.getSetCookie().length,1);await assertPrivateProfile(await request('/api/my/profile',{cookie:studentCookie}));
  });
  await t.test('existing parent phone still signs in to the same student',async()=>{
   const r=await loginStudent(student.parent_phone);assert.equal(r.status,200);const d=await (await request('/api/my/profile',{cookie:cookieOf(r,'my_session')})).json();assert.equal(d.id,student.id);
  });
  await t.test('existing admin login still reads only the disposable student list',async()=>{
   assert.equal((await request('/api/admin/login',{method:'POST',body:{password:'incorrect'}})).status,401);
   const r=await request('/api/admin/login',{method:'POST',body:{password:adminPassword}});assert.equal(r.status,200);adminCookie=cookieOf(r,'admin_session');
   const list=await request('/api/admin/students',{cookie:adminCookie});assert.equal(list.status,200);assert.deepEqual((await list.json()).map(s=>s.id),[student.id]);
  });
  await t.test('admin can select either process for new classes and updates preserve omitted process',async()=>{
   for(const [id,purchaseProcess] of [['test-process-one','PROCESS_1'],['test-process-two','PROCESS_2']]) {
    const r=await request('/api/admin/classes',{method:'POST',cookie:adminCookie,body:{...baseClass,id,purchaseProcess}});
    assert.equal(r.status,201);assert.equal((await r.json()).purchaseProcess,purchaseProcess);
    assert.equal((await (await request(`/api/classes/${id}`)).json()).purchaseProcess,purchaseProcess);
   }
   const update=await request('/api/admin/classes/test-process-two',{method:'PUT',cookie:adminCookie,body:{name:'이름 변경'}});
   assert.equal(update.status,200);assert.equal((await update.json()).purchaseProcess,'PROCESS_2');
   for(const purchaseProcess of ['PROCESS_2','PROCESS_1']) {
    const switched=await request('/api/admin/classes/test-process-one',{method:'PUT',cookie:adminCookie,body:{purchaseProcess}});
    assert.equal(switched.status,200);assert.equal((await switched.json()).purchaseProcess,purchaseProcess);
   }
   const invalid=await request('/api/admin/classes',{method:'POST',cookie:adminCookie,body:{...baseClass,id:'invalid-process',purchaseProcess:['PROCESS_1','PROCESS_2']}});
   assert.equal(invalid.status,400);
  });
  await t.test('lecture catalog is admin-only and forged course bindings cannot bypass server validation',async()=>{
   assert.equal((await request('/api/admin/daechion/lectures')).status,401);
   assert.equal((await request('/api/admin/daechion/lectures',{cookie:studentCookie})).status,401);
   assert.equal((await request('/api/admin/daechion/lectures',{cookie:adminCookie})).status,503);
   const forged={tenantId:'forged',lectures:[{id:999,name:'forged'}],verifiedAt:'2026-11-06T00:00:00Z'};
   const response=await request('/api/admin/classes/test-process-two',{method:'PUT',cookie:adminCookie,body:{daechionBinding:forged}});
   assert.equal(response.status,200);assert.equal((await response.json()).daechionBinding,undefined);
   const bad=await request('/api/admin/classes/test-process-two',{method:'PUT',cookie:adminCookie,body:{daechionLectureIds:[999]}});
   assert.equal(bad.status,400);
   const stale=await request('/api/admin/classes/test-process-two',{method:'PUT',cookie:adminCookie,body:{daechionLectureIds:[],expectedDaechionBindingAt:'outdated'}});
   assert.equal(stale.status,409);
   const cleared=await request('/api/admin/classes/test-process-two',{method:'PUT',cookie:adminCookie,body:{daechionLectureIds:[]}});
   assert.equal(cleared.status,200);assert.equal((await cleared.json()).daechionBinding,null);
   const original=await request('/api/admin/classes/12course',{method:'PUT',cookie:adminCookie,body:{daechionLectureIds:[999],daechionBinding:forged}});
   assert.equal(original.status,200);assert.equal((await original.json()).daechionBinding,undefined);
  });
  await t.test('original classes stay on process 1 and process 2 cannot enter legacy application intake',async()=>{
   for(const id of ['12course','chuweol']) {
    assert.equal((await (await request(`/api/classes/${id}`)).json()).purchaseProcess,'PROCESS_1');
    assert.equal((await request(`/api/admin/classes/${id}`,{method:'PUT',cookie:adminCookie,body:{purchaseProcess:'PROCESS_2'}})).status,400);
    assert.equal((await request('/api/apply',{method:'POST',body:{courseId:id}})).status,400);
   }
   const blocked=await request('/api/apply',{method:'POST',body:{courseId:'test-process-two',purchaseProcess:'PROCESS_1'}});
   assert.equal(blocked.status,503);assert.equal((await blocked.json()).code,'PROCESS_2_NOT_READY');
   assert.equal((await request('/api/apply',{method:'POST',body:{courseId:'test-process-one'}})).status,400);
   const stored=JSON.parse(await readFile(path.join(temp,'classes.json'),'utf8'));
   assert.ok(stored.filter(c=>['12course','chuweol'].includes(c.id)).every(c=>c.purchaseProcess!=='PROCESS_2'));
  });
  await t.test('new process-2 API is closed by default and does not fall through to legacy billing',async()=>{
   const availability=await request('/api/daechion/applications?productId=test-process-two');assert.equal(availability.status,200);assert.deepEqual(await availability.json(),{available:false});
   const receipt=await request('/api/daechion/applications',{method:'POST',body:{productId:'test-process-two'}});assert.equal(receipt.status,503);assert.equal((await receipt.json()).success,false);
  });
  await t.test('new management API requires the existing admin session and remains disabled without its DB',async()=>{
   assert.equal((await request('/api/admin/daechion/applications')).status,401);
   assert.equal((await request('/api/admin/daechion/applications',{cookie:studentCookie})).status,401);
   assert.equal((await request('/api/admin/daechion/applications',{cookie:adminCookie})).status,503);
   assert.equal((await request('/api/admin/daechion/applications',{method:'POST',body:{action:'HOLD'}})).status,401);
  });
  await t.test('retired APIs stay closed with existing student and admin cookies',async()=>{
   for(const route of ['/api/lectures/me','/api/lectures/orders','/api/lectures/admin/orders','/api/lectures/admin/accounts'])
    assert.equal((await request(route,{cookie:`${studentCookie}; ${adminCookie}`})).status,410,route);
  });
  await t.test('lecture cookie names grant no existing student or admin access',async()=>{
   const cookie='lectures_session=isolated-test; lectures_admin_session=isolated-test';
   for(const route of ['/api/my/profile','/api/admin/students'])assert.equal((await request(route,{cookie})).status,401,route);
  });
  await t.test('lecture logout does not clear existing login cookies',async()=>{
   const cookie=`${studentCookie}; ${adminCookie}`;const r=await request('/api/lectures/auth/logout',{method:'POST',cookie,body:{}});assert.equal(r.status,410);
   assert.deepEqual(r.headers.getSetCookie(),[]);
   assert.equal((await request('/api/my/profile',{cookie})).status,200);assert.equal((await request('/api/admin/students',{cookie})).status,200);
  });
  await t.test('retirement blocks pages and all API methods without a database',async()=>{
   for(const route of ['/lectures','/lectures/login','/lectures/checkout','/lectures/classroom','/admin/lectures','/admin/lectures/login']) {
    const r=await request(route);assert.equal(r.status,410,route);
    assert.equal(r.headers.get('Cache-Control'),'no-store');assert.match(r.headers.get('X-Robots-Tag'),/noindex/);
    assert.match(await r.text(),/href="\/classes"/);
   }
   for(const method of ['GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD']) {
    for(const route of ['/api/lectures/catalog','/api/lectures/auth/register','/api/lectures/orders','/api/lectures/internal/billing/claim','/api/lectures/payssam/notification','/api/lectures/admin/catalog']) {
     const r=await request(route,{method});assert.equal(r.status,410,`${method} ${route}`);
     assert.deepEqual(r.headers.getSetCookie(),[]);
     if(method!=='HEAD')assert.equal((await r.json()).code,'LECTURE_SERVICE_RETIRED');
    }
   }
  });
  await t.test('legacy public pages and class management work without lecture DB',async()=>{
   for(const route of ['/','/classes','/my','/api/classes'])assert.equal((await request(route)).status,200,route);
   const r=await request('/api/admin/classes',{cookie:adminCookie});assert.equal(r.status,200);assert.ok(Array.isArray(await r.json()));
   const r2=await request('/api/apply',{method:'POST',body:{}});assert.equal(r2.status,400,'legacy application validation remains reachable');
   const callback=await request('/api/daechion/payssam/notification',{method:'POST',body:{}});assert.equal(callback.status,503,'new payment receipt is disabled by default');
  });
  await t.test('existing student logout clears only its own cookie',async()=>{
   const r=await request('/api/my/logout',{method:'POST',cookie:`${studentCookie}; ${adminCookie}`});assert.equal(r.status,200);
   assert.deepEqual(r.headers.getSetCookie().map(s=>s.split('=')[0]),['my_session']);assert.equal((await request('/api/admin/students',{cookie:adminCookie})).status,200);
  });
  await t.test('existing admin logout clears only its own cookie',async()=>{
   const r=await request('/api/admin/logout',{method:'POST',cookie:`${studentCookie}; ${adminCookie}`});assert.equal(r.status,200);
   assert.deepEqual(r.headers.getSetCookie().map(s=>s.split('=')[0]),['admin_session']);assert.equal((await request('/api/my/profile',{cookie:studentCookie})).status,200);
  });
  await t.test('profile update hides credentials while preserving stored login data',async()=>{
   const profile=await assertPrivateProfile(await request('/api/my/profile',{method:'PATCH',cookie:studentCookie,body:{address:'임시 검수 주소'}}));assert.equal(profile.address,'임시 검수 주소');
   const saved=JSON.parse(await readFile(studentFile,'utf8'));assert.equal(saved[0].password,student.password);assert.equal(saved[0].password_plain,password);
  });
 }finally{
  if(child?.pid&&child.exitCode===null&&child.signalCode===null){const stopped=once(child,'exit');child.kill();await stopped}
  const resolved=path.resolve(temp);assert.equal(path.dirname(resolved),path.resolve(tmpdir()));assert.ok(path.basename(resolved).startsWith('pkjmath-legacy-auth-'));
  await rm(resolved,{recursive:true,force:true});
 }
});
