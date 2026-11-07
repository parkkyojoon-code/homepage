'use client'
import {useEffect,useState} from 'react'
import Link from 'next/link'
export default function CartEntry(){
  const [available,setAvailable]=useState(false)
  useEffect(()=>{const controller=new AbortController()
    fetch('/api/daechion/orders/catalog',{cache:'no-store',signal:controller.signal}).then(r=>r.ok?r.json():null)
      .then(data=>{if(!controller.signal.aborted)setAvailable(data?.available===true)}).catch(()=>{})
    return()=>controller.abort()
  },[])
  if(!available)return null
  return <div style={{maxWidth:1200,margin:'0 auto',padding:'16px 20px'}}><Link href="/classes/cart" style={{display:'inline-block',padding:'12px 20px',background:'#0066ff',borderRadius:10,color:'#fff',fontWeight:700}}>여러 강의 함께 구매하기</Link></div>
}
