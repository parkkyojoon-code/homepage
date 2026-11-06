// Explicit, single-target acceptance check. No DB, billing, SMS or worker loop.
async function verifyContent(argv,env,{api,accessFactory}={}){
  if(argv.length!==5||argv[0]!=='--student-id'||argv[2]!=='--lecture-id'||argv[4]!=='--verify'||
    ![argv[1],argv[3]].every(value=>/^[1-9]\d*$/.test(value)&&Number.isSafeInteger(Number(value))))throw Error('CONTENT_TEST_ARGUMENTS_REQUIRED')
  const studentId=Number(argv[1]),lectureId=Number(argv[3])
  if(env.DAECHION_CONTENT_TEST_ONLY!=='true'||env.DAECHION_CONTENT_TEST_STUDENT_ID!==String(studentId)||
    env.DAECHION_CONTENT_TEST_LECTURE_ID!==String(lectureId)||!env.DAECHION_API_KEY?.trim()||!env.DAECHION_TENANT_ID?.trim())throw Error('CONTENT_TEST_CONFIGURATION_REQUIRED')
  if(!api){const {daechionClient}=require('../.daechion-worker-build/lib/daechion/client.js');api=daechionClient({apiKey:env.DAECHION_API_KEY})}
  if(String((await api.me()).tenantId)!==env.DAECHION_TENANT_ID.trim())throw Error('CONTENT_TEST_TENANT_MISMATCH')
  const student=await api.student(studentId),matches=(await api.lectures()).filter(item=>item.id===lectureId)
  const studentPhone=String(student.studentPhoneNumber??'').replace(/[\s-]/g,'')
  if(student.id!==studentId||!/^01\d{9}$/.test(studentPhone)||matches.length!==1||!matches[0].opened||!matches[0].weeklyLectures.length)throw Error('CONTENT_TEST_TARGET_UNCONFIRMED')
  const {browserAccessProvider}=require('../workers/daechion/browser/provider.cjs')
  // Only this explicitly allowlisted test call bypasses the not-yet-verified
  // runtime flags. Never change the environment or start automatic processing.
  const service=(accessFactory??browserAccessProvider)({...env,DAECHION_CONTENT_BROWSER_ENABLED:'true',DAECHION_CONTENT_BROWSER_VERIFIED:'true'},api)
  const result=await service.ensureContentAccess({studentId,lectureId,weeklyLectureIds:matches[0].weeklyLectures.map(week=>week.id),
    studentName:student.name,studentPhone,beforeWrite:async()=>{
      if(env.DAECHION_CONTENT_TEST_ONLY!=='true'||env.DAECHION_CONTENT_TEST_STUDENT_ID!==String(studentId)||env.DAECHION_CONTENT_TEST_LECTURE_ID!==String(lectureId))throw Error('CONTENT_TEST_TARGET_UNCONFIRMED')
    }})
  if(result?.verified!==true||result.studentId!==studentId||result.lectureId!==lectureId)throw Error('CONTENT_TEST_TARGET_UNCONFIRMED')
  return {testOnly:true,verified:true,studentId,lectureId,weeklyLectureCount:result.weeklyLectureIds.length}
}
if(require.main===module)verifyContent(process.argv.slice(2),process.env).then(result=>console.log(JSON.stringify(result))).catch(error=>{
  const code=/^CONTENT_TEST_(ARGUMENTS_REQUIRED|CONFIGURATION_REQUIRED|TENANT_MISMATCH|TARGET_UNCONFIRMED)$/.test(error?.message??'')?error.message:'CONTENT_TEST_FAILED'
  console.error(code);process.exitCode=1
})
module.exports={verifyContent}
