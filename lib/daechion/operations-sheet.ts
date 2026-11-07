import type { SheetsApi, SheetTarget } from './sheets-publisher'
import { SHEET_HEADERS, sheetsDestination } from './sheets-view'
import { operationLabels, type OperationPhase } from './operations'

const title='자동화 점검', marker='pkjmath_operations_v1', ownedId=611061501
const headers=['상태','신청번호 / 범위','실패 단계','오류 구분','누적 발생 횟수','최초 발생시각','최근 발생시각','복구 확인시각']
const codes:Record<string,string>={FAILED:'처리 실패',UNKNOWN:'결과 확인 필요',DEFERRED:'재시도 대기',API_PREFLIGHT:'API 연결 점검',BROWSER_LAUNCH:'브라우저 시작',BROWSER_CONTEXT:'로그인 상태 준비',SESSION_REFRESH:'인증 화면 확인'}
const time=(value:unknown)=>value?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(value as string)):''
const cells=(values:(string|number)[])=>values.map(value=>({userEnteredValue:typeof value==='number'?{numberValue:value}:{stringValue:value}}))
const tone=(sheetId:number,column:number,text:string,green=false)=>({addConditionalFormatRule:{index:0,rule:{ranges:[{sheetId,startRowIndex:4,startColumnIndex:column,endColumnIndex:column+1}],booleanRule:{condition:{type:'TEXT_EQ',values:[{userEnteredValue:text}]},format:{backgroundColor:green?{red:.85,green:.93,blue:.83}:{red:.72,green:.11,blue:.11},textFormat:{bold:true,foregroundColor:green?{red:.15,green:.3,blue:.07}:{red:1,green:1,blue:1}}}}}}})

// Only this dedicated, metadata-owned tab is replaceable. The application tab,
// staff memo columns, legacy file and unrelated tabs are never cleared.
export async function publishOperations(api:SheetsApi,target:SheetTarget,issues:Record<string,unknown>[],now=new Date()) {
  sheetsDestination(target.spreadsheetId,target.legacySpreadsheetId)
  if(target.spreadsheetId==='1jzwafX-L-QatwQUxlv5VnLqYZIZB3GQjRKmTEUp2L3g'||!Number.isSafeInteger(target.sheetId)||target.sheetId<0)throw Error('INVALID_NEW_SHEET_TARGET')
  const base=`/spreadsheets/${target.spreadsheetId}`
  const document=await api.call('GET',base+'?fields=sheets(properties,developerMetadata)')
  const sheets=document.sheets as {properties:{sheetId:number;title:string;gridProperties?:{rowCount:number;columnCount:number}};developerMetadata?:{metadataKey:string;metadataValue:string}[]}[]|undefined
  const main=sheets?.find(s=>s.properties.sheetId===target.sheetId)
  if(!main?.developerMetadata?.some(m=>m.metadataKey==='pkjmath_process2_sheet_v1'&&m.metadataValue==='1'))throw Error('NEW_SHEET_NOT_INITIALIZED')
  let owned=sheets?.filter(s=>s.developerMetadata?.some(m=>m.metadataKey===marker&&m.metadataValue==='1'))??[]
  if(owned.length>1)throw Error('OPERATIONS_TAB_AMBIGUOUS')
  if(!owned.length){
    if(sheets?.some(s=>s.properties.title===title||s.properties.sheetId===ownedId))throw Error('OPERATIONS_TAB_CONFLICT')
    const reason=SHEET_HEADERS.indexOf('확인 필요 사유')
    const created=await api.call('POST',base+':batchUpdate',{requests:[
      {addSheet:{properties:{sheetId:ownedId,title,gridProperties:{rowCount:Math.max(1000,issues.length+5),columnCount:8,frozenRowCount:4}}}},
      {createDeveloperMetadata:{developerMetadata:{metadataKey:marker,metadataValue:'1',visibility:'DOCUMENT',location:{sheetId:ownedId}}}},
      tone(ownedId,0,'확인 필요'),tone(ownedId,0,'복구 확인',true),
      {addConditionalFormatRule:{index:0,rule:{ranges:[{sheetId:target.sheetId,startRowIndex:1,startColumnIndex:reason,endColumnIndex:reason+1}],booleanRule:{condition:{type:'TEXT_CONTAINS',values:[{userEnteredValue:'오류 확인 필요'}]},format:{backgroundColor:{red:.72,green:.11,blue:.11},textFormat:{bold:true,foregroundColor:{red:1,green:1,blue:1}}}}}}},
      {updateDimensionProperties:{range:{sheetId:ownedId,dimension:'COLUMNS',startIndex:0,endIndex:8},properties:{pixelSize:190},fields:'pixelSize'}},
      {updateDimensionProperties:{range:{sheetId:ownedId,dimension:'COLUMNS',startIndex:1,endIndex:2},properties:{pixelSize:315},fields:'pixelSize'}},
    ]})
    if(created.spreadsheetId!==target.spreadsheetId||!Array.isArray(created.replies)||created.replies.length!==7)throw Error('OPERATIONS_SETUP_UNCONFIRMED')
    owned=[{properties:{sheetId:ownedId,title}}]
  }
  const id=owned[0].properties.sheetId
  if(id===target.sheetId)throw Error('OPERATIONS_TAB_CONFLICT')
  const rows:(string|number)[][]=[['자동화 점검 — DB 기록 기준'],['마지막 실행·시트 반영 확인 (한국시간)',time(now)],
    ['이 시각이 30분 이상 오래되면 실행·연결 확인 필요. Sheets 연결 장애 중에는 갱신되지 않습니다.'],headers,
    ...issues.map(row=>[row.state==='OPEN'?'확인 필요':'복구 확인',row.scope==='WORKER'?'공통 작업자':String(row.scope),operationLabels[row.phase as OperationPhase]??'처리 확인',codes[String(row.code)]??'기록 저장 확인 필요',String(row.occurrences),time(row.first_failed_at),time(row.last_failed_at),time(row.resolved_at)]),
  ]
  if(!issues.length)rows.push(['기록된 오류 없음'])
  const rowCount=Math.max(1000,rows.length,owned[0].properties.gridProperties?.rowCount??0)
  const result=await api.call('POST',base+':batchUpdate',{requests:[
    {updateSheetProperties:{properties:{sheetId:id,gridProperties:{rowCount,columnCount:Math.max(8,owned[0].properties.gridProperties?.columnCount??0),frozenRowCount:4}},fields:'gridProperties'}},
    // Supplying a bounded owned range clears obsolete rows in the same atomic
    // request. Repeating after a timeout cannot duplicate business operations.
    {updateCells:{range:{sheetId:id,startRowIndex:0,endRowIndex:rowCount,startColumnIndex:0,endColumnIndex:8},rows:rows.map(row=>({values:cells(row)})),fields:'userEnteredValue'}},
    {repeatCell:{range:{sheetId:id,startRowIndex:0,endRowIndex:rows.length,startColumnIndex:0,endColumnIndex:8},cell:{userEnteredFormat:{wrapStrategy:'WRAP',verticalAlignment:'TOP'}},fields:'userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment'}},
    {repeatCell:{range:{sheetId:id,startRowIndex:3,endRowIndex:4,startColumnIndex:0,endColumnIndex:8},cell:{userEnteredFormat:{backgroundColor:{red:.19,green:.15,blue:.35},textFormat:{bold:true,foregroundColor:{red:1,green:1,blue:1}}}},fields:'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat'}},
  ]})
  if(result.spreadsheetId!==target.spreadsheetId||!Array.isArray(result.replies)||result.replies.length!==4)throw Error('OPERATIONS_WRITE_UNCONFIRMED')
}
