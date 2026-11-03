import { z } from 'zod'

export function youtubeUrl(value: string) {
  if (!value) return null
  let url: URL
  try { url = new URL(value) } catch { return undefined }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return undefined
  const host = url.hostname.toLowerCase()
  let id: string | null = null
  if (host === 'youtu.be') id = url.pathname.slice(1)
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else id = url.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})$/)?.[1] ?? null
  }
  return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube.com/watch?v=${id}` : undefined
}
export const lectureEditor = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10000),
  price_won: z.number().int().positive().max(2147483647),
  sale_status: z.enum(['DRAFT', 'ON_SALE', 'CLOSED']),
  video_url: z.string().trim().max(2048).transform(youtubeUrl).refine(v => v !== undefined, '올바른 HTTPS YouTube 주소를 입력해주세요.'),
}).strict()
