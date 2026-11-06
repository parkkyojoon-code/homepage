// Read-only provider preflight. Never imports the billing/enrollment worker.
function studentArgument(args) {
  if(args.length===0)return null
  if(args.length!==2||args[0]!=='--student-id'||!/^\d+$/.test(args[1]))throw Error('INVALID_API_CHECK_ARGUMENTS')
  const id=Number(args[1]);if(!Number.isSafeInteger(id)||id<=0)throw Error('INVALID_API_CHECK_ARGUMENTS')
  return id
}
async function runApiCheck(args,env,service) {
  const studentId=studentArgument(args)
  if(!env.DAECHION_API_KEY?.trim()||!env.DAECHION_TENANT_ID?.trim())throw Error('API_CHECK_CONFIGURATION_REQUIRED')
  const me=await service.me()
  if(String(me.tenantId)!==env.DAECHION_TENANT_ID.trim())throw Error('API_CHECK_TENANT_MISMATCH')
  const required=['students:read','students:write','lectures:read','enrollments:write']
  if(required.some(scope=>!me.scopes.includes(scope)))throw Error('API_CHECK_SCOPE_MISSING')
  const lectures=await service.lectures()
  if(new Set(lectures.map(item=>item.id)).size!==lectures.length)throw Error('API_CHECK_DUPLICATE_LECTURE_ID')
  const identityLookup={checked:false,phoneKinds:[],inactiveStudent:false}
  if(studentId!==null){
    const student=await service.student(studentId)
    if(student.id!==studentId)throw Error('API_CHECK_STUDENT_MISMATCH')
    const phoneFields=['studentPhoneNumber','parentPhoneNumber','parentPhoneNumber2']
    const checked=new Map()
    for(const field of phoneFields){
      if(!student[field])continue
      const phone=student[field].replace(/[\s-]/g,'')
      if(!/^01\d{9}$/.test(phone))throw Error('API_CHECK_INVALID_STUDENT_PHONE')
      if(!checked.has(phone)){
        const found=await service.students(phone,'')
        if(!found.some(item=>item.id===studentId))throw Error('API_CHECK_PHONE_LOOKUP_INCOMPLETE')
        checked.set(phone,true)
      }
      identityLookup.phoneKinds.push(field)
    }
    if(!checked.size)throw Error('API_CHECK_STUDENT_PHONE_MISSING')
    identityLookup.checked=true;identityLookup.inactiveStudent=student.active===false
  }
  // A sample is evidence only; it does not silently enable any production flags.
  return {ready:true,readOnly:true,checkedAt:new Date().toISOString(),tenantId:String(me.tenantId),scopes:required,lectureCount:lectures.length,
    lectures:lectures.map(item=>({id:item.id,name:item.name,opened:item.opened,weekCount:item.weeklyLectures.length})),identityLookup}
}
module.exports={runApiCheck}
if(require.main===module){
  const {loadEnvConfig}=require('@next/env')
  loadEnvConfig(process.cwd(),process.env.NODE_ENV!=='production',{info(){},error(){}})
  ;(async()=>{
    studentArgument(process.argv.slice(2))
    if(!process.env.DAECHION_API_KEY?.trim()||!process.env.DAECHION_TENANT_ID?.trim())throw Error('API_CHECK_CONFIGURATION_REQUIRED')
    const {daechionClient}=require('../.daechion-worker-build/lib/daechion/client.js')
    const service=daechionClient({apiKey:process.env.DAECHION_API_KEY})
    console.log(JSON.stringify(await runApiCheck(process.argv.slice(2),process.env,service)))
  })().catch(error=>{
    console.error(/^API_CHECK_[A-Z_]+$|^INVALID_API_CHECK_ARGUMENTS$/.test(error?.message??'')?error.message:'API_CHECK_FAILED')
    process.exitCode=1
  })
}
