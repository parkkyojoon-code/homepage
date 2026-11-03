import { timingSafeEqual } from 'node:crypto'
import { tokenHash } from './security'
import { HttpError } from './http'
export function workerConfigured(){return process.env.LECTURES_WORKER_ENABLED==='true'&&Boolean(process.env.LECTURES_WORKER_TOKEN&&process.env.LECTURES_WORKER_TOKEN.length>=32)}
export function requireWorker(request:Request){
 const secret=process.env.LECTURES_WORKER_TOKEN
 if(!workerConfigured()||!secret)throw new HttpError(503,'결제 작업자 연결이 비활성 상태입니다.')
 const header=request.headers.get('authorization')||''
 if(!header.startsWith('Bearer ')||!timingSafeEqual(Buffer.from(tokenHash(header.slice(7))),Buffer.from(tokenHash(secret))))throw new HttpError(401,'작업자 인증이 필요합니다.')
}
