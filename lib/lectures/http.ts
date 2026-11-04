import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { acceptsLectureOrigin } from './origin-policy'

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message) }
}
export function failure(error: unknown) {
  if (error instanceof HttpError) return NextResponse.json({ error: error.message, ...(error.code ? {code:error.code} : {}) }, { status: error.status })
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? '입력을 확인해주세요.' }, { status: 400 })
  if (error instanceof SyntaxError) return NextResponse.json({ error: '올바른 JSON이 필요합니다.' }, { status: 400 })
  console.error('Lecture service request failed:', error instanceof Error ? error.name : 'unknown')
  return NextResponse.json({ error: '서비스 연결을 확인해주세요.' }, { status: 503 })
}
export function sameOrigin(request: Request) {
  // Next's internal request URL can use localhost even when the browser used 127.0.0.1.
  // Host is browser-controlled for browser requests; do not trust arbitrary forwarded headers.
  if (!acceptsLectureOrigin(request, {
    primary: process.env.LECTURES_APP_ORIGIN,
    additional: process.env.LECTURES_ADDITIONAL_ORIGINS,
  })) throw new HttpError(403, '허용되지 않은 요청입니다.')
}
