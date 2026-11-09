import type {SheetsApi} from '../sheets-publisher'
import {sheetsDestination} from '../sheets-view'
import {ORDER_HEADERS,LEGACY_ORDER_HEADERS,orderFormatting,type OrderSheetView} from './sheets-view'

export interface OrderSheetTarget {spreadsheetId:string;legacySpreadsheetId:string;sheetId:number;singleIntake:{spreadsheetId:string;sheetId:number}}
const marker='pkjmath_order_sheet_v1',rowKey='pkjmath_order_id'
function base(target:OrderSheetTarget){
  sheetsDestination(target.spreadsheetId,target.legacySpreadsheetId)
  if(target.spreadsheetId==='1jzwafX-L-QatwQUxlv5VnLqYZIZB3GQjRKmTEUp2L3g'||!Number.isSafeInteger(target.sheetId)||target.sheetId<0||
    !/^[\w-]{20,200}$/.test(target.singleIntake?.spreadsheetId??'')||!Number.isSafeInteger(target.singleIntake.sheetId)||target.singleIntake.sheetId<0||
    target.spreadsheetId===target.singleIntake.spreadsheetId&&target.sheetId===target.singleIntake.sheetId)throw Error('INVALID_ORDER_SHEET_TARGET')
  return `/spreadsheets/${target.spreadsheetId}`
}
export function validateOrderSheetTarget(target:OrderSheetTarget){base(target)}
type Metadata={metadataId:number;location:{sheetId?:number;dimensionRange?:{sheetId?:number;dimension:string;startIndex:number;endIndex:number}}}
async function find(api:SheetsApi,target:OrderSheetTarget,key:string,value:string):Promise<Metadata[]>{
  const data=await api.call('POST',base(target)+'/developerMetadata:search',{dataFilters:[{developerMetadataLookup:{metadataKey:key,metadataValue:value,visibility:'DOCUMENT',
    metadataLocation:{sheetId:target.sheetId},locationMatchingStrategy:'INTERSECTING_LOCATION'}}]})
  if(data.matchedDeveloperMetadata===undefined)return []
  if(!Array.isArray(data.matchedDeveloperMetadata))throw Error('ORDER_SHEET_METADATA_INVALID')
  return data.matchedDeveloperMetadata.map(r=>(r as {developerMetadata:Metadata}).developerMetadata)
}
async function tab(api:SheetsApi,target:OrderSheetTarget){
  const data=await api.call('GET',base(target)+'?fields=sheets.properties')
  const properties=(data.sheets as {properties:{sheetId:number;title:string;gridProperties:{columnCount:number}}}[]|undefined)?.filter(s=>s.properties.sheetId===target.sheetId)
  if(properties?.length!==1||typeof properties[0].properties.title!=='string')throw Error('ORDER_SHEET_TAB_NOT_FOUND')
  return properties[0].properties
}
const a1=(title:string)=>encodeURIComponent("'"+title.replace(/'/g,"''")+"'")
const cells=(values:readonly(string|number)[])=>values.map(value=>({userEnteredValue:typeof value==='number'?{numberValue:value}:{stringValue:value}}))
export async function setupOrderSheet(api:SheetsApi,target:OrderSheetTarget){
  const root=base(target),sheet=await tab(api,target)
  const header=await api.call('GET',root+'/values/'+a1(sheet.title)+'!1:1')
  const existing=(header.values as unknown[][]|undefined)?.[0]??[],tagged=await find(api,target,marker,'1')
  if(tagged.length===1&&JSON.stringify(existing.slice(0,ORDER_HEADERS.length))===JSON.stringify(ORDER_HEADERS))return
  // Insert before the existing notes column. Never overwrite notes or move rows;
  // row developer metadata and all historical financial columns stay intact.
  if(tagged.length===1&&JSON.stringify(existing)===JSON.stringify([...LEGACY_ORDER_HEADERS,'직원 메모'])){
    const requests=[
      {insertDimension:{range:{sheetId:target.sheetId,dimension:'COLUMNS',startIndex:LEGACY_ORDER_HEADERS.length,endIndex:ORDER_HEADERS.length},inheritFromBefore:true}},
      {updateCells:{start:{sheetId:target.sheetId,rowIndex:0,columnIndex:0},rows:[{values:cells([...ORDER_HEADERS,'직원 메모'])}],fields:'userEnteredValue'}},
      ...orderFormatting(target.sheetId).slice(3),
    ]
    const result=await api.call('POST',root+':batchUpdate',{requests})
    if(result.spreadsheetId!==target.spreadsheetId||!Array.isArray(result.replies)||result.replies.length!==requests.length)throw Error('ORDER_SHEET_SETUP_UNKNOWN')
    return
  }
  if(tagged.length||existing.length)throw Error('ORDER_SHEET_TAB_NOT_EMPTY')
  if(!Number.isSafeInteger(sheet.gridProperties?.columnCount)||sheet.gridProperties.columnCount<1)throw Error('ORDER_SHEET_TAB_INVALID')
  const all=await api.call('GET',root+'/values/'+a1(sheet.title))
  if((all.values as unknown[][]|undefined)?.some(r=>r.some(v=>v!==''&&v!==null)))throw Error('ORDER_SHEET_TAB_NOT_EMPTY')
  const requests=[
    {updateSheetProperties:{properties:{sheetId:target.sheetId,gridProperties:{columnCount:Math.max(sheet.gridProperties.columnCount,ORDER_HEADERS.length+1),frozenRowCount:1}},fields:'gridProperties.columnCount,gridProperties.frozenRowCount'}},
    {updateCells:{start:{sheetId:target.sheetId,rowIndex:0,columnIndex:0},rows:[{values:cells([...ORDER_HEADERS,'직원 메모'])}],fields:'userEnteredValue'}},
    {repeatCell:{range:{sheetId:target.sheetId,startRowIndex:0,startColumnIndex:0,endColumnIndex:ORDER_HEADERS.length},cell:{userEnteredFormat:{wrapStrategy:'WRAP',verticalAlignment:'TOP'}},fields:'userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment'}},
    {createDeveloperMetadata:{developerMetadata:{metadataKey:marker,metadataValue:'1',visibility:'DOCUMENT',location:{sheetId:target.sheetId}}}},...orderFormatting(target.sheetId)]
  const result=await api.call('POST',root+':batchUpdate',{requests})
  if(result.spreadsheetId!==target.spreadsheetId||!Array.isArray(result.replies)||result.replies.length!==requests.length)throw Error('ORDER_SHEET_SETUP_UNKNOWN')
}
export async function publishOrder(api:SheetsApi,target:OrderSheetTarget,view:OrderSheetView,existingOnly=false){
  const root=base(target)
  if((await find(api,target,marker,'1')).length!==1)throw Error('ORDER_SHEET_NOT_INITIALIZED')
  const sheet=await tab(api,target),header=await api.call('GET',root+'/values/'+a1(sheet.title)+'!1:1')
  if(JSON.stringify((header.values as unknown[][]|undefined)?.[0]?.slice(0,ORDER_HEADERS.length))!==JSON.stringify(ORDER_HEADERS))throw Error('ORDER_SHEET_HEADERS_CHANGED')
  if(view.values.length!==ORDER_HEADERS.length||view.values[0]!==view.id)throw Error('ORDER_SHEET_VIEW_INVALID')
  const rows=await find(api,target,rowKey,view.id)
  if(rows.length>1)throw Error('ORDER_SHEET_DUPLICATE_ROW')
  if(rows.length===0){
    if(existingOnly)throw Error('ORDER_SHEET_RECONCILIATION_ROW_REQUIRED')
    const result=await api.call('POST',root+':batchUpdate',{requests:[
      {insertDimension:{range:{sheetId:target.sheetId,dimension:'ROWS',startIndex:1,endIndex:2},inheritFromBefore:false}},
      {updateCells:{start:{sheetId:target.sheetId,rowIndex:1,columnIndex:0},rows:[{values:cells(view.values)}],fields:'userEnteredValue'}},
      {createDeveloperMetadata:{developerMetadata:{metadataKey:rowKey,metadataValue:view.id,visibility:'DOCUMENT',location:{dimensionRange:{sheetId:target.sheetId,dimension:'ROWS',startIndex:1,endIndex:2}}}}},
    ]})
    if(result.spreadsheetId!==target.spreadsheetId||!Array.isArray(result.replies)||result.replies.length!==3)throw Error('ORDER_SHEET_INSERT_UNKNOWN')
    return
  }
  const row=rows[0],range=row.location?.dimensionRange
  if(!Number.isSafeInteger(row.metadataId)||row.metadataId<=0||!range||!Number.isSafeInteger(range.startIndex)||range.startIndex<1||range.endIndex!==range.startIndex+1||
    (range.sheetId===undefined?0:range.sheetId)!==target.sheetId||range.dimension!=='ROWS')throw Error('ORDER_SHEET_ROW_INVALID')
  const read=async()=>{
    const result=await api.call('POST',root+'/values:batchGetByDataFilter',{dataFilters:[{developerMetadataLookup:{metadataId:row.metadataId}}],majorDimension:'ROWS',valueRenderOption:'UNFORMATTED_VALUE'})
    const ranges=result.valueRanges as {valueRange?:{values?:unknown[][]}}[]|undefined,data=ranges?.[0]?.valueRange?.values
    if(result.spreadsheetId!==target.spreadsheetId||ranges?.length!==1||data?.length!==1||data[0][0]!==view.id)throw Error('ORDER_SHEET_BOUND_ROW_CHANGED')
    return data[0]
  }
  await read()
  const result=await api.call('POST',root+'/values:batchUpdateByDataFilter',{valueInputOption:'RAW',data:[{dataFilter:{developerMetadataLookup:{metadataId:row.metadataId}},majorDimension:'ROWS',values:[view.values]}]})
  if(result.spreadsheetId!==target.spreadsheetId||result.totalUpdatedRows!==1)throw Error('ORDER_SHEET_UPDATE_UNKNOWN')
  if(existingOnly){const saved=await read();if(JSON.stringify(view.values.map((_,i)=>saved[i]??''))!==JSON.stringify(view.values))throw Error('ORDER_SHEET_RECONCILIATION_UNCONFIRMED')}
}
