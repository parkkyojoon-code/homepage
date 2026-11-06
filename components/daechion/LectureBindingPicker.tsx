'use client'
import { useState } from 'react'
interface Lecture {id:number;name:string;opened:boolean;weekCount:number}
export default function LectureBindingPicker({ids,saved,onChange}:{ids:number[];saved?:{id:number;name:string}[];onChange:(ids:number[])=>void}){
  const [lectures,setLectures]=useState<Lecture[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
  async function load(){
    setBusy(true);setError('')
    try{
      const response=await fetch('/api/admin/daechion/lectures',{cache:'no-store',signal:AbortSignal.timeout(35000)})
      const data=await response.json();if(!response.ok)throw Error(data.error??'목록을 불러오지 못했습니다.')
      setLectures(data.lectures)
    }catch(e){setError(e instanceof Error?e.message:'목록을 불러오지 못했습니다.')}
    finally{setBusy(false)}
  }
  return <fieldset style={{border:'1px solid rgba(77,139,245,0.35)',borderRadius:10,padding:16,minWidth:0}}>
    <legend style={{color:'#fff',fontSize:13}}>연결할 대치온 강의</legend>
    <p style={{fontSize:12,color:'#b8c6df',margin:'0 0 12px'}}>선택한 고유 ID로 수강 권한을 연결합니다. 이름이 같아도 ID가 다르면 다른 강의입니다.</p>
    <button type="button" onClick={load} disabled={busy} style={{padding:'8px 12px',borderRadius:8,background:'#163668',color:'#fff',border:'1px solid #3668a5',cursor:'pointer'}}>{busy?'불러오는 중…':'대치온 강의 목록 불러오기'}</button>
    {error&&<p role="alert" style={{color:'#ff9999',fontSize:12}}>{error}</p>}
    <ul aria-label="선택한 대치온 강의" style={{color:'#fff',fontSize:13,paddingLeft:20,overflowWrap:'anywhere'}}>
      {ids.map(id=><li key={id}>{lectures?.find(item=>item.id===id)?.name??saved?.find(item=>item.id===id)?.name??'강의 확인 필요'} · ID {id} <button type="button" aria-label={`강의 ID ${id} 연결 해제`} onClick={()=>onChange(ids.filter(value=>value!==id))} style={{color:'#ffaaaa',background:'transparent',border:0,cursor:'pointer'}}>연결 해제</button></li>)}
    </ul>
    {!ids.length&&<p style={{fontSize:12,color:'#ffcf80'}}>연결된 강의가 없습니다. 연결 전에는 프로세스2 구매 신청을 받을 수 없습니다.</p>}
    {lectures&&<div role="group" aria-label="대치온 강의 목록" style={{maxHeight:260,overflowY:'auto',display:'grid',gap:10,marginTop:12}}>
      {lectures.length===0&&<p>조회된 강의가 없습니다.</p>}
      {lectures.map(item=><label key={item.id} style={{display:'flex',gap:8,alignItems:'flex-start',color:'#fff',fontSize:13,overflowWrap:'anywhere'}}>
        <input type="checkbox" checked={ids.includes(item.id)} disabled={!item.opened||item.weekCount===0||busy||(!ids.includes(item.id)&&ids.length>=30)} onChange={event=>onChange(event.target.checked?[...ids,item.id]:ids.filter(id=>id!==item.id))}/>
        <span>{item.name} · ID {item.id} · {item.weekCount}차시{!item.opened?' · 종료':item.weekCount===0?' · 차시 없음':''}</span>
      </label>)}
    </div>}
  </fieldset>
}
