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
  if(!await row.getByRole('checkbox').isChecked())fail()
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
  await page.goto(url)
  await page.getByRole('tab',{name:tabName,exact:typeof tabName==='string'}).click()
  // Wait for an explicit loaded control rather than interpreting a loading
  // screen as an empty collection.
  await page.getByRole('button',{name:kind==='video'?'영상 추가':'파일 추가',exact:true}).waitFor({state:'visible'})
  await page.waitForLoadState('networkidle',{timeout:10000})
  const titles=await listTitles(page,kind)
  if(titles.length>100||titles.some(title=>!title.trim())||new Set(titles).size!==titles.length)fail()
  for(const title of titles){
    await verifyFile(page,title,input)
    await page.goto(url)
    await page.getByRole('tab',{name:tabName,exact:typeof tabName==='string'}).click()
    await page.getByRole('button',{name:kind==='video'?'영상 추가':'파일 추가',exact:true}).waitFor({state:'visible'})
    await page.waitForLoadState('networkidle',{timeout:10000})
  }
  const after=await listTitles(page,kind)
  if(JSON.stringify([...after].sort())!==JSON.stringify([...titles].sort()))fail()
  return titles.length
}

async function applyAndVerify(page,input,lecture) {
  const participants=`${ORIGIN}/crm/lectures/${input.lectureId}/participants`
  await page.goto(participants)
  // A login redirect or a page for another lecture is not successful auth.
  await page.getByRole('button',{name:'일괄 학생 추가',exact:true}).waitFor({state:'visible'})
  if(new URL(page.url()).origin!==ORIGIN||new URL(page.url()).pathname!==new URL(participants).pathname)fail()
  await page.getByRole('button',{name:'일괄 학생 추가',exact:true}).click()
  const picker=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'일괄 학생 추가',exact:true})})
  await picker.getByRole('textbox',{name:'검색어 입력 (초성 검색 가능)',exact:true}).fill(input.studentPhone)
  const row=await exactStudentRow(picker,input)
  await row.getByRole('checkbox').setChecked(true)
  await picker.getByRole('button',{name:/^1명 추가(?:\s|$)/}).click()
  const weeks=page.getByRole('dialog',{name:'차시 선택',exact:true})
  await weeks.waitFor({state:'visible'})
  const count=await weeks.getByRole('checkbox').count()
  if(count!==lecture.weeklyLectures.length&&count!==lecture.weeklyLectures.length+1)fail()
  for(const week of lecture.weeklyLectures){
    const checkbox=weeks.getByRole('checkbox',{name:week.name,exact:true})
    if(await checkbox.count()!==1)fail()
    await checkbox.setChecked(true)
  }
  // First possible registration write: re-check the DB's payment/hold fence.
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
  await access.getByRole('button',{name:/^확인(?:\s|$)/}).click()
  await access.waitFor({state:'hidden'})

  let contentCount=0
  for(const id of input.weeklyLectureIds){
    const url=`${ORIGIN}/crm/lectures/${input.lectureId}/${id}`
    contentCount+=await verifyCollection(page,url,'영상','video',input)
    contentCount+=await verifyCollection(page,url,'자료','material',input)
  }
  // Library uses the same material table. A changed layout is a review, not a
  // reason to skip verification. Empty libraries are allowed.
  contentCount+=await verifyCollection(page,participants,/^강의 자료실(?:\s|$)/,'material',input)
  if(!contentCount)fail()
  return {verified:true,lectureId:input.lectureId,studentId:input.studentId,weeklyLectureIds:input.weeklyLectureIds}
}

function browserAccessProvider(env,api,{launch}={}) {
  if(env.DAECHION_CONTENT_BROWSER_ENABLED!=='true'||env.DAECHION_CONTENT_BROWSER_VERIFIED!=='true')throw Error('CONTENT_BROWSER_DISABLED')
  const state=storageState(env.DAECHION_BROWSER_STORAGE_STATE)
  const launchBrowser=launch??(options=>require('playwright').chromium.launch(options))
  if(!launch)require.resolve('playwright')
  return {async ensureContentAccess(input){
    let browser
    try {
      if(!uniqueIds(input.weeklyLectureIds)||!Number.isSafeInteger(input.studentId)||input.studentId<=0||!Number.isSafeInteger(input.lectureId)||input.lectureId<=0||
        !/^01\d{9}$/.test(input.studentPhone)||!input.studentName?.trim()||typeof input.beforeWrite!=='function')fail()
      if(String((await api.me()).tenantId)!==env.DAECHION_TENANT_ID?.trim())fail()
      const student=await api.student(input.studentId)
      if(student.id!==input.studentId||phone(student.studentPhoneNumber)!==input.studentPhone||student.name.normalize('NFC').trim()!==input.studentName.normalize('NFC').trim())fail()
      const matches=(await api.lectures()).filter(item=>item.id===input.lectureId)
      if(matches.length!==1)fail()
      const lecture=matches[0],names=lecture.weeklyLectures.map(week=>week.name)
      if(!lecture.opened||!sameIds(lecture.weeklyLectures.map(week=>week.id),input.weeklyLectureIds)||
        new Set(names).size!==names.length||names.some(name=>!name.trim()||name==='전체 선택'))fail()
      browser=await launchBrowser({headless:true})
      const context=await browser.newContext({storageState:state,acceptDownloads:false})
      context.setDefaultTimeout(10000)
      // Do not record traces, screenshots, requests, cookies or student lists.
      await context.route('**/*',route=>{
        const request=route.request(),url=new URL(request.url())
        return url.protocol==='https:'&&[ORIGIN,'https://api.daechion.com'].includes(url.origin)&&request.method()!=='DELETE'?route.continue():route.abort()
      })
      const page=await context.newPage()
      // Closing the browser on the deadline also stops an in-flight UI action;
      // a DB lease alone must never race a still-running browser.
      let timer
      try{return await Promise.race([applyAndVerify(page,input,lecture),new Promise((_,reject)=>{timer=setTimeout(()=>{void browser.close().catch(()=>{});reject(Error('CONTENT_ACCESS_UNCONFIRMED'))},300000)})])}
      finally{clearTimeout(timer)}
    } catch {throw Error('CONTENT_ACCESS_UNCONFIRMED')}
    finally{if(browser)await browser.close().catch(()=>{})}
  }}
}
module.exports={browserAccessProvider,applyAndVerify,storageState,exactStudentRow,ACCESS_LABELS}
