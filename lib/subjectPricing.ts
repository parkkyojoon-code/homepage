// 과목(수1/수2/미적 등) 개수 선택형 가격 로직
// - 서버(app/api/apply 등)와 클라이언트(app/apply/[id]/page.tsx) 양쪽에서 import 하므로
//   fs 등 Node 전용 모듈은 절대 사용하지 않는다. (lib/classes.ts와 분리한 이유)

export interface SubjectPricingTier {
  count: number   // 선택 과목 개수
  price: number   // 해당 개수 선택 시 가격 (원)
}

export interface SubjectSelection {
  subjects: string[]            // 선택 가능한 과목 목록 (예: ['수1', '수2', '미적'])
  tiers: SubjectPricingTier[]   // 개수별 가격표 (예: 1과목 28만 / 2과목 50만 / 3과목 70만)
}

/**
 * 선택한 과목 개수에 맞는 가격을 반환.
 *
 * - tiers에 정확히 일치하는 개수가 있으면 그 가격을 그대로 사용 (기본 동작).
 * - 관리자가 새 과목을 추가했는데 아직 해당 개수의 가격표를 안 만들어 둔 경우를 대비해,
 *   정의된 가격표 중 가장 높은 두 구간의 증분(마지막 구간 - 그 이전 구간)을 단위 증가액으로 삼아
 *   추정치를 계산한다. 다만 이 값은 "관리자가 아직 정확한 가격을 안 넣었을 때의 임시값"이므로,
 *   실제 운영 시에는 관리자 페이지에서 해당 개수의 가격을 직접 등록하는 것을 권장한다.
 */
export function calcSubjectSelectionPrice(
  selection: SubjectSelection | null | undefined,
  selectedCount: number
): number {
  if (!selection || selectedCount <= 0) return 0

  const tiers = [...selection.tiers].sort((a, b) => a.count - b.count)
  if (tiers.length === 0) return 0

  const exact = tiers.find(t => t.count === selectedCount)
  if (exact) return exact.price

  const last = tiers[tiers.length - 1]

  if (selectedCount > last.count) {
    // 정의된 가격표보다 많은 과목을 선택한 경우 → 마지막 두 구간의 증분으로 추정
    const prev = tiers.length >= 2 ? tiers[tiers.length - 2] : null
    const perUnit = prev ? (last.price - prev.price) / (last.count - prev.count) : last.price / last.count
    return Math.round(last.price + perUnit * (selectedCount - last.count))
  }

  // 정의된 가격표보다 적게 선택했는데 그 개수의 가격이 없는 경우 → 바로 아래 구간 가격 사용
  const lower = [...tiers].reverse().find(t => t.count <= selectedCount)
  return lower ? lower.price : tiers[0].price
}

export function subjectSelectionLabel(selection: SubjectSelection, selectedSubjects: string[]): string {
  // 관리자가 등록한 과목 순서(subjects) 기준으로 정렬해서 표시 — 학생이 클릭한 순서가 아니라
  // 항상 "수1·수2·미적" 같은 일관된 순서로 나오게 함.
  // 구분자로 가운뎃점(·)을 쓰는 이유: 청구서 발송 스크립트(apply_checker.py)가 이 값이 담기는
  // 시트 열(G/J)을 콤마(,) 기준으로 "여러 개의 별개 신청 건"인지 판단하기 때문에, 과목을
  // 콤마로 나열하면 하나의 신청이 여러 건으로 잘못 쪼개져 청구서가 중복 발송된다.
  // 가운뎃점은 그 로직과 절대 충돌하지 않으면서도 자연스러운 한국어 나열 표기라 안전하다.
  return selection.subjects.filter(s => selectedSubjects.includes(s)).join('·')
}
