// Run locally by the administrator. Login is completed by the person, never by
// entering a password in source code, chat or a command-line argument.
const {mkdir,writeFile}=require('node:fs/promises')
const {join}=require('node:path')
const {createInterface}=require('node:readline/promises')
let phase='ARGUMENTS'
async function main(){
  const args=process.argv.slice(2)
  if(args.length!==2||args[0]!=='--lecture-id'||!/^\d+$/.test(args[1])||!Number.isSafeInteger(Number(args[1]))||Number(args[1])<=0)throw Error('AUTH_LECTURE_ID_REQUIRED')
  const {chromium}=require('playwright')
  phase='BROWSER_START'
  const browser=await chromium.launch({headless:false,channel:'chrome'})
  const terminal=createInterface({input:process.stdin,output:process.stdout})
  try{
    const context=await browser.newContext(),page=await context.newPage()
    const target=`https://parkkyojoon.daechion.com/crm/lectures/${Number(args[1])}/participants`
    phase='INITIAL_PAGE'
    await page.goto(target)
    console.log('열린 대치온 브라우저에서 관리자로 직접 로그인하세요. 비밀번호를 이 창에 입력하지 마세요.')
    phase='LOGIN_WAIT'
    await terminal.question('로그인을 마쳤으면 여기서 Enter를 누르세요. 인증 상태를 이 컴퓨터의 비공개 .auth 파일로 저장합니다: ')
    phase='TARGET_PAGE'
    await page.goto(target)
    phase='ADMIN_PAGE_VERIFY'
    await page.getByRole('button',{name:'일괄 학생 추가',exact:true}).waitFor({state:'visible',timeout:15000})
    if(new URL(page.url()).href!==target)throw Error('AUTH_SESSION_UNCONFIRMED')
    phase='STATE_READ'
    const {storageState}=require('./provider.cjs')
    const json=JSON.stringify(await context.storageState())
    phase='STATE_VALIDATE'
    storageState(json)
    const directory=join(__dirname,'.auth'),path=join(directory,'admin.storage-state.json')
    phase='FILE_SAVE'
    await mkdir(directory,{recursive:true,mode:0o700})
    await writeFile(path,json,{mode:0o600})
    console.log('관리자 인증 상태 저장 완료: '+path)
    console.log('이 파일은 비밀번호와 같은 접근 권한을 가집니다. 채팅/Git에 보내지 말고 Railway 비공개 변수에 직접 입력하세요.')
  }finally{terminal.close();await browser.close()}
}
if(require.main===module)main().catch(async error=>{
  // Before INITIAL_PAGE no account, URL, token or password has been supplied.
  // Keep startup diagnostics local so the person need not paste browser logs.
  if(phase==='BROWSER_START'){
    try{
      const directory=join(__dirname,'.auth')
      await mkdir(directory,{recursive:true,mode:0o700})
      await writeFile(join(directory,'browser-start-error.json'),JSON.stringify({phase,message:String(error?.message??'').slice(0,12000)}),{mode:0o600})
    }catch{}
  }
  console.error('AUTH_SESSION_UNCONFIRMED: '+phase+' ('+(error?.name==='TimeoutError'?'Timeout':'Error')+')')
  process.exitCode=1
})
