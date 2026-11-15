import { NextResponse } from 'next/server'
import { loadClasses } from '@/lib/classes'
import {catalogFailure} from '@/lib/catalog-http'

export async function GET() {
  try{
  const classes = loadClasses()
  // 공개 API: visible=true인 것만
  return NextResponse.json(classes.filter(c => c.visible).map(({discountPrices: _privateDiscounts,...product})=>product),{headers:{'Cache-Control':'no-store'}})
  }catch(error){return catalogFailure(error)}
}
