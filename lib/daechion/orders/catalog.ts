import type { IntakeProduct } from '../intake'
import {bundleCompositionIssue,type BundleComponent} from './bundle-components'

export interface OrderCatalogClass extends IntakeProduct {
  saleKind?:'SINGLE'|'BUNDLE'
  updatedAt:string
  bundleComponents?:BundleComponent[]
}
// Existing multi-target products are not silently converted into bundles.
// The admin editor will explicitly persist saleKind in the next UI stage.
export function checkoutCatalog(classes:readonly OrderCatalogClass[],tenantId:string):unknown[]{
  return classes.filter(p=>p.purchaseProcess==='PROCESS_2'&&p.visible&&p.daechionBinding?.tenantId===tenantId&&
    p.modes.online.enabled&&p.subjectSelection==null&&
    (p.saleKind==='BUNDLE'||(p.saleKind===undefined||p.saleKind==='SINGLE')&&p.daechionBinding.lectures.length===1))
    .filter(p=>p.saleKind!=='BUNDLE'||!p.textbook.included||p.textbook.price===0)
    .filter(p=>bundleCompositionIssue(p,classes)===null)
    .map(p=>({productId:p.id,title:p.name,saleKind:p.saleKind??'SINGLE',purchaseProcess:'PROCESS_2',visible:true,
      priceWon:p.modes.online.price+(p.saleKind!=='BUNDLE'&&p.textbook.included?p.textbook.price:0),
      tenantId,revision:p.updatedAt,lectures:p.daechionBinding!.lectures}))
}
