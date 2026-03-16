import { NextRequest, NextResponse } from 'next/server'

const HOMEWORK_API = process.env.HOMEWORK_API_URL || 'https://pkjhomework.up.railway.app'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const res = await fetch(`${HOMEWORK_API}/api/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
