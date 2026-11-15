import { NextRequest, NextResponse } from 'next/server'
import { getClassById } from '@/lib/classes'
import {catalogFailure} from '@/lib/catalog-http'
import { purchaseProcessOf, usesOrderCheckout } from '@/lib/purchase-process'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try{
  const { id } = await params
  const cls = getClassById(id)
  if (!cls || !cls.visible) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const {discountPrices: _privateDiscounts,...product}=cls
  return NextResponse.json({ ...product, purchaseProcess: purchaseProcessOf(cls),orderCheckout:usesOrderCheckout(cls,process.env.DAECHION_ORDERS_ENABLED==='true') },{headers:{'Cache-Control':'no-store'}})
  }catch(error){return catalogFailure(error)}
}
