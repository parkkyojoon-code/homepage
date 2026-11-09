import CartCheckout from '@/components/daechion/CartCheckout'
export default async function Page({searchParams}:{searchParams:Promise<{productId?:string|string[]}>}){
  const params=await searchParams,productId=typeof params.productId==='string'?params.productId:undefined
  return <CartCheckout key={productId??''} initialProductId={productId}/>
}
