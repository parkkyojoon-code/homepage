// Runs only inside the optional browser worker image, never in the web server.
// Replays the observed administrator UI. No private HTTP endpoints or deletion.
const ORIGIN = 'https://parkkyojoon.daechion.com'
const ACCESS_LABELS = ['차시 내 자료에 접근 권한 부여','차시 내 영상에 접근 권한 부여','강의 자료에 접근 권한 부여']
const fail = () => { throw Error('CONTENT_ACCESS_UNCONFIRMED') }
const phone = value => String(value ?? '').replace(/[\s-]/g,'')
const sameIds = (a,b) => Array.isArray(a)&&Array.isArray(b)&&JSON.stringify([...a].sort((x,y)=>x-y))===JSON.stringify([...b].sort((x,y)=>x-y))
const uniqueIds = ids => Array.isArray(ids)&&ids.length>0&&ids.length<=20&&ids.every(id=>Number.isSafeInteger(id)&&id>0)&&new Set(ids).size===ids.length
const formattedPhone = value => value.replace(/^(\d{3})(\d{4})(\d{4})$/,'$1-$2-$3')

function storageState(value) {
  try {
    if(typeof value!=='string'||value.length>256000)fail()
    const parsed=JSON.parse(value)
    if(!Array.isArray(parsed.cookies)||!Array.isArray(parsed.origins))fail()
    if(parsed.cookies.some(cookie=>!['parkkyojoon.daechion.com','.daechion.com','daechion.com','api.daechion.com'].includes(cookie.domain)))fail()
    if(parsed.origins.some(item=>![ORIGIN,'https://api.daechion.com'].includes(item.origin)))fail()
    // An empty state must not silently open an unauthenticated or new account.
    if(!parsed.cookies.length&&!parsed.origins.some(item=>item.localStorage?.length))fail()
    return parsed
  } catch {throw Error('CONTENT_BROWSER_AUTH_REQUIRED')}
}

async function exactStudentRow(dialog,input) {
  const rows=dialog.getByRole('row').filter({hasText:formattedPhone(input.studentPhone)})
  await rows.waitFor({state:'visible'})
  if(await rows.count()!==1||await rows.getByRole('cell',{name:formattedPhone(input.studentPhone),exact:true}).count()<1||
    await rows.getByText(input.studentName,{exact:true}).count()!==1||await rows.getByRole('checkbox').count()!==1)fail()
  return rows
}

async function verifyFile(page,title,input) {
  const titleNode=page.getByText(title,{exact:true})
  if(await titleNode.count()!==1)fail()
  await titleNode.click()
  await page.getByRole('button',{name:'권한 관리',exact:true}).click()
  const dialog=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'파일 권한 부여',exact:true})})
  await dialog.getByRole('textbox',{name:'검색어 입력 (초성 검색 가능)',exact:true}).fill(input.studentPhone)
  const row=await exactStudentRow(dialog,input)
  // The student row renders before its saved permission arrives. Wait for the
  // persisted selection without checking or saving anything ourselves.
  try{await row.locator('input[type="checkbox"]:checked').waitFor({state:'attached',timeout:10000})}catch{fail()}
  const confirmed=await exactStudentRow(dialog,input)
  if(!await confirmed.getByRole('checkbox').isChecked())fail()
  // Verification is read-only: never save the full student permission list.
  await dialog.getByRole('button',{name:'취소',exact:true}).click()
}

async function listTitles(page,kind) {
  if(kind==='video')return page.locator('[data-row-index]').locator('p').allTextContents()
  // The material table is fully rendered; fail rather than infer rows if its
  // headers, columns or virtualization change.
  const rows=page.getByRole('row').filter({has:page.getByRole('cell')})
  const titles=[]
  for(const row of await rows.all()){
    const cells=row.getByRole('cell')
    if(await cells.count()!==9)fail()
    titles.push((await cells.nth(2).innerText()).trim())
  }
  return titles
}

async function verifyCollection(page,url,tabName,kind,input) {
  async function load(){
    await page.goto(url)
    await page.getByRole('tab',{name:tabName,exact:typeof tabName==='string'}).click()
    const label=kind==='video'?'영상':'파일'
    await page.getByRole('button',{name:new RegExp('^'+label+' 추가(?:하기)?$')}).waitFor({state:'visible'})
    await page.waitForLoadState('networkidle',{timeout:10000})
    const titles=await listTitles(page,kind)
    const emptyButton=page.getByRole('button',{name:label+' 추가하기',exact:true})
    if(await emptyButton.count()===1&&await emptyButton.isVisible()){
      const placeholder=page.getByText(kind==='video'?'영상을 끌어서 업로드해주세요.':'자료를 끌어서 업로드해주세요.',{exact:true})
      if(titles.length||await placeholder.count()!==1||!await placeholder.isVisible()||await page.getByRole('button',{name:label+' 추가',exact:true}).count())fail()
      return []
    }
    // A loaded nonempty control with no rows is ambiguous, never proof of zero.
    if(!titles.length||titles.length>100||titles.some(title=>!title.trim())||new Set(titles).size!==titles.length)fail()
    return titles
  }
  const titles=await load()
  for(const title of titles){
    await verifyFile(page,title,input)
    if(JSON.stringify((await load()).sort())!==JSON.stringify([...titles].sort()))fail()
  }
  const after=await load()
  if(JSON.stringify([...after].sort())!==JSON.stringify([...titles].sort()))fail()
  return titles.length
}

const LIBRARY_CATEGORIES=['자습용 자료','손필기 자료','암기자료']
async function verifyLibrary(page,url,input,onStage=()=>{}) {
  onStage('LIBRARY_OPEN')
  await page.goto(url)
  const tab=page.getByRole('tab',{name:/^강의 자료실(?:\s|$)/})
  await tab.click()
  await page.waitForLoadState('networkidle',{timeout:10000})
  const totalMatch=(await tab.innerText()).replace(/\s+/g,'').match(/^강의자료실(\d+)개$/)
  if(!totalMatch)fail()
  const total=Number(totalMatch[1])
  if(total>100)fail()
  if(total===0){
    await page.getByRole('button',{name:'파일 추가하기',exact:true}).waitFor({state:'visible'})
    await page.getByText('등록된 자료가 없어요.',{exact:true}).waitFor({state:'visible'})
    return 0
  }
  async function categoryCounts(){
    const result=[]
    for(const name of LIBRARY_CATEGORIES){
      const button=page.getByRole('button',{name:new RegExp('^'+name+'\\s*\\d+개$')})
      if(await button.count()!==1)fail()
      const match=(await button.innerText()).replace(/\s+/g,'').match(/(\d+)개$/)
      if(!match)fail()
      result.push(Number(match[1]))
    }
    if(result.reduce((a,b)=>a+b,0)!==total)fail()
    return result
  }
  onStage('LIBRARY_COUNTS')
  const counts=await categoryCounts(),snapshots=[]
  async function openCategory(index){
    onStage('LIBRARY_CATEGORY_'+index)
    await page.goto(url)
    const current=page.getByRole('tab',{name:/^강의 자료실(?:\s|$)/})
    await current.click()
    await page.waitForLoadState('networkidle',{timeout:10000})
    if((await current.innerText()).replace(/\s+/g,'')!==`강의자료실${total}개`||JSON.stringify(await categoryCounts())!==JSON.stringify(counts))fail()
    await page.getByRole('button',{name:new RegExp('^'+LIBRARY_CATEGORIES[index]+'\\s*\\d+개$')}).click()
    if(counts[index]===0){
      await page.getByText('등록된 자료가 없어요.',{exact:true}).waitFor({state:'visible'})
      return []
    }
    await page.getByRole('heading',{name:LIBRARY_CATEGORIES[index],exact:true}).waitFor({state:'visible'})
    await page.getByRole('button',{name:'업로드',exact:true}).waitFor({state:'visible'})
    await page.waitForLoadState('networkidle',{timeout:10000})
    const titles=await listTitles(page,'material')
    if(titles.length!==counts[index]||titles.some(title=>!title)||new Set(titles).size!==titles.length)fail()
    return titles
  }
  for(let index=0;index<LIBRARY_CATEGORIES.length;index++){
    const titles=await openCategory(index)
    snapshots.push([...titles].sort())
    for(const title of titles){
      onStage('LIBRARY_FILE')
      await verifyFile(page,title,input)
      if(JSON.stringify((await openCategory(index)).sort())!==JSON.stringify(snapshots[index]))fail()
    }
  }
  // Revisit every category so a concurrent move/add/delete cannot be silently
  // accepted. Permission dialogs are always cancelled; never save their list.
  for(let index=0;index<LIBRARY_CATEGORIES.length;index++){
    if(JSON.stringify((await openCategory(index)).sort())!==JSON.stringify(snapshots[index]))fail()
  }
  onStage('LIBRARY_COMPLETE')
  return total
}

async function applyAndVerify(page,input,lecture,onStage=()=>{},authenticated=async()=>{}) {
  const participants=`${ORIGIN}/crm/lectures/${input.lectureId}/participants`
  onStage('PICKER_PAGE')
  await page.goto(participants)
  // A login redirect or a page for another lecture is not successful auth.
  const bulk=page.getByRole('button',{name:'일괄 학생 추가',exact:true})
  const empty=page.getByText('차시에서 수강생 추가가 가능해요.',{exact:true})
  await bulk.or(empty).waitFor({state:'visible'})
  if(new URL(page.url()).origin!==ORIGIN||new URL(page.url()).pathname!==new URL(participants).pathname)fail()
  await authenticated()
  if(input.firstOnly&&await empty.isVisible()){
    // A brand-new course has no bulk action. Add its first student directly to
    // the pinned lesson; never seed another lesson merely to reveal that action.
    const target=`${ORIGIN}/crm/lectures/${input.lectureId}/${input.weeklyLectureIds[0]}/attendance`
    onStage('FIRST_LESSON_PICKER')
    await page.goto(target)
    await page.getByRole('button',{name:lecture.weeklyLectures[0].name,exact:true}).waitFor({state:'visible'})
    if(page.url()!==target)fail()
    await page.getByRole('button',{name:'학생 추가하기',exact:true}).click()
    const picker=page.getByRole('dialog').filter({has:page.getByRole('tab',{name:'기존 학생 추가',exact:true})})
    const search=picker.getByRole('textbox',{name:'검색어 입력 (초성 검색 가능)',exact:true})
    await search.fill(input.studentPhone)
    await search.press('Enter')
    const row=await exactStudentRow(picker,input)
    await row.getByRole('checkbox').setChecked(true)
    onStage('WEEK_SELECTED')
    await input.beforeWrite()
    await picker.getByRole('button',{name:/^1명 추가(?:\s|$)/}).click()
  }else{
  await bulk.click()
  const picker=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'일괄 학생 추가',exact:true})})
  await picker.getByRole('textbox',{name:'검색어 입력 (초성 검색 가능)',exact:true}).fill(input.studentPhone)
  const row=await exactStudentRow(picker,input)
  onStage('STUDENT_SELECTED')
  await row.getByRole('checkbox').setChecked(true)
  await picker.getByRole('button',{name:/^1명 추가(?:\s|$)/}).click()
  const weeks=page.getByRole('dialog',{name:'차시 선택',exact:true})
  await weeks.waitFor({state:'visible'})
  const count=await weeks.getByRole('checkbox').count()
  if(count!==lecture.weeklyLectures.length&&count!==lecture.weeklyLectures.length+1)fail()
  if(count===lecture.weeklyLectures.length+1&&await weeks.getByRole('checkbox',{name:'전체 선택',exact:true}).count()!==1)fail()
  if(input.firstOnly){
    const boxes=weeks.getByRole('checkbox')
    const labels=await boxes.evaluateAll(nodes=>nodes.map(node=>(node.getAttribute('aria-label')||
      (node.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean).map(id=>node.ownerDocument.getElementById(id)?.textContent||'').join(' ')||
      [...(node.labels||[])].map(label=>label.textContent).join(' ')).replace(/\s+/g,' ').trim()))
    const actual=labels.map((name,index)=>({name,index})).filter(item=>item.name!=='전체 선택')
    if(actual.length!==lecture.weeklyLectures.length||actual[0]?.name!==lecture.weeklyLectures[0].name.replace(/\s+/g,' ').trim()||
      actual.filter(item=>item.name===actual[0].name).length!==1)fail()
    // Clear default/preselected lessons explicitly. Never use "select all".
    for(const item of actual)await boxes.nth(item.index).setChecked(false)
    await boxes.nth(actual[0].index).setChecked(true)
    for(const item of actual)if(await boxes.nth(item.index).isChecked()!==(item.index===actual[0].index))fail()
  }else for(const week of lecture.weeklyLectures){
    const checkbox=weeks.getByRole('checkbox',{name:week.name,exact:true})
    if(await checkbox.count()!==1)fail()
    await checkbox.setChecked(true)
  }
  // First possible registration write: re-check the DB's payment/hold fence.
  onStage('WEEK_SELECTED')
  await input.beforeWrite()
  await weeks.getByRole('button',{name:'일괄 추가',exact:true}).click()
  }
  const access=page.getByRole('dialog',{name:'권한 부여',exact:true})
  await access.waitFor({state:'visible'})
  for(const name of ACCESS_LABELS)await access.getByRole('checkbox',{name,exact:true}).setChecked(true)
  // Some variants also copy prior attendance. Do not modify attendance.
  const attendance=access.getByRole('checkbox',{name:'직전 차시 출결 메모 불러오기',exact:true})
  if(await attendance.count())await attendance.setChecked(false)
  if(await access.getByRole('checkbox').count()!==ACCESS_LABELS.length+await attendance.count())fail()
  await input.beforeWrite()
  onStage('ACCESS_SUBMIT')
  await access.getByRole('button',{name:/^확인(?:\s|$)/}).click()
  await access.waitFor({state:'hidden'})
  if(input.firstOnly&&!input.enrollmentRecorded)await input.recordEnrollment()

  let contentCount=0
  for(const id of input.weeklyLectureIds){
    const url=`${ORIGIN}/crm/lectures/${input.lectureId}/${id}`
    onStage('VERIFY_VIDEO')
    contentCount+=await verifyCollection(page,url,'영상','video',input)
    onStage('VERIFY_MATERIAL')
    contentCount+=await verifyCollection(page,url,'자료','material',input)
  }
  // The library has its own category UI; do not infer a weekly-material table.
  onStage('VERIFY_LIBRARY')
  contentCount+=await verifyLibrary(page,participants,input,onStage)
  if(!contentCount)fail()
  return {verified:true,lectureId:input.lectureId,studentId:input.studentId,weeklyLectureIds:input.weeklyLectureIds}
}

// A missing row is proof only after the loaded roster explicitly reports zero
// filtered students. Never infer absence from a timeout, a virtualized page, an
// unchecked add-student picker, or unavailable file permissions.
async function inspectRosterOwnership(page,input,onStage=()=>{}) {
  const result=[]
  for(const lectureId of input.lectureIds){
    onStage('OWNERSHIP_ROSTER')
    const target=`${ORIGIN}/crm/lectures/${lectureId}/participants`
    await page.goto(target)
    const roster=page.getByRole('tab',{name:/^수강생 목록\s*\d+명$/})
    await roster.waitFor({state:'visible'})
    await page.waitForLoadState('networkidle',{timeout:10000})
    if(page.url()!==target||await roster.count()!==1)fail()
    async function total(){
      const match=(await roster.innerText()).replace(/\s+/g,'').match(/^수강생목록(\d+)명$/)
      if(!match||!Number.isSafeInteger(Number(match[1])))fail()
      return Number(match[1])
    }
    const count=await total()
    const rows=page.locator('tbody tr[data-row-id]')
    const search=page.getByPlaceholder('검색어 입력 (초성 검색 가능)',{exact:true})
    const filtered=page.getByText(/^필터 적용됨\s*:\s*\d+명$/)
    const filteredCount=async()=>{
      if(await filtered.count()!==1)fail()
      const match=(await filtered.innerText()).replace(/\s+/g,'').match(/^필터적용됨:(\d+)명$/)
      if(!match||!Number.isSafeInteger(Number(match[1])))fail()
      return Number(match[1])
    }
    const empty=page.getByText('차시에서 수강생 추가가 가능해요.',{exact:true})
    if(count===0&&await empty.count()===1&&await empty.isVisible()){
      if(await rows.count()!==0||await total()!==0)fail()
      result.push({id:lectureId,state:'NOT_OWNED'})
      continue
    }
    await page.getByRole('button',{name:'일괄 학생 추가',exact:true}).waitFor({state:'visible'})
    if(await search.count()!==1)fail()
    // Prove the initial roster is unfiltered before using a phone search to
    // establish absence. Existing hidden filters must never hide a student.
    await search.fill('')
    await page.waitForLoadState('networkidle',{timeout:10000})
    if(await filteredCount()!==count||await total()!==count)fail()
    const headers=(await page.locator('thead th').allTextContents()).map(value=>value.replace(/\s+/g,' ').trim())
    if(headers.length!==9||headers[2]!=='이름'||headers[4]!=='학부모 전화번호'||headers[5]!=='학생 전화번호')fail()
    async function completeRosterIds(){
      // A large or virtualized roster can still prove a positive match, but
      // cannot prove absence until every advertised student is represented.
      if(await rows.count()!==count)return null
      const ids=[]
      for(const row of await rows.all()){
        const value=await row.getAttribute('data-row-id'),id=Number(value)
        if(!/^[1-9]\d*$/.test(value??'')||!Number.isSafeInteger(id)||await row.locator('td').count()!==9)fail()
        ids.push(id)
      }
      if(new Set(ids).size!==ids.length)fail()
      return ids.sort((a,b)=>a-b)
    }
    const initialIds=await completeRosterIds()
    await search.fill(input.studentPhone)
    await page.waitForLoadState('networkidle',{timeout:10000})
    if(await total()!==count)fail()
    const found=await filteredCount(),visible=await rows.count()
    if(found===0){
      if(visible!==0||!initialIds||initialIds.includes(input.studentId))fail()
      // Independently reread the complete unfiltered roster. A premature empty
      // search result or a concurrent membership change is never nonownership.
      await search.fill('')
      await page.waitForLoadState('networkidle',{timeout:10000})
      if(await total()!==count||await filteredCount()!==count||
        JSON.stringify(await completeRosterIds())!==JSON.stringify(initialIds))fail()
      result.push({id:lectureId,state:'NOT_OWNED'})
    }else{
      if(found!==1||visible!==1)fail()
      const row=rows.first(),cells=row.locator('td')
      if(await row.getAttribute('data-row-id')!==String(input.studentId)||await cells.count()!==9||
        (await cells.nth(2).innerText()).normalize('NFC').trim()!==input.studentName.normalize('NFC').trim()||
        phone(await cells.nth(5).innerText())!==input.studentPhone)fail()
      result.push({id:lectureId,state:'OWNED'})
    }
    if(await total()!==count||found>0&&(await filteredCount()!==found||await rows.count()!==visible))fail()
  }
  return {studentId:input.studentId,lectures:result}
}

function browserAccessProvider(env,api,{launch,chromium,onStage=()=>{},sessions,operationTimeoutMs=300000,cleanupTimeoutMs=5000}={}) {
  if(env.DAECHION_CONTENT_BROWSER_ENABLED!=='true'||env.DAECHION_CONTENT_BROWSER_VERIFIED!=='true')throw Error('CONTENT_BROWSER_DISABLED')
  if(!Number.isSafeInteger(operationTimeoutMs)||operationTimeoutMs<20||operationTimeoutMs>300000||
    !Number.isSafeInteger(cleanupTimeoutMs)||cleanupTimeoutMs<2||cleanupTimeoutMs>=operationTimeoutMs)throw Error('CONTENT_BROWSER_CONFIGURATION_REQUIRED')
  let state=storageState(env.DAECHION_BROWSER_STORAGE_STATE),memoryBusy=false,quarantined=false
  // BrowserServer exposes public close/kill/process APIs. A connected Browser
  // alone cannot force-terminate its owned Chromium process after a stuck close.
  const browserType=launch?undefined:(chromium??require('playwright').chromium)
  const pendingForever=()=>new Promise(()=>{})
  const outcome=promise=>Promise.resolve(promise).then(()=>true,()=>false)
  async function until(promise,milliseconds){
    let timer
    try{return await Promise.race([promise,new Promise(resolve=>{timer=setTimeout(()=>resolve(false),Math.max(0,milliseconds))})])}
    finally{clearTimeout(timer)}
  }
  function guardedPage(page,scope){
    const wrappers=new WeakMap(),originals=new WeakMap()
    const wrap=value=>{
      if(Array.isArray(value))return value.map(wrap)
      if(!value||typeof value!=='object'||typeof value.getByRole!=='function')return value
      if(wrappers.has(value))return wrappers.get(value)
      const wrapped=new Proxy(value,{get(target,key){
        const member=Reflect.get(target,key)
        if(typeof member!=='function')return member
        return (...args)=>{
          scope.check()
          const result=Reflect.apply(member,target,args.map(arg=>originals.get(arg)??arg))
          return result&&typeof result.then==='function'?scope.step(()=>result).then(wrap):wrap(result)
        }
      }})
      wrappers.set(value,wrapped);originals.set(wrapped,value)
      return wrapped
    }
    return wrap(page)
  }
  function operation(maximumMs=operationTimeoutMs){
    let stopped=false,stopWork,rejectCaller,terminationPending=false,stage='API_PREFLIGHT'
    const deadline=Date.now()+maximumMs,listeners=new Set()
    const error=()=>Object.assign(Error('CONTENT_ACCESS_UNCONFIRMED'),{stage,...(quarantined?{browserTerminationUnconfirmed:true}:{})})
    const interrupted=new Promise((_,reject)=>{stopWork=reject})
    // Cancellation can precede the first awaited step, or occur during cleanup.
    interrupted.catch(()=>{})
    const callerFailure=new Promise((_,reject)=>{rejectCaller=reject})
    const stop=()=>{if(!stopped){stopped=true;stopWork(error());for(const listener of listeners)listener()}}
    const check=()=>{if(stopped)throw error()}
    const workTimer=setTimeout(stop,maximumMs-cleanupTimeoutMs)
    const lifetimeTimer=setTimeout(()=>{if(terminationPending)quarantined=true;stop();rejectCaller(error())},maximumMs)
    return {deadline,error,stop,check,callerFailure,
      report(value){check();stage=value;onStage(value)},
      onStop(listener){listeners.add(listener);if(stopped)listener();return ()=>listeners.delete(listener)},
      async step(action){check();return Promise.race([Promise.resolve().then(()=>{check();return action()}).then(value=>{check();return value}),interrupted])},
      resourcesStarted(){terminationPending=true},resourcesStopped(){terminationPending=false},
      unsafe(){quarantined=true;rejectCaller(error())},
      clear(){clearTimeout(workTimer);clearTimeout(lifetimeTimer)},
    }
  }
  async function execute(input,lease,scope,refreshOnly=false,ownershipOnly=false){
    let browser,server,context,finished=false,closeBrowser,closeServer,killServer
    const report=scope.report
    const step=scope.step
    const requestClose=()=>{
      if(browser&&!closeBrowser)closeBrowser=outcome(Promise.resolve().then(()=>browser.close()))
      if(server&&!closeServer)closeServer=outcome(Promise.resolve().then(()=>server.close()))
    }
    const requestKill=()=>killServer??(killServer=outcome(Promise.resolve().then(()=>server.kill())))
    const acceptServer=value=>{server=value;scope.resourcesStarted();if(finished){requestClose();void requestKill()}return value}
    const acceptBrowser=value=>{browser=value;scope.resourcesStarted();if(finished)requestClose();return value}
    const abort=()=>{
      scope.stop()
      // A disconnected DB has already lost its advisory lock. Stop the owned
      // browser immediately rather than spending the grace interval unlocked.
      if(server)void requestKill()
    }
    // Install before lease checks, launch and newContext: DB loss must interrupt
    // any pending step, including a promise which never resolves.
    lease.signal.addEventListener('abort',abort,{once:true})
    const removeStop=scope.onStop(requestClose)
    if(lease.signal.aborted)scope.stop()
    async function cleanup(){
      finished=true
      requestClose()
      const remaining=()=>Math.max(0,scope.deadline-Date.now()-1)
      const grace=Math.min(Math.floor(cleanupTimeoutMs/2),remaining())
      const closed=()=>server?(killServer?Promise.race([closeServer,killServer]):closeServer):(browser?closeBrowser:Promise.resolve(true))
      if(await until(closed(),grace))return true
      // Only kill the BrowserServer created by this operation. Never discover
      // or kill a shared browser, PID from configuration, or unrelated process.
      if(!server)return false
      const killed=requestKill()
      if(await until(killed,Math.min(Math.floor(cleanupTimeoutMs/4),remaining())))return true
      try{
        const child=server.process()
        if(child.exitCode!==null||child.signalCode!==null)return true
        const exited=new Promise(resolve=>child.once('exit',()=>resolve(true)))
        child.kill('SIGKILL')
        return await until(Promise.race([killed,exited]),remaining())
      }catch{return false}
    }
    try {
      await step(()=>lease.assert())
      report('API_PREFLIGHT')
      if(ownershipOnly&&(!Array.isArray(input.lectureIds)||input.lectureIds.length<1||input.lectureIds.length>30||
        input.lectureIds.some(id=>!Number.isSafeInteger(id)||id<=0)||new Set(input.lectureIds).size!==input.lectureIds.length))fail()
      if(!refreshOnly&&!ownershipOnly&&(!Number.isSafeInteger(input.lectureId)||input.lectureId<=0))fail()
      if(!refreshOnly&&(!Number.isSafeInteger(input.studentId)||input.studentId<=0||
        !/^01\d{9}$/.test(input.studentPhone)||!input.studentName?.trim()))fail()
      if(!refreshOnly&&!ownershipOnly&&(!uniqueIds(input.weeklyLectureIds)||
        !/^01\d{9}$/.test(input.studentPhone)||!input.studentName?.trim()||typeof input.beforeWrite!=='function'))fail()
      if(String((await step(()=>api.me())).tenantId)!==env.DAECHION_TENANT_ID?.trim())fail()
      let initialProfile
      if(!refreshOnly){
        const student=await step(()=>api.student(input.studentId))
        if(student.id!==input.studentId||phone(student.studentPhoneNumber)!==input.studentPhone||student.name.normalize('NFC').trim()!==input.studentName.normalize('NFC').trim())fail()
        if(ownershipOnly)initialProfile=JSON.stringify({id:student.id,name:student.name.normalize('NFC').trim(),
          studentPhone:phone(student.studentPhoneNumber),guardians:[phone(student.parentPhoneNumber),phone(student.parentPhoneNumber2)].sort()})
      }
      let lecture
      if(ownershipOnly){
        const catalog=await step(()=>api.lectures())
        for(const id of input.lectureIds){
          const matches=catalog.filter(item=>item.id===id)
          if(matches.length!==1||!matches[0].opened||!matches[0].weeklyLectures?.length)fail()
        }
      }else if(!refreshOnly){
        const matches=(await step(()=>api.lectures())).filter(item=>item.id===input.lectureId)
        if(matches.length!==1)fail()
        lecture=matches[0]
        const names=lecture.weeklyLectures.map(week=>week.name.replace(/\s+/g,' ').trim())
        if(!lecture.opened||!names.length||names.some(name=>!name.trim()||name==='전체 선택'))fail()
        if(input.firstOnly){
          if(input.weeklyLectureIds.length!==1||lecture.weeklyLectures[0].id!==input.weeklyLectureIds[0]||
            names.filter(name=>name===names[0]).length!==1||typeof input.enrollmentRecorded!=='boolean'||typeof input.recordEnrollment!=='function')fail()
        }else if(!sameIds(lecture.weeklyLectures.map(week=>week.id),input.weeklyLectureIds)||new Set(names).size!==names.length)fail()
      }
      report('BROWSER_LAUNCH')
      const launchOptions={headless:true,timeout:Math.max(1,scope.deadline-Date.now()-cleanupTimeoutMs)}
      if(launch)await step(()=>Promise.resolve(launch(launchOptions)).then(acceptBrowser))
      else{
        await step(()=>Promise.resolve(browserType.launchServer(launchOptions)).then(acceptServer))
        await step(()=>Promise.resolve(browserType.connect(server.wsEndpoint(),{timeout:launchOptions.timeout})).then(acceptBrowser))
      }
      report('BROWSER_CONTEXT')
      let initialState=lease.state
      if(refreshOnly&&input.exerciseExpiredAccess){
        if(env.DAECHION_CONTENT_TEST_ONLY!=='true'||env.DAECHION_CONTENT_TEST_LECTURE_ID!==String(input.lectureId))fail()
        initialState=require('./token-state.cjs').expiredAccessCopy(initialState)
      }
      context=await step(()=>Promise.resolve(browser.newContext({storageState:storageState(initialState),acceptDownloads:false})).then(value=>{
        // A late context must never continue into routing/page creation. Closing
        // it also covers synthetic or disconnected browser implementations.
        if(finished)void outcome(Promise.resolve().then(()=>value.close()))
        return value
      }))
      context.setDefaultTimeout(10000)
      // Do not record traces, screenshots, requests, cookies or student lists.
      await step(()=>context.route('**/*',route=>{
        const request=route.request(),url=new URL(request.url())
        return url.protocol==='https:'&&[ORIGIN,'https://api.daechion.com'].includes(url.origin)&&request.method()!=='DELETE'?route.continue():route.abort()
      }))
      const page=guardedPage(await step(()=>context.newPage()),scope)
      const authenticated=async()=>{
        await step(()=>lease.assert())
        const saved=await step(()=>context.storageState())
        await step(()=>lease.save(JSON.stringify(saved)))
      }
      if(refreshOnly){
        report('SESSION_REFRESH')
        // Authentication is academy-wide. Deleted courses, empty catalogs and
        // roster changes must never make a valid administrator session fail.
        const target=`${ORIGIN}/crm/lectures`
        await step(()=>page.goto(target))
        await step(()=>page.getByRole('heading',{name:'강의 관리',exact:true}).waitFor({state:'visible'}))
        await step(()=>page.getByRole('tab',{name:'강의 목록',exact:true}).waitFor({state:'visible'}))
        const admin=page.getByRole('link',{name:'관리자',exact:true})
        await step(()=>admin.waitFor({state:'visible'}))
        if(await step(()=>admin.getAttribute('href'))!=='/crm/admin')fail()
        if(page.url()!==target)fail()
        if(input.exerciseExpiredAccess){
          const expiry=require('./token-state.cjs').accessExpiry(JSON.stringify(await step(()=>context.storageState())))
          if(!expiry||expiry<=Date.now()/1000+30)fail()
        }
        await authenticated()
        return {refreshed:true,...(input.exerciseExpiredAccess?{expiredAccessExercised:true}:{})}
      }
      if(ownershipOnly){
        let observedRead=false,failedRead=false
        const apiRead=request=>['xhr','fetch'].includes(request.resourceType())&&new URL(request.url()).origin==='https://api.daechion.com'
        // A UI may render its default zero while its roster request fails.
        // Observe status only; never retain response bodies, URLs or students.
        page.on('response',response=>{
          try{
            if(apiRead(response.request())){
              if(response.status()>=400)failedRead=true
              else if(response.status()>=200&&response.status()<300)observedRead=true
            }
          }catch{failedRead=true}
        })
        page.on('requestfailed',request=>{try{if(apiRead(request))failedRead=true}catch{failedRead=true}})
        page.on('pageerror',()=>{failedRead=true})
        const result=await step(()=>inspectRosterOwnership(page,input,report))
        if(failedRead||!observedRead)fail()
        const student=await step(()=>api.student(input.studentId)),matches=await step(()=>api.students(input.studentPhone,''))
        const current=JSON.stringify({id:student.id,name:student.name.normalize('NFC').trim(),studentPhone:phone(student.studentPhoneNumber),
          guardians:[phone(student.parentPhoneNumber),phone(student.parentPhoneNumber2)].sort()})
        if(current!==initialProfile||matches.length!==1||matches[0].id!==input.studentId||
          String((await step(()=>api.me())).tenantId)!==env.DAECHION_TENANT_ID?.trim())fail()
        await authenticated()
        if(failedRead||!observedRead)fail()
        return result
      }
      const guardedInput={...input,beforeWrite:async()=>{
        const current=await step(()=>api.student(input.studentId)),matches=await step(()=>api.students(input.studentPhone,''))
        if(current.id!==input.studentId||phone(current.studentPhoneNumber)!==input.studentPhone||current.name.normalize('NFC').trim()!==input.studentName.normalize('NFC').trim()||
          matches.length!==1||matches[0].id!==input.studentId)fail()
        await step(()=>lease.assert())
        await step(()=>input.beforeWrite())
      },recordEnrollment:()=>step(()=>input.recordEnrollment())}
      const result=await step(()=>applyAndVerify(page,guardedInput,lecture,report,authenticated))
      await authenticated()
      return result
    } catch {throw scope.error()}
    finally{
      scope.stop()
      if(!await cleanup()){
        // Return a bounded failure to the caller, but keep sessions.run pending
        // and its advisory lock held while a browser may still perform writes.
        // Recovery requires terminating/replacing this worker process.
        scope.unsafe()
        await pendingForever()
      }
      scope.resourcesStopped()
      removeStop()
      lease.signal.removeEventListener('abort',abort)
    }
  }
  async function run(input,refreshOnly=false,ownershipOnly=false){
    if(quarantined)throw Object.assign(Error('CONTENT_ACCESS_UNCONFIRMED'),{stage:'BROWSER_CONTEXT',browserTerminationUnconfirmed:true})
    const scope=operation(ownershipOnly?Math.min(operationTimeoutMs,60000):operationTimeoutMs)
    if(sessions){
      try{return await Promise.race([Promise.resolve().then(()=>sessions.run(lease=>execute(input,lease,scope,refreshOnly,ownershipOnly))),scope.callerFailure])}
      finally{scope.clear()}
    }
    // Isolated tests/local tooling only. Production injects durable sessions.
    if(memoryBusy){scope.clear();throw Error('CONTENT_SESSION_BUSY')}
    memoryBusy=true
    const work=execute(input,{state:JSON.stringify(state),signal:new AbortController().signal,assert:async()=>{},save:async value=>{state=storageState(value)}},scope,refreshOnly,ownershipOnly)
      .finally(()=>{memoryBusy=false})
    try{return await Promise.race([work,scope.callerFailure])}
    finally{scope.clear()}
  }
  return {isAvailable:()=>!quarantined,ensureContentAccess:input=>run(input),
    inspectOwnership:input=>run(input,false,true),
    ensureFirstLessonAccess:input=>run({...input,firstOnly:true,weeklyLectureIds:[input.weeklyLectureId]}),
    refreshSession:(lectureId,options={})=>run({lectureId,exerciseExpiredAccess:options.exerciseExpiredAccess===true},true)}
}
module.exports={browserAccessProvider,applyAndVerify,inspectRosterOwnership,verifyFile,verifyCollection,verifyLibrary,storageState,exactStudentRow,ACCESS_LABELS}
