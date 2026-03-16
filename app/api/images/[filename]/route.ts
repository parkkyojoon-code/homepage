import { NextRequest, NextResponse } from 'next/server'
import { getImagePath, imageExists } from '@/lib/classes'
import fs from 'fs'

export async function GET(_: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params

  // 경로 순회 공격 방지
  if (filename.includes('..') || filename.includes('/')) {
    return new NextResponse('Invalid filename', { status: 400 })
  }

  if (!imageExists(filename)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const buffer = fs.readFileSync(getImagePath(filename))
  const ext = filename.split('.').pop()?.toLowerCase()
  const contentType =
    ext === 'png'  ? 'image/png'  :
    ext === 'webp' ? 'image/webp' :
    ext === 'gif'  ? 'image/gif'  : 'image/jpeg'

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
