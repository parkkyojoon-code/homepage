'use client'
import { useEffect,useRef,useState } from 'react'
import Link from 'next/link'
type Lecture={id:string;title:string;description:string;price_won:number;sale_status:'DRAFT'|'ON_SALE'|'CLOSED';video_url:string|null;version:number}
type Change={actor_name:string;action:string;version:number;before_state:Lecture|null;after_state:Lecture;created_at:string}
const empty={title:'',description:'',price:'',sale_status:'DRAFT' as Lecture['sale_status'],video_url:''}
const labels={DRAFT:'작성 중',ON_SALE:'판매 중',CLOSED:'판매 종료'}
const fields:[keyof Lecture,string][]=[['title','강의명'],['description','설명'],['price_won','가격'],['sale_status','판매 상태'],['video_url','영상 주소']]
function display(key:keyof Lecture,value:unknown){if(value===null||value===undefined||value==='')return '미입력';if(key==='price_won')return `${Number(value).toLocaleString()}원`;if(key==='sale_status')return labels[value as Lecture['sale_status']]??String(value);return String(value)}
function formOf(item:Lecture){return {title:item.title,description:item.description,price:String(item.price_won),sale_status:item.sale_status,video_url:item.video_url??''}}
export default function LectureAdmin(){
 const [items,setItems]=useState<Lecture[]>([]),[form,setForm]=useState(empty),[editing,setEditing]=useState<{id:string;version:number}|null>(null)
 const [busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[message,setMessage]=useState('불러오는 중입니다.'),[latest,setLatest]=useState<Lecture|null>(null)
 const [history,setHistory]=useState<{id:string;changes:Change[]}|null>(null)
 const inFlight=useRef(false),historySequence=useRef(0)
 async function fetchCatalog(signal?:AbortSignal):Promise<Lecture[]>{
  const r=await fetch('/api/lectures/admin/catalog',{signal,cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error)
  setItems(d);setLoaded(true);return d
 }
 useEffect(()=>{const controller=new AbortController();void fetchCatalog(controller.signal).then(()=>setMessage('')).catch(e=>{if(!controller.signal.aborted)setMessage(e.message)});return()=>controller.abort()},[])
 async function reload(){try{await fetchCatalog();setMessage('목록을 새로 확인했습니다. 작성 중인 입력 내용은 유지됩니다.')}catch(e){setMessage(e instanceof Error?e.message:'목록을 불러오지 못했습니다.')}}
 async function submit(e:React.FormEvent){
  e.preventDefault();if(inFlight.current)return
  inFlight.current=true;setBusy(true);setMessage('저장 중입니다.')
  try{
   const r=await fetch(`/api/lectures/admin/catalog${editing?`/${editing.id}`:''}`,{method:editing?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:form.title,description:form.description,price_won:Number(form.price),sale_status:form.sale_status,video_url:form.video_url,...(editing?{expectedVersion:editing.version}:{})})}),d=await r.json()
   if(!r.ok){if(d.code==='LECTURE_VERSION_CONFLICT'&&editing){try{const current=await fetchCatalog();setLatest(current.find(i=>i.id===editing.id)??null)}catch{} }throw new Error(d.error)}
   setItems(old=>editing?old.map(i=>i.id===editing.id?d:i):[d,...old]);setEditing(null);setForm(empty);setLatest(null);setHistory(null);setMessage('강의와 변경 이력을 저장했습니다.')
  }catch(e){setMessage(e instanceof Error?e.message:'저장 결과를 확인하지 못했습니다. 목록을 새로고침해 확인해주세요.')}finally{inFlight.current=false;setBusy(false)}
 }
 async function changes(id:string){const seq=++historySequence.current;setHistory(null);try{const r=await fetch(`/api/lectures/admin/catalog/${id}/history`,{cache:'no-store'}),d=await r.json();if(!r.ok)throw new Error(d.error);if(seq===historySequence.current)setHistory({id,changes:d.changes})}catch(e){if(seq===historySequence.current)setMessage(e instanceof Error?e.message:'이력을 확인하지 못했습니다.')}}
 const style={display:'block',width:'100%',padding:10,background:'#fff',color:'#111',borderRadius:6}
 return <main style={{maxWidth:960,margin:'auto',padding:'40px 24px',color:'#f8fafc'}}>
  <nav><Link href="/admin/lectures/login">관리자 로그인</Link> · <Link href="/admin/lectures/orders">주문 · 권한 관리</Link> · <Link href="/lectures">판매 목록</Link></nav>
  <h1>온라인 강의 관리</h1><p>판매를 종료해도 기존 구매 이력과 권한은 유지됩니다. 영상 주소를 바꾸면 기존 구매자도 변경된 영상을 이용합니다.</p><p role="status">{message}</p><button disabled={busy} onClick={()=>void reload()}>목록 새로고침</button>
  {latest&&editing&&<section style={{padding:20,border:'1px solid #fbbf24'}}><h2>다른 관리자가 저장한 최신 내용</h2><p>아래 입력란에는 작성한 내용이 남아 있습니다. 최신 내용을 확인한 뒤 다시 수정해주세요.</p><dl>{fields.map(([key,label])=><div key={key}><dt>{label}</dt><dd style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{display(key,latest[key])}</dd></div>)}</dl><button disabled={busy} onClick={()=>{if(window.confirm('작성 중인 내용을 최신 저장 내용으로 바꿀까요?')){setForm(formOf(latest));setEditing({id:latest.id,version:latest.version});setLatest(null);setMessage('최신 내용을 불러왔습니다. 필요한 부분을 수정하고 저장해주세요.')}}}>최신 내용으로 불러오기</button></section>}
  {loaded&&<form onSubmit={submit} style={{display:'grid',gap:16,padding:24,background:'#182538',borderRadius:12}}><h2>{editing?'강의 수정':'강의 등록'}</h2><fieldset disabled={busy} style={{display:'grid',gap:16}}>
   <label>강의명<input style={style} required maxLength={200} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>설명<textarea style={style} maxLength={10000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label>가격 (원)<input style={style} type="number" required min={1} max={2147483647} step={1} value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label><label>판매 상태<select style={style} value={form.sale_status} onChange={e=>setForm({...form,sale_status:e.target.value as Lecture['sale_status']})}>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>YouTube 주소 (나중에 입력 가능)<input style={style} type="url" value={form.video_url} onChange={e=>setForm({...form,video_url:e.target.value})}/></label><button>{busy?'저장 중…':'저장'}</button>{editing&&<button type="button" onClick={()=>{setEditing(null);setForm(empty);setLatest(null)}}>수정 취소</button>}
  </fieldset></form>}
  {loaded&&<section><h2>등록 강의 {items.length}개</h2>{items.map(item=><article key={item.id} style={{padding:'20px 0',borderBottom:'1px solid #475569'}}><h3>{item.title}</h3><p>{item.price_won.toLocaleString()}원 · {labels[item.sale_status]} · {item.video_url?'영상 등록됨':'영상 미등록'}</p><button disabled={busy} onClick={()=>{setEditing({id:item.id,version:item.version});setForm(formOf(item));setLatest(null);setMessage('선택한 강의를 수정하고 있습니다.')}}>수정</button><button disabled={busy} onClick={()=>void changes(item.id)}>변경 이력</button>
   {history?.id===item.id&&<section aria-label="강의 변경 이력"><h4>최근 변경 이력 (최대 50건)</h4>{history.changes.length?history.changes.map(h=><details key={h.version}><summary>{new Date(h.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} · {h.actor_name} · {h.action==='CREATE'?'등록':'수정'}</summary><dl>{fields.filter(([key])=>h.before_state?.[key]!==h.after_state[key]).map(([key,label])=><div key={key}><dt>{label}</dt><dd style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{display(key,h.before_state?.[key])} → {display(key,h.after_state[key])}</dd></div>)}</dl></details>):<p>기록된 변경 이력이 없습니다. 이력 수집 이전 변경은 포함되지 않습니다.</p>}</section>}
  </article>)}{!items.length&&<p>첫 강의를 등록해주세요.</p>}</section>}
 </main>
}
