// Explicit synthetic-data preload for isolated local/CI tests only.
if(process.env.DAECHION_CATALOG_FIXTURE!=='local-only')throw Error('LOCAL_CATALOG_FIXTURE_REQUIRED')
const originalFetch=globalThis.fetch
globalThis.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url)
  if(url.hostname!=='api.daechion.com')return originalFetch(input,init)
  if((init?.method??'GET')!=='GET')throw Error('FIXTURE_FORBIDS_PROVIDER_WRITES')
  if(url.pathname==='/v1/me')return Response.json({tenantId:'test-only',keyId:'fixture',scopes:['lectures:read']})
  if(url.pathname==='/v1/lectures')return Response.json([
    {id:101,name:'가상 강의',opened:true,weeklyLectures:[{id:1001,name:'가상 차시'}]},
    {id:102,name:'가상 강의',opened:true,weeklyLectures:[{id:1002,name:'가상 차시'}]},
    {id:103,name:'종료된 가상 강의',opened:false,weeklyLectures:[{id:1003,name:'가상 차시'}]},
  ])
  throw Error('UNEXPECTED_FIXTURE_REQUEST')
}
