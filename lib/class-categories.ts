export const CLASS_CATEGORIES = ['수리논술', '대학별 파이널', '수능수학'] as const

export function isMathEssayCategory(category: string): boolean {
  return category === '수리논술' || category === '대학별 파이널'
}

export function matchesClassCategory(category: string, selected: string): boolean {
  return selected === 'all' || (selected === '수리논술' ? isMathEssayCategory(category) : category === selected)
}
