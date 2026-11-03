import { currentAdmin } from '@/lib/lectures/admin-auth'
import { failure, HttpError, sameOrigin } from '@/lib/lectures/http'
export const runtime = 'nodejs'
// Removed prototype contract: callers must use the versioned access command and session actor.
export async function POST(request: Request) {
  try {
    sameOrigin(request)
    await currentAdmin()
    throw new HttpError(410, '화면을 새로고침하고 새 권한 처리 기능을 사용해주세요.')
  } catch (e) { const r=failure(e); r.headers.set('Cache-Control','private, no-store'); return r }
}
