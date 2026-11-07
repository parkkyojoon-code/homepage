import { z } from 'zod'
import type { LedgerClient } from './ledger'
import { automationChanged, automationTransaction } from './automation-store'

const phaseSchema=z.enum(['sessionRefresh','billing','paymentRead','enrollment','readyMessage','sheets','diagnostics'])
const codeSchema=z.enum(['FAILED','UNKNOWN','DEFERRED','API_PREFLIGHT','BROWSER_LAUNCH','BROWSER_CONTEXT','SESSION_REFRESH'])
export type OperationPhase=z.infer<typeof phaseSchema>
export const operationLabels:Record<OperationPhase,string>={sessionRefresh:'관리자 인증 유지',billing:'청구서 발송',paymentRead:'결제 확인',enrollment:'수강 등록·권한',readyMessage:'수강 안내',sheets:'신청 목록 반영',diagnostics:'점검 탭 반영'}
export async function recordOperation(client:LedgerClient,input:{phase:OperationPhase;applicationId?:string;ok:boolean;code?:string}) {
  const phase=phaseSchema.parse(input.phase),code=codeSchema.parse(input.code??'FAILED')
  const id=input.applicationId===undefined?undefined:z.string().uuid().parse(input.applicationId)
  return automationTransaction(client,async()=>{
    // Match the application/outbox lock ordering used by business workers.
    if(id)await client.query('SELECT id FROM daechion_automation.applications WHERE id=$1 FOR UPDATE',[id])
    const previous=(await client.query('SELECT state,code FROM daechion_automation.operation_issues WHERE scope=$1 AND phase=$2 FOR UPDATE',[id??'WORKER',phase])).rows[0]
    if(input.ok){
      if(!previous||previous.state==='RESOLVED')return
      await client.query("UPDATE daechion_automation.operation_issues SET state='RESOLVED',resolved_at=now() WHERE scope=$1 AND phase=$2",[id??'WORKER',phase])
    }else{
      await client.query(`INSERT INTO daechion_automation.operation_issues(scope,phase,application_id,state,code) VALUES($1,$2,$3,'OPEN',$4)
        ON CONFLICT(scope,phase) DO UPDATE SET state='OPEN',code=EXCLUDED.code,occurrences=operation_issues.occurrences+1,
        first_failed_at=CASE WHEN operation_issues.state='RESOLVED' THEN now() ELSE operation_issues.first_failed_at END,last_failed_at=now(),resolved_at=NULL`,[id??'WORKER',phase,id??null,code])
    }
    // One durable projection job on a state/code change, not on every retry.
    if(id&&(!previous||previous.state!==(input.ok?'RESOLVED':'OPEN')||(!input.ok&&previous.code!==code)))
      await automationChanged(client,id,'operation_status_changed','ENROLLMENT_WORKER')
  })
}

export async function operationSummary(client:LedgerClient,id:string):Promise<string[]> {
  const issues=(await client.query('SELECT phase,state FROM daechion_automation.operation_issues WHERE application_id=$1 ORDER BY phase',[id])).rows
  const queue=(await client.query("SELECT DISTINCT kind FROM daechion_automation.outbox WHERE application_id=$1 AND state IN ('UNKNOWN','FAILED')",[id])).rows
  return [...new Set([...issues.map(row=>`${row.state==='OPEN'?'오류 확인 필요':'복구 확인'}: ${operationLabels[phaseSchema.parse(row.phase)]}`),
    ...queue.map(row=>`오류 확인 필요: ${row.kind==='SHEETS'?'신청 목록 반영':'수강 안내'} — 처리 결과 확인 필요`)])]
}

export async function operationRows(client:LedgerClient) {
  const recorded=(await client.query(`SELECT scope,phase,state,code,occurrences::text,first_failed_at,last_failed_at,resolved_at
    FROM daechion_automation.operation_issues ORDER BY (state='OPEN') DESC,last_failed_at DESC,scope,phase`)).rows
  // These outcomes deliberately do not throw. They still require staff attention,
  // especially a write whose result is unknown and must not be blindly retried.
  const queued=(await client.query(`SELECT application_id::text AS scope,CASE WHEN kind='SHEETS' THEN 'sheets' ELSE 'readyMessage' END AS phase,
    'OPEN' AS state,'UNKNOWN' AS code,count(*)::text AS occurrences,min(created_at) AS first_failed_at,max(created_at) AS last_failed_at,NULL AS resolved_at
    FROM daechion_automation.outbox WHERE state IN ('UNKNOWN','FAILED') OR (state='RUNNING' AND lease_until<=now()) GROUP BY application_id,kind`)).rows
  const seen=new Set(queued.map(row=>`${row.scope}/${row.phase}`))
  return [...queued,...recorded.filter(row=>!seen.has(`${row.scope}/${row.phase}`))].sort((a,b)=>Number(b.state==='OPEN')-Number(a.state==='OPEN'))
}
