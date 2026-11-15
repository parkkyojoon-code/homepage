import {NextResponse} from 'next/server'
import {CatalogStoreError} from './catalog-store.cjs'

export function catalogFailure(error:unknown){
  if(error instanceof CatalogStoreError&&error.code==='CATALOG_CONFLICT')return NextResponse.json({error:'수업 정보가 변경되었습니다. 다시 불러와주세요.',code:'CATALOG_CONFLICT'},{status:409})
  if(error instanceof SyntaxError)return NextResponse.json({error:'입력 내용을 확인해주세요.'},{status:400})
  return NextResponse.json({error:'수업 데이터를 읽거나 저장하지 못했습니다. 관리자에게 확인을 요청해주세요.',code:'CATALOG_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}})
}
