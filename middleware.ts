import { NextRequest, NextResponse } from 'next/server'

// Retire only the abandoned standalone lecture service. Keep legacy /classes,
// /apply, /my and /admin routes independent of its database and credentials.
// Apply to every HTTP method so direct API calls cannot create new records.
export function middleware(request: NextRequest) {
  const headers = {
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
  }
  if (request.nextUrl.pathname.startsWith('/api/lectures')) {
    return NextResponse.json(
      { error: '이 기능은 종료되었습니다.', code: 'LECTURE_SERVICE_RETIRED' },
      { status: 410, headers },
    )
  }
  return new NextResponse(`<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>페이지 안내 | 박교준입시연구소</title></head>
<body style="margin:0;background:#0a0a0a;color:#fff;font-family:system-ui,sans-serif">
<main style="max-width:560px;margin:15vh auto;padding:24px;line-height:1.7">
<h1 style="font-size:24px">이 페이지는 더 이상 제공하지 않습니다.</h1>
<p>수업 신청은 기존 수업 신청 페이지에서 진행해 주세요.</p>
<a href="/classes" style="color:#00c6ff">수업 신청</a> · <a href="/" style="color:#00c6ff">홈으로</a>
</main></body></html>`, {
    status: 410,
    headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export const config = {
  matcher: ['/lectures/:path*', '/admin/lectures/:path*', '/api/lectures/:path*'],
}
