import { getClassById } from '@/lib/classes'
import { withAutomationClient } from '@/lib/daechion/database'
import { intakeSettings, intakeAvailability, intakePost } from '@/lib/daechion/intake-http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
function ports() {
  const settings = intakeSettings(process.env)
  return { settings, bindings:settings?.bindings ?? [],tenantId:process.env.DAECHION_TENANT_ID, loadProduct:getClassById, withClient:withAutomationClient,
    ready:async()=>withAutomationClient(async client=>{
      await client.query('SELECT id,submission FROM daechion_automation.applications LIMIT 0')
      await client.query('SELECT status,origin FROM daechion_automation.identity_checks LIMIT 0')
      await client.query('SELECT manual_access_action FROM daechion_automation.applications LIMIT 0')
      await client.query('SELECT state FROM daechion_automation.ready_receipts LIMIT 0')
    }),
  }
}
export async function GET(request: Request) { return intakeAvailability(new URL(request.url).searchParams.get('productId') ?? '',ports()) }
export async function POST(request: Request) { return intakePost(request,ports()) }
