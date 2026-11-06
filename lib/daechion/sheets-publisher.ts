import { applicationSheetRow, SHEET_HEADERS, sheetsDestination, identityConditionalFormatting, type ApplicationView } from './sheets-view'

export interface SheetsApi {
  call(method:'GET'|'POST',path:string,body?:unknown):Promise<Record<string,unknown>>
}
export interface SheetTarget { spreadsheetId:string; legacySpreadsheetId:string; sheetId:number }
const marker = 'pkjmath_process2_sheet_v1'
const rowKey = 'pkjmath_application_id'
function targetPath(target:SheetTarget) {
  sheetsDestination(target.spreadsheetId,target.legacySpreadsheetId)
  if(target.spreadsheetId==='1jzwafX-L-QatwQUxlv5VnLqYZIZB3GQjRKmTEUp2L3g'||!Number.isSafeInteger(target.sheetId)||target.sheetId<0)throw Error('INVALID_NEW_SHEET_TARGET')
  return `/spreadsheets/${target.spreadsheetId}`
}
type Metadata = {metadataId:number;location:{sheetId?:number;dimensionRange?:{sheetId:number;dimension:string;startIndex:number;endIndex:number}}}
async function findMetadata(api:SheetsApi,target:SheetTarget,key:string,value:string):Promise<Metadata[]> {
  const response=await api.call('POST',targetPath(target)+'/developerMetadata:search',{dataFilters:[{developerMetadataLookup:{
    metadataKey:key,metadataValue:value,visibility:'DOCUMENT',metadataLocation:{sheetId:target.sheetId},locationMatchingStrategy:'INTERSECTING_LOCATION',
  }}]})
  if(response.matchedDeveloperMetadata===undefined)return []
  if(!Array.isArray(response.matchedDeveloperMetadata))throw Error('INVALID_SHEET_METADATA')
  return response.matchedDeveloperMetadata.map(row=>(row as {developerMetadata:Metadata}).developerMetadata)
}
function cells(values:readonly(string|number)[]) {return values.map(value=>({userEnteredValue:typeof value==='number'?{numberValue:value}:{stringValue:value}}))}

// Explicit setup only, on an empty target tab in a separate file. Never call as
// an automatic fallback from publish; an unrecognized tab must remain untouched.
export async function setupApplicationSheet(api:SheetsApi,target:SheetTarget) {
  const base=targetPath(target)
  const metadata=await api.call('GET',base+'?fields=sheets.properties')
  const sheets=metadata.sheets as {properties:{sheetId:number;title:string;gridProperties:{columnCount:number}}}[]
  const sheet=sheets?.find(row=>row.properties.sheetId===target.sheetId)
  if(!sheet)throw Error('NEW_SHEET_TAB_NOT_FOUND')
  const header=await api.call('GET',base+'/values/'+encodeURIComponent("'"+sheet.properties.title.replace(/'/g,"''")+"'!1:1"))
  const existing=(header.values as unknown[][]|undefined)?.[0]??[]
  const tagged=await findMetadata(api,target,marker,'1')
  if(tagged.length===1&&JSON.stringify(existing.slice(0,SHEET_HEADERS.length))===JSON.stringify(SHEET_HEADERS))return
  const expectedHeaders=[...SHEET_HEADERS,'직원 메모']
  const importedTemplate=JSON.stringify(existing)===JSON.stringify(expectedHeaders)
  if((existing.length&&!importedTemplate)||tagged.length)throw Error('NEW_SHEET_TAB_NOT_EMPTY')
  // Inspect the entire used tab before treating it as new; empty headers alone
  // do not imply that rows below them contain no staff data.
  const used=await api.call('GET',base+'/values/'+encodeURIComponent("'"+sheet.properties.title.replace(/'/g,"''")+"'"))
  const usedRows=(used.values as unknown[][]|undefined)??[]
  if(importedTemplate&&JSON.stringify(usedRows[0])!==JSON.stringify(expectedHeaders))throw Error('NEW_SHEET_HEADERS_CHANGED')
  if(usedRows.slice(importedTemplate?1:0).some(row=>row.some(value=>value!==''&&value!==null)))throw Error('NEW_SHEET_TAB_NOT_EMPTY')
  const result=await api.call('POST',base+':batchUpdate',{requests:[
    {updateSheetProperties:{properties:{sheetId:target.sheetId,gridProperties:{columnCount:Math.max(sheet.properties.gridProperties.columnCount,SHEET_HEADERS.length+1),frozenRowCount:1}},fields:'gridProperties.columnCount,gridProperties.frozenRowCount'}},
    {updateCells:{start:{sheetId:target.sheetId,rowIndex:0,columnIndex:0},rows:[{values:cells([...SHEET_HEADERS,'직원 메모'])}],fields:'userEnteredValue'}},
    {createDeveloperMetadata:{developerMetadata:{metadataKey:marker,metadataValue:'1',visibility:'DOCUMENT',location:{sheetId:target.sheetId}}}},
    ...identityConditionalFormatting(target.sheetId),
  ]})
  if(result.spreadsheetId!==target.spreadsheetId||!Array.isArray(result.replies)||result.replies.length!==6)throw Error('SHEET_SETUP_UNCONFIRMED')
}

// Call with an exclusive per-application publish claim. If a write times out,
// keep that claim UNKNOWN and reconcile by metadata before any further insert.
export async function publishApplication(api:SheetsApi,target:SheetTarget,view:ApplicationView) {
  const base=targetPath(target)
  if((await findMetadata(api,target,marker,'1')).length!==1)throw Error('NEW_SHEET_NOT_INITIALIZED')
  const document=await api.call('GET',base+'?fields=sheets.properties')
  const properties=(document.sheets as {properties:{sheetId:number;title:string}}[]|undefined)?.find(row=>row.properties.sheetId===target.sheetId)?.properties
  if(!properties)throw Error('NEW_SHEET_TAB_NOT_FOUND')
  const header=await api.call('GET',base+'/values/'+encodeURIComponent("'"+properties.title.replace(/'/g,"''")+"'!1:1"))
  if(JSON.stringify((header.values as unknown[][]|undefined)?.[0]?.slice(0,SHEET_HEADERS.length))!==JSON.stringify(SHEET_HEADERS))throw Error('NEW_SHEET_HEADERS_CHANGED')
  const rows=await findMetadata(api,target,rowKey,view.id)
  const values=applicationSheetRow(view)
  if(rows.length>1)throw Error('DUPLICATE_SHEET_APPLICATION')
  if(rows.length===1) {
    const row=rows[0],range=row.location.dimensionRange
    if(!Number.isSafeInteger(row.metadataId)||!range||range.sheetId!==target.sheetId||range.dimension!=='ROWS'||range.endIndex-range.startIndex!==1||range.startIndex<1)throw Error('INVALID_SHEET_ROW_METADATA')
    const result=await api.call('POST',base+'/values:batchUpdateByDataFilter',{valueInputOption:'RAW',data:[{
      dataFilter:{developerMetadataLookup:{metadataId:row.metadataId}},majorDimension:'ROWS',values:[values],
    }]})
    if(result.spreadsheetId!==target.spreadsheetId||result.totalUpdatedRows!==1)throw Error('SHEET_ROW_UPDATE_UNCONFIRMED')
  } else {
    // The row, literal cell values and ID metadata are created atomically.
    // Inserting at row 2 also shifts previously attached row metadata.
    const result=await api.call('POST',base+':batchUpdate',{requests:[
      {insertDimension:{range:{sheetId:target.sheetId,dimension:'ROWS',startIndex:1,endIndex:2},inheritFromBefore:false}},
      {updateCells:{start:{sheetId:target.sheetId,rowIndex:1,columnIndex:0},rows:[{values:cells(values)}],fields:'userEnteredValue'}},
      {createDeveloperMetadata:{developerMetadata:{metadataKey:rowKey,metadataValue:view.id,visibility:'DOCUMENT',location:{dimensionRange:{sheetId:target.sheetId,dimension:'ROWS',startIndex:1,endIndex:2}}}}},
    ]})
    if(result.spreadsheetId!==target.spreadsheetId||!Array.isArray(result.replies)||result.replies.length!==3)throw Error('SHEET_ROW_INSERT_UNCONFIRMED')
  }
}
