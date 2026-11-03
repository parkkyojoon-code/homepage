import { NextResponse } from 'next/server'
import { currentUser } from '@/lib/lectures/auth'
import { database } from '@/lib/lectures/db'
import { createOrder } from '@/lib/lectures/orders'
import { orderInput } from '@/lib/lectures/input'
import { buyerOrderPage,buyerOrders } from '@/lib/lectures/buyer-order-query'
import { failure, sameOrigin } from '@/lib/lectures/http'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  try {
    sameOrigin(request)
    const user = await currentUser()
    const input = orderInput.parse(await request.json())
    const order=await createOrder(user.id,input,user.credentialVersion)
    return NextResponse.json({id:order.id,status:order.status,total_won:order.total_won}, { status: 201 })
  } catch (error) { return failure(error) }
}
export async function GET(request:Request) {
  try {
    const user = await currentUser()
    return NextResponse.json(await buyerOrders(database(),user.id,buyerOrderPage(new URL(request.url).searchParams)),{headers:{'Cache-Control':'private, no-store'}})
  } catch (error) { return failure(error) }
}
