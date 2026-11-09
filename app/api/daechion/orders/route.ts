import { orderPost } from '@/lib/daechion/orders/http'
import { orderPorts } from './ports'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function POST(request:Request){return orderPost('orders',request,orderPorts())}
