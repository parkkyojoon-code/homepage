import { loadClasses } from '@/lib/classes'
import { daechionClient } from '@/lib/daechion/client'
import { withAutomationClient } from '@/lib/daechion/database'
import { checkoutCatalog } from '@/lib/daechion/orders/catalog'
import { orderSettings, type OrderHttpPorts } from '@/lib/daechion/orders/http'
import { lookupOwnership } from '@/lib/daechion/orders/ownership'

export function orderPorts():OrderHttpPorts{
  const settings=orderSettings(process.env),tenantId=process.env.DAECHION_TENANT_ID??''
  return {settings,tenantId,subjectSecret:process.env.DAECHION_ORDERS_SUBJECT_SECRET??'',withClient:withAutomationClient,
    catalog:async()=>checkoutCatalog(loadClasses(),tenantId),
    ownership:(cart,contact,subject)=>lookupOwnership(daechionClient({apiKey:process.env.DAECHION_API_KEY??''}),tenantId,cart,contact,subject),
    ready:()=>withAutomationClient(async client=>{
      await client.query('SELECT id,snapshot,state,expires_at FROM daechion_orders.quotes LIMIT 0')
      await client.query('SELECT id,confirmed_at,contact_snapshot FROM daechion_orders.orders LIMIT 0')
      await client.query('SELECT order_id,lecture_id FROM daechion_orders.grants LIMIT 0')
      await client.query('SELECT a.submission,r.lecture_id FROM daechion_automation.applications a JOIN daechion_automation.registrations r ON r.application_id=a.id LIMIT 0')
    }),
  }
}
