import { createHash,randomBytes,randomUUID } from 'node:crypto'
import { orderInput } from './input'
import type { z } from 'zod'
import { transaction } from './db'
import { HttpError } from './http'
import type { PoolClient } from 'pg'

export async function createOrder(userId: string, input: z.infer<typeof orderInput>, expectedCredentialVersion: number) {
  const d=orderInput.parse(input)
  return transaction(client => createOrderWithinTransaction(client,userId,d.items.map(i=>i.lectureId),d.requestKey,d.expectedTotalWon,expectedCredentialVersion,d))
}
// Caller must hold a transaction; shared by production and integration checks.
export async function createOrderWithinTransaction(client: Pick<PoolClient,'query'>, userId: string, lectureIds: string[], requestKey: string, expectedTotalWon: number, expectedCredentialVersion?: number, draft?: z.infer<typeof orderInput>) {
    const details=draft?orderInput.parse(draft):undefined
    if(details&&(details.requestKey!==requestKey||details.expectedTotalWon!==expectedTotalWon||details.items.map(i=>i.lectureId).sort().join(',')!==[...lectureIds].sort().join(',')))throw new HttpError(400,'주문 명세를 확인해주세요.')
    const fingerprint=details?createHash('sha256').update(JSON.stringify({items:[...details.items].sort((a,b)=>a.lectureId.localeCompare(b.lectureId)),total:details.expectedTotalWon,recipient:details.billingRecipient})).digest('hex'):null
    // Serialize each buyer's checkout, including requests with different idempotency keys.
    const buyer = await client.query('SELECT id,name,phone,disabled_at,must_change_password,credential_version FROM lecture_users WHERE id=$1 FOR UPDATE', [userId])
    if (!buyer.rows[0] || buyer.rows[0].disabled_at) throw new HttpError(401, '로그인이 필요합니다.')
    if (expectedCredentialVersion !== undefined && buyer.rows[0].credential_version !== expectedCredentialVersion) throw new HttpError(401, '계정이 변경되었습니다. 다시 로그인해주세요.')
    if (buyer.rows[0].must_change_password) throw new HttpError(403, '비밀번호를 먼저 변경해주세요.', 'PASSWORD_CHANGE_REQUIRED')
    const prior = await client.query('SELECT * FROM lecture_orders WHERE user_id=$1 AND request_key=$2', [userId, requestKey])
    if (prior.rows[0]) {
      if(details&&prior.rows[0].request_hash!==fingerprint)throw new HttpError(409,'같은 요청 키에 다른 가격 또는 청구 수신자가 지정됐습니다.')
      const items = await client.query('SELECT lecture_id FROM lecture_order_items WHERE order_id=$1', [prior.rows[0].id])
      const previous = items.rows.map(r => r.lecture_id).sort().join(',')
      if (previous !== [...lectureIds].sort().join(',')) throw new HttpError(409, '동일 요청 키에 다른 강의가 지정됐습니다.')
      return prior.rows[0]
    }
    if(details?.billingRecipient.type==='SELF'&&(details.billingRecipient.name!==buyer.rows[0].name||details.billingRecipient.phone!==buyer.rows[0].phone))throw new HttpError(409,'본인 청구 정보가 변경되었습니다. 새로고침해주세요.')
    const owned = await client.query('SELECT 1 FROM lecture_entitlements WHERE user_id=$1 AND lecture_id=ANY($2::uuid[]) AND revoked_at IS NULL LIMIT 1', [userId, lectureIds])
    if (owned.rowCount) throw new HttpError(409, '이미 구매한 강의가 포함되어 있습니다.')
    const pending = await client.query(`SELECT 1 FROM lecture_orders o JOIN lecture_order_items i ON i.order_id=o.id WHERE o.user_id=$1 AND o.status IN ('CREATED','AWAITING_PAYMENT') AND i.lecture_id=ANY($2::uuid[]) LIMIT 1`, [userId, lectureIds])
    if (pending.rowCount) throw new HttpError(409, '해당 강의의 진행 중인 주문이 있습니다. 주문 내역을 확인해주세요.')
    const { rows: lectures } = await client.query('SELECT id,title,price_won FROM lectures WHERE id=ANY($1::uuid[]) AND sale_status=\'ON_SALE\' ORDER BY id FOR SHARE', [lectureIds])
    if (lectures.length !== lectureIds.length) throw new HttpError(409, '판매 중인 강의를 다시 확인해주세요.')
    if(details&&lectures.some(l=>details.items.find(i=>i.lectureId===l.id)?.expectedPriceWon!==l.price_won))throw new HttpError(409,'개별 강의 가격이 변경되었습니다. 주문 내용을 다시 확인해주세요.')
    const total = lectures.reduce((sum, lecture) => sum + lecture.price_won, 0)
    if (!Number.isSafeInteger(total) || total <= 0 || total > 2147483647) throw new HttpError(400, '유료 주문 금액을 확인해주세요.')
    if (total !== expectedTotalWon) throw new HttpError(409, '가격이 변경되었습니다. 주문 확인 화면을 새로고침해 금액을 다시 확인해주세요.')
    const id = randomUUID()
    const { rows } = await client.query('INSERT INTO lecture_orders(id,user_id,request_key,total_won) VALUES($1,$2,$3,$4) RETURNING *', [id, userId, requestKey, total])
    for (const lecture of lectures) await client.query('INSERT INTO lecture_order_items(id,order_id,lecture_id,title_snapshot,price_won) VALUES($1,$2,$3,$4,$5)', [randomUUID(), id, lecture.id, lecture.title, lecture.price_won])
    if(details){
      await client.query('UPDATE lecture_orders SET request_hash=$2,recipient_type=$3,recipient_name=$4,recipient_phone=$5 WHERE id=$1',[id,fingerprint,details.billingRecipient.type,details.billingRecipient.name,details.billingRecipient.phone])
      await client.query('INSERT INTO lecture_billing_requests(order_id,bill_id,amount_won) VALUES($1,$2,$3)',[id,'L'+randomBytes(10).toString('hex').slice(0,19),total])
    }
    // CREATED means saved only. No bill or payment success is inferred here.
    return rows[0]
}
