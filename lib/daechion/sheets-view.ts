import { applicationSnapshotSchema, type ApplicationSnapshot } from './ledger'

export const SHEET_HEADERS = Object.freeze([
  '신청번호','신청시각','신청자 유형','학생 이름','학부모 이름','학생 전화번호','보호자 로그인 전화번호','결제 전화번호',
  '신청 강의','상품 ID','선택 과목','수업 방식','캠퍼스','수업료','교재비','총 청구 금액',
  '원비 확인','개인정보 동의','안내문 버전','추가 신청 정보','청구 상태','현재 청구서 번호','전체 청구서 번호',
  '청구 발송시각','납부기한','결제 상태','결제 완료시각','대치온 학생 ID','대치온 강의 ID',
  '등록 상태','안내 발송 상태','확인 필요 사유','마지막 갱신시각',
])

export interface ApplicationView {
  id: string; createdAt: string; updatedAt: string; snapshot: ApplicationSnapshot;
  billingState: string; currentBillId?: string; allBillIds: string[]; sentAt?: string; dueAt?: string;
  paymentState: string; paidAt?: string; studentId?: number; lectureIds: number[];
  registrationState: string; notificationState: string; reviewReason?: string;
}
function koreanTime(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid Sheets timestamp')
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(date)
}
const labels: Record<string, Record<string, string>> = {
  billing: { NOT_CREATED:'미발송',RESERVED:'청구 준비',SEND_UNKNOWN:'발송 결과 확인 필요',SENT:'발송 완료',CANCELLED:'취소',DESTROYED:'파기' },
  payment: { PENDING:'미납',PAID:'결제 완료',CANCELLED:'취소',UNKNOWN:'확인 필요' },
  registration: { PENDING:'등록 대기',RUNNING:'등록 중',DONE:'등록 완료',REVIEW:'관리자 확인',STOPPED:'보류' },
  notification: { NOT_READY:'등록 완료 후 발송',PENDING:'발송 대기',SENT:'발송 완료',UNKNOWN:'발송 결과 확인 필요',FAILED:'발송 실패' },
}
function stateLabel(kind: string, state: string): string {
  const label = labels[kind]?.[state]
  if (!label) throw new Error('Unknown Sheets state')
  return label
}
export function applicationSheetRow(view: ApplicationView): (string | number)[] {
  const s = applicationSnapshotSchema.parse(view.snapshot)
  if (view.currentBillId && !view.allBillIds.includes(view.currentBillId)) throw new Error('Missing current bill history')
  const allIds = [...new Set(view.allBillIds)]
  if (allIds.some(id => !/^\d{1,64}$/.test(id))) throw new Error('Invalid Sheets bill ID')
  return [view.id,koreanTime(view.createdAt),s.applicantType === 'STUDENT' ? '학생 본인' : '학부모',s.studentName,s.guardianName,
    s.studentPhone,s.guardianPhone,s.payerPhone,s.productTitle,s.productId,s.selectedSubjects.join('·'),
    s.mode === 'ONLINE' ? '온라인' : '현장',s.campus,s.tuitionWon,s.textbookWon,s.totalWon,'확인','동의',s.noticeVersion,
    s.additionalInputs.map(field => `${field.label}: ${field.value}`).join('\n'),stateLabel('billing',view.billingState),view.currentBillId ?? '',allIds.join('\n'),
    koreanTime(view.sentAt),koreanTime(view.dueAt),stateLabel('payment',view.paymentState),koreanTime(view.paidAt),
    view.studentId === undefined ? '' : String(view.studentId),view.lectureIds.join('\n'),stateLabel('registration',view.registrationState),
    stateLabel('notification',view.notificationState),view.reviewReason ?? '',koreanTime(view.updatedAt)]
}

export function sheetsDestination(spreadsheetId: string, legacySpreadsheetId: string) {
  const valid = (id: string) => /^[A-Za-z0-9_-]{20,}$/.test(id)
  if (!valid(spreadsheetId) || !valid(legacySpreadsheetId) || spreadsheetId === legacySpreadsheetId) {
    throw new Error('A separate new spreadsheet and explicit legacy spreadsheet ID are required')
  }
  return { spreadsheetId, valueInputOption: 'RAW' as const }
}

// Future publisher contract: find rows by application ID on every synchronization;
// do not trust stored row numbers after staff sorting. Write only SHEET_HEADERS
// columns with RAW values, preserving any staff memo columns after this range.
// This module makes no Google API calls and never creates/edits a spreadsheet.
