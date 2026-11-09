'use client'

import {bundleSource,type BundleProduct} from '@/lib/daechion/orders/bundle-components'

export default function BundleProductPicker({products,ids,onChange,onRefresh,loading}:{
  products:readonly BundleProduct[];ids:string[];onChange(ids:string[]):void;onRefresh():void;loading:boolean
}){
  const choices=products.filter(product=>bundleSource(product)!==null)
  const missing=ids.filter(id=>!choices.some(product=>product.id===id))
  const selected=choices.filter(product=>ids.includes(product.id))
  const targets=selected.map(product=>bundleSource(product)!)
  const duplicate=new Set(targets.map(target=>`${target.tenantId}:${target.lectureId}`)).size!==targets.length
  return <div role="group" aria-label="묶음에 포함할 홈페이지 상품" style={{display:'grid',gap:10}}>
    <strong style={{color:'#fff',fontSize:13}}>묶음에 포함할 홈페이지 상품</strong>
    <p style={{color:'#b8c6df',fontSize:12}}>프로세스2 개별상품을 두 개 이상 선택해주세요. 비공개 상품도 포함할 수 있습니다.</p>
    <button type="button" onClick={onRefresh} disabled={loading} style={{justifySelf:'start',padding:'8px 12px',borderRadius:8,border:'1px solid #4d8bf5',color:'#b8d2ff',background:'transparent'}}>{loading?'불러오는 중…':'상품 목록 새로고침'}</button>
    {!choices.length&&<p style={{color:'#b8c6df',fontSize:12}}>선택 가능한 개별상품이 없습니다. 수업 추가에서 프로세스2 개별상품의 대치온 강의를 먼저 연결해주세요. 별도 유료 교재나 과목별 가격이 있는 상품은 제외됩니다.</p>}
    {choices.map(product=>{
      const target=bundleSource(product)!
      return <label key={product.id} style={{display:'flex',alignItems:'flex-start',gap:10,padding:12,border:'1px solid rgba(255,255,255,.15)',borderRadius:8,color:'#fff',fontSize:13}}>
        <input type="checkbox" checked={ids.includes(product.id)} onChange={event=>onChange(event.target.checked?[...ids,product.id]:ids.filter(id=>id!==product.id))}/>
        <span>{product.name} · 상품 ID {product.id} · {product.visible?'공개':'비공개'}<br/><span style={{fontSize:12,color:'#b8c6df'}}>개별 판매가 {product.modes.online.price.toLocaleString('ko-KR')}원 · {product.daechionBinding!.lectures[0].name} · 대치온 ID {target.lectureId}</span></span>
      </label>
    })}
    {missing.map(id=><div key={id} role="alert" style={{color:'#ffb0b0',fontSize:13}}>선택한 상품 {id}는 삭제되었거나 연결을 사용할 수 없습니다. <button type="button" onClick={()=>onChange(ids.filter(item=>item!==id))}>선택 해제</button></div>)}
    {duplicate&&<p role="alert" style={{color:'#ffb0b0',fontSize:13}}>선택한 상품들이 같은 대치온 강의에 연결되어 있습니다. 중복 상품을 제외해주세요.</p>}
    <p style={{color:'#b8c6df',fontSize:12}}>선택한 상품 {ids.length}개 · 개별 판매가 합계 {selected.reduce((sum,product)=>sum+product.modes.online.price,0).toLocaleString('ko-KR')}원</p>
  </div>
}
