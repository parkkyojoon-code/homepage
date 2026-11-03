import { youtubeUrl } from './catalog-input'

export type AccessEvidence = {
  user_id: string; lecture_id: string; order_user_id: string; item_lecture_id: string
  revoked_at: string | Date | null; order_status: string; access_control?: string
}
export function hasLectureAccess(userId: string, lectureId: string, proofs: AccessEvidence[]) {
  return proofs.some(p => p.user_id === userId && p.lecture_id === lectureId && p.order_user_id === userId && p.item_lecture_id === lectureId && p.revoked_at === null && p.order_status === 'PAID' && p.access_control !== 'MANUAL_CLOSED')
}
export function playableVideo(url: string | null) { return url ? youtubeUrl(url) ?? null : null }
