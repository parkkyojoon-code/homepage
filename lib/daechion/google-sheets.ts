import { createRequire } from 'node:module'
import path from 'node:path'
import type { SheetsApi } from './sheets-publisher'

export function googleSheetsApi(credentialsJson:string):SheetsApi {
  let credentials:Record<string,unknown>
  try {credentials=JSON.parse(credentialsJson)}catch{throw Error('SHEETS_CREDENTIALS_REQUIRED')}
  if(!credentials?.client_email||!credentials?.private_key)throw Error('SHEETS_CREDENTIALS_REQUIRED')
  // Load the existing googleapis dependency only in the explicitly enabled worker.
  const requireGoogle=createRequire(path.join(process.cwd(),'package.json'))
  const {google}=requireGoogle('googleapis') as {google:{auth:{GoogleAuth:new(options:unknown)=>{getClient():Promise<{request(options:unknown):Promise<{data:Record<string,unknown>}>}>}}}}
  const auth=new google.auth.GoogleAuth({credentials,scopes:['https://www.googleapis.com/auth/spreadsheets']})
  return {async call(method,requestPath,body){
    if(!requestPath.startsWith('/spreadsheets/'))throw Error('INVALID_SHEETS_PATH')
    try {
      const client=await auth.getClient()
      return (await client.request({url:'https://sheets.googleapis.com/v4'+requestPath,method,data:body,timeout:15000,retry:false,maxRedirects:0})).data
    } catch {throw Error('SHEETS_REQUEST_UNCONFIRMED')}
  }}
}
