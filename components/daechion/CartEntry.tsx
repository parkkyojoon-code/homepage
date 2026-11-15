'use client'
import {useEffect,useState} from 'react'
import Link from 'next/link'
import styles from './cart-entry.module.css'
export default function CartEntry(){
  const [available,setAvailable]=useState(false)
  useEffect(()=>{const controller=new AbortController()
    fetch('/api/daechion/orders/catalog',{cache:'no-store',signal:controller.signal}).then(r=>r.ok?r.json():null)
      .then(data=>{if(!controller.signal.aborted)setAvailable(data?.available===true)}).catch(()=>{})
    return()=>controller.abort()
  },[])
  if(!available)return null
  return <Link href="/classes/cart" className={styles.entry}>여러 강의 함께 구매하기</Link>
}
