import {z} from 'zod'
import type {ReadyMessageProvider} from '../ready-message'
import type {PaymentProvider} from '../payssam'
import type {SheetsApi} from '../sheets-publisher'
import type {OrderConnection} from './worker-store'
import type {OrderSheetTarget} from './sheets-publisher'
import {sendOrderReady} from './ready-message'
import {deliverOrderSheet} from './sheet-recovery'

export function orderDeliverySettings(env:Record<string,string|undefined>){
  if(env.DAECHION_ORDER_WORKER_ENABLED!=='true')return {message:false,sheets:false}
  const message=env.DAECHION_ORDER_READY_MESSAGE_ENABLED==='true',sheets=env.DAECHION_ORDER_SHEETS_ENABLED==='true'
  if(message&&env.DAECHION_READY_MESSAGE_ENABLED==='true')throw Error('ORDER_LEGACY_MESSAGES_MUST_BE_DISABLED')
  if(message&&env.DAECHION_ORDER_PAYMENT_READ_ENABLED!=='true')throw Error('ORDER_MESSAGE_REQUIRES_PAYMENT_READ')
  return {message,sheets}
}
export function orderSheetTarget(env:Record<string,string|undefined>):OrderSheetTarget{
  const file=z.string().regex(/^[\w-]{20,200}$/),tab=z.string().regex(/^\d+$/).transform(Number).refine(v=>Number.isSafeInteger(v)&&v>=0)
  return {spreadsheetId:file.parse(env.DAECHION_ORDER_SHEETS_SPREADSHEET_ID),sheetId:tab.parse(env.DAECHION_ORDER_SHEETS_SHEET_ID),
    legacySpreadsheetId:file.parse(env.GOOGLE_SHEET_ID),singleIntake:{spreadsheetId:file.parse(env.DAECHION_SHEETS_SPREADSHEET_ID),sheetId:tab.parse(env.DAECHION_SHEETS_SHEET_ID)}}
}
export async function deliverOrder(id:string,rawFlags:unknown,ports:OrderConnection&{message:ReadyMessageProvider;payment:PaymentProvider;api:SheetsApi;target:OrderSheetTarget}){
  const flags=z.object({message:z.boolean(),sheets:z.boolean()}).strict().parse(rawFlags)
  if(!flags.message&&!flags.sheets)return {message:'DISABLED',sheets:'DISABLED'}
  z.string().uuid().parse(id)
  // A provider/DB failure is a bounded status, never a serialized error with PII.
  const message=flags.message?await sendOrderReady(id,true,ports).catch(()=> 'UNKNOWN'):'DISABLED'
  const sheets=flags.sheets?await deliverOrderSheet(id,true,ports).catch(()=> 'UNKNOWN'):'DISABLED'
  return {message,sheets}
}
