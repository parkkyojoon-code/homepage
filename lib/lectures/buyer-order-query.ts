import { z } from 'zod'
import type { QueryClient } from './admin-domain'

export const BUYER_ORDER_PAGE_SIZE=20
const pageNumber=z.coerce.number().int().min(1).max(100000).default(1)
export function buyerOrderPage(params:URLSearchParams){return pageNumber.parse(params.get('page')??undefined)}
export async function buyerOrders(client:QueryClient,userId:string,page:number){
 const current=pageNumber.parse(page)
 const {rows}=await client.query(`WITH owned AS (
   SELECT id,status,total_won,created_at,access_control FROM lecture_orders WHERE user_id=$1
  ), paged AS (SELECT * FROM owned ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3)
  SELECT (SELECT count(*)::int FROM owned) AS total,
  COALESCE((SELECT json_agg(paged ORDER BY created_at DESC,id DESC) FROM paged),'[]'::json) AS orders`,[userId,BUYER_ORDER_PAGE_SIZE,(current-1)*BUYER_ORDER_PAGE_SIZE])
 return {orders:rows[0].orders,total:rows[0].total,page:current,pageSize:BUYER_ORDER_PAGE_SIZE}
}
