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
  await page.getByRole('button',{name:'일괄 학생 추가',exact:true}).waitFor({state:'visible'})
  if(new URL(page.url()).origin!==ORIGIN||new URL(page.url()).pathname!==new URL(participants).pathname)fail()
  await authenticated()
  await page.getByRole('button',{name:'일괄 학생 추가',exact:true}).click()
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
  for(const week of lecture.weeklyLectures){
    const checkbox=weeks.getByRole('checkbox',{name:week.name,exact:true})
    if(await checkbox.count()!==1)fail()
    await checkbox.setChecked(true)
  }
  // First possible registration write: re-check the DB's payment/hold fence.
  onStage('WEEK_SELECTED')
  await input.beforeWrite()
  await weeks.getByRole('button',{name:'일괄 추가',exact:true}).click()
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

function browserAccessProvider(env,api,{launch,onStage=()=>{},sessions}={}) {
  if(env.DAECHION_CONTENT_BROWSER_ENABLED!=='true'||env.DAECHION_CONTENT_BROWSER_VERIFIED!=='true')throw Error('CONTENT_BROWSER_DISABLED')
  let state=storageState(env.DAECHION_BROWSER_STORAGE_STATE),memoryBusy=false
  const launchBrowser=launch??(options=>require('playwright').chromium.launch(options))
  if(!launch)require.resolve('playwright')
  async function execute(input,lease,refreshOnly=false){
    let browser,context,abort
    let stage='API_PREFLIGHT'
    const report=value=>{stage=value;onStage(value)}
    try {
      await lease.assert()
      report('API_PREFLIGHT')
      if(!Number.isSafeInteger(input.lectureId)||input.lectureId<=0)fail()
      if(!refreshOnly&&(!uniqueIds(input.weeklyLectureIds)||!Number.isSafeInteger(input.studentId)||input.studentId<=0||
        !/^01\d{9}$/.test(input.studentPhone)||!input.studentName?.trim()||typeof input.beforeWrite!=='function'))fail()
      if(String((await api.me()).tenantId)!==env.DAECHION_TENANT_ID?.trim())fail()
      if(!refreshOnly){
        const student=await api.student(input.studentId)
        if(student.id!==input.studentId||phone(student.studentPhoneNumber)!==input.studentPhone||student.name.normalize('NFC').trim()!==input.studentName.normalize('NFC').trim())fail()
      }
      const matches=(await api.lectures()).filter(item=>item.id===input.lectureId)
      if(matches.length!==1)fail()
      const lecture=matches[0],names=lecture.weeklyLectures.map(week=>week.name)
      if(!refreshOnly&&(!lecture.opened||!sameIds(lecture.weeklyLectures.map(week=>week.id),input.weeklyLectureIds)||
        new Set(names).size!==names.length||names.some(name=>!name.trim()||name==='전체 선택')))fail()
      report('BROWSER_LAUNCH')
      browser=await launchBrowser({headless:true})
      report('BROWSER_CONTEXT')
      let initialState=lease.state
      if(refreshOnly&&input.exerciseExpiredAccess){
        if(env.DAECHION_CONTENT_TEST_ONLY!=='true'||env.DAECHION_CONTENT_TEST_LECTURE_ID!==String(input.lectureId))fail()
        initialState=require('./token-state.cjs').expiredAccessCopy(initialState)
      }
      context=await browser.newContext({storageState:storageState(initialState),acceptDownloads:false})
      abort=()=>{void browser.close().catch(()=>{})}
      lease.signal.addEventListener('abort',abort,{once:true})
      if(lease.signal.aborted)fail()
      context.setDefaultTimeout(10000)
      // Do not record traces, screenshots, requests, cookies or student lists.
      await context.route('**/*',route=>{
        const request=route.request(),url=new URL(request.url())
        return url.protocol==='https:'&&[ORIGIN,'https://api.daechion.com'].includes(url.origin)&&request.method()!=='DELETE'?route.continue():route.abort()
      })
      const page=await context.newPage()
      const authenticated=async()=>{await lease.assert();await lease.save(JSON.stringify(await context.storageState()))}
      if(refreshOnly){
        report('SESSION_REFRESH')
        const target=`${ORIGIN}/crm/lectures/${input.lectureId}/participants`
        await page.goto(target)
        await page.getByRole('button',{name:'일괄 학생 추가',exact:true}).waitFor({state:'visible'})
        await page.getByRole('heading',{name:lecture.name,exact:true}).waitFor({state:'visible'})
        if(page.url()!==target)fail()
        if(input.exerciseExpiredAccess){
          const expiry=require('./token-state.cjs').accessExpiry(JSON.stringify(await context.storageState()))
          if(!expiry||expiry<=Date.now()/1000+30)fail()
        }
        await authenticated()
        return {refreshed:true,...(input.exerciseExpiredAccess?{expiredAccessExercised:true}:{})}
      }
      // Closing the browser on the deadline also stops an in-flight UI action;
      // a DB lease alone must never race a still-running browser.
      const guardedInput={...input,beforeWrite:async()=>{
        const current=await api.student(input.studentId),matches=await api.students(input.studentPhone,'')
        if(current.id!==input.studentId||phone(current.studentPhoneNumber)!==input.studentPhone||current.name.normalize('NFC').trim()!==input.studentName.normalize('NFC').trim()||
          matches.length!==1||matches[0].id!==input.studentId)fail()
        await lease.assert()
        await input.beforeWrite()
      }}
      let timer
      try{
        const result=await Promise.race([applyAndVerify(page,guardedInput,lecture,report,authenticated),new Promise((_,reject)=>{timer=setTimeout(()=>{void browser.close().catch(()=>{});reject(Error('CONTENT_ACCESS_UNCONFIRMED'))},300000)})])
        await authenticated()
        return result
      }
      finally{clearTimeout(timer)}
    } catch {throw Object.assign(Error('CONTENT_ACCESS_UNCONFIRMED'),{stage})}
    finally{if(abort)lease.signal.removeEventListener('abort',abort);if(browser)await browser.close().catch(()=>{})}
  }
  async function run(input,refreshOnly=false){
    if(sessions)return sessions.run(lease=>execute(input,lease,refreshOnly))
    // Isolated tests/local tooling only. Production injects durable sessions.
    if(memoryBusy)throw Error('CONTENT_SESSION_BUSY')
    memoryBusy=true
    try{return await execute(input,{state:JSON.stringify(state),signal:new AbortController().signal,assert:async()=>{},save:async value=>{state=storageState(value)}},refreshOnly)}
    finally{memoryBusy=false}
  }
  return {ensureContentAccess:input=>run(input),refreshSession:(lectureId,options={})=>run({lectureId,exerciseExpiredAccess:options.exerciseExpiredAccess===true},true)}
}
module.exports={browserAccessProvider,applyAndVerify,verifyFile,verifyCollection,verifyLibrary,storageState,exactStudentRow,ACCESS_LABELS}
