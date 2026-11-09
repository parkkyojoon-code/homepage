import { z } from 'zod'
import type { PurchaseProcess } from '../../purchase-process'
import type { StoredLectureBinding } from '../product-policy'

export type SaleKind='SINGLE'|'BUNDLE'
export class SalePolicyError extends Error {}
// An environment opts in explicitly; deploying the branch alone never permits
// administrators to publish a bundle on an existing site.
export function bundlePublishingReady(env:Readonly<Record<string,string|undefined>>):boolean{
  return env.DAECHION_BUNDLE_PUBLISH_ENABLED==='true'&&env.DAECHION_ORDERS_ENABLED==='true'
}
interface SaleRecord {
  saleKind?:SaleKind; name:string;visible:boolean;purchaseProcess?:PurchaseProcess
  modes:{online:{enabled:boolean;price:number};offline:{enabled:boolean;price:number}}
  textbook:{included:boolean;price:number};subjectSelection?:unknown
  daechionBinding?:StoredLectureBinding|null
}
export function saleKindForWrite(raw:unknown,previous?:SaleRecord):SaleKind|undefined{
  const result=z.enum(['SINGLE','BUNDLE']).optional().safeParse(raw)
  if(!result.success)throw new SalePolicyError('상품 유형을 확인해주세요.')
  const kind=result.data??previous?.saleKind
  if(previous&&(kind==='BUNDLE')!==(previous.saleKind==='BUNDLE'))throw new SalePolicyError('기존 수업과 묶음상품의 유형은 서로 변경할 수 없습니다. 새 상품을 추가해주세요.')
  return kind
}
export function validateBundle(record:SaleRecord,ids:unknown,publishingReady:boolean){
  if(record.saleKind!=='BUNDLE')return
  const targets=z.array(z.number().int().positive().safe()).min(2).max(30).safeParse(ids)
  if(record.purchaseProcess!=='PROCESS_2')throw new SalePolicyError('묶음상품은 프로세스2만 사용할 수 있습니다.')
  if(!record.name?.trim()||record.name.trim().length>200||/[\u0000-\u001f\u007f]/.test(record.name))throw new SalePolicyError('묶음상품명을 입력해주세요.')
  if(!targets.success||new Set(targets.data).size!==targets.data.length)throw new SalePolicyError('대치온 강의를 중복 없이 두 개 이상 선택해주세요.')
  if(!z.number().int().positive().max(2147483647).safeParse(record.modes?.online?.price).success)throw new SalePolicyError('최종 판매가는 1원 이상의 정수로 입력해주세요.')
  if(record.modes?.online?.enabled!==true||record.modes?.offline?.enabled!==false||record.textbook?.included!==false||record.textbook?.price!==0||record.subjectSelection!=null)throw new SalePolicyError('묶음상품은 온라인 최종 판매가만 사용하며 별도 교재비나 과목별 가격을 추가할 수 없습니다.')
  if(typeof record.visible!=='boolean')throw new SalePolicyError('공개 설정을 확인해주세요.')
  if(record.visible&&!publishingReady)throw new SalePolicyError('묶음상품 판매 연결을 준비 중입니다. 비공개로 저장해주세요.')
}
