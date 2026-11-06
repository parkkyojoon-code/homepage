import { payssamCallback } from '@/lib/daechion/payssam-callback'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function POST(request:Request){return payssamCallback(request,process.env)}
