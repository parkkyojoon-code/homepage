// Reads an existing administrator page and saves only encrypted session state.
// Never creates a student, adds a participant, submits grants, bills or messages.
async function checkSession(argv,env,{api,storeFactory,accessFactory,onStage=()=>{}}={}){
  const options=argv.slice(2)
  if(argv[0]!=='--lecture-id'||!Number.isSafeInteger(Number(argv[1]))||!/^[1-9]\d*$/.test(argv[1]??'')||
    options.some(value=>!['--exercise-expired-access','--reset-session'].includes(value))||new Set(options).size!==options.length)throw Error('SESSION_CHECK_ARGUMENTS_REQUIRED')
  const lectureId=Number(argv[1])
  if(env.DAECHION_CONTENT_TEST_ONLY!=='true'||env.DAECHION_CONTENT_TEST_LECTURE_ID!==String(lectureId))throw Error('SESSION_CHECK_TARGET_REQUIRED')
  if(!api){api=require('../.daechion-worker-build/lib/daechion/client.js').daechionClient({apiKey:env.DAECHION_API_KEY})}
  if(String((await api.me()).tenantId)!==env.DAECHION_TENANT_ID?.trim())throw Error('SESSION_CHECK_TENANT_MISMATCH')
  if(!storeFactory){
    const {withAutomationClient}=require('../.daechion-worker-build/lib/daechion/database.js')
    storeFactory=()=>require('../workers/daechion/browser/session-store.cjs').browserSessionStore(env,withAutomationClient)
  }
  accessFactory??=require('../workers/daechion/browser/provider.cjs').browserAccessProvider
  const settings={...env,DAECHION_CONTENT_BROWSER_ENABLED:'true',DAECHION_CONTENT_BROWSER_VERIFIED:'true'}
  const firstStore=storeFactory()
  if(options.includes('--reset-session'))await firstStore.reset()
  const first=accessFactory(settings,api,{sessions:firstStore,onStage})
  const result=await first.refreshSession(lectureId,{exerciseExpiredAccess:options.includes('--exercise-expired-access')})
  if(result?.refreshed!==true||options.includes('--exercise-expired-access')&&result.expiredAccessExercised!==true)throw Error('SESSION_CHECK_UNCONFIRMED')
  // Reconstruct both provider and session store with the unchanged bootstrap
  // variable. The saved DB state, rather than that old variable, must be loaded.
  const reloaded=accessFactory(settings,api,{sessions:storeFactory(),onStage})
  if((await reloaded.refreshSession(lectureId))?.refreshed!==true)throw Error('SESSION_CHECK_UNCONFIRMED')
  return {readOnly:true,refreshed:true,reloaded:true,expiredAccessExercised:options.includes('--exercise-expired-access'),lectureId}
}
if(require.main===module)checkSession(process.argv.slice(2),process.env,{onStage:stage=>console.log(JSON.stringify({sessionCheckStage:stage}))})
  .then(result=>{console.log(JSON.stringify(result));process.exit(0)})
  .catch(()=>{console.error('SESSION_CHECK_UNCONFIRMED');process.exit(1)})
module.exports={checkSession}
