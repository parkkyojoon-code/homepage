import fs from 'fs'
import path from 'path'

const DATA_DIR   = process.env.DATA_DIR || '/app/data'
const CLASSES_FILE = path.join(DATA_DIR, 'classes.json')
const IMAGES_DIR   = path.join(DATA_DIR, 'class-images')

export const CAMPUSES = ['서울 대치', '인천 송도', '부산 센텀', '일산 후곡', '대구 수성'] as const
export type Campus = typeof CAMPUSES[number]

export interface ClassMode {
  enabled: boolean
  price: number
  campuses: string[]
}

export interface ClassData {
  id: string
  visible: boolean
  name: string
  category: '수리논술' | '수능수학' | string
  badge?: 'BEST' | 'HOT' | 'NEW' | ''
  image: string | null        // 파일명만 저장 (e.g. "operon.jpg")
  duration: string            // 예: "1개월 주1회 3시간"
  modes: {
    online:  ClassMode
    offline: ClassMode
  }
  textbook: {
    included: boolean
    price: number
  }
  description: string
  keywords: [string, string, string]
  createdAt: string
  updatedAt: string
}

// 초기 데이터 (Volume에 파일 없을 때 사용)
const DEFAULT_CLASSES: ClassData[] = [
  {
    id: 'operon',
    visible: true,
    name: '수리논술 오페론',
    category: '수리논술',
    badge: 'BEST',
    image: null,
    duration: '1개월 주1회 3시간',
    modes: {
      online:  { enabled: true, price: 400000 },
      offline: { enabled: true, price: 840000, campuses: ['인천 송도'] },
    },
    textbook: { included: true, price: 38000 },
    description: '서울대, 연세대, 고려대를 비롯한 최상위 대학 수리논술 합격을 목표로 하는 최강 프로그램입니다. 10년간의 노하우와 데이터를 바탕으로 설계된 커리큘럼으로 수리논술의 정점을 경험하세요.',
    keywords: ['대학별 맞춤', '논술 첨삭', '합격 보장제'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'chuweol',
    visible: true,
    name: '수능수학 추월반',
    category: '수능수학',
    badge: 'HOT',
    image: null,
    duration: '1개월 주1회 3시간',
    modes: {
      online:  { enabled: true, price: 280000 },
      offline: { enabled: false, price: 0, campuses: [] },
    },
    textbook: { included: false, price: 0 },
    description: '수능 수학 1등급, 나아가 만점을 목표로 하는 학생들을 위한 최상위권 프로그램입니다. 개념부터 심화까지 체계적인 학습으로 수학 실력을 완성합니다.',
    keywords: ['매일 1:1 피드백', '맞춤형 문제', '실전 모의고사'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR))   fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true })
}

export function loadClasses(): ClassData[] {
  ensureDirs()
  if (!fs.existsSync(CLASSES_FILE)) {
    saveClasses(DEFAULT_CLASSES)
    return DEFAULT_CLASSES
  }
  try {
    return JSON.parse(fs.readFileSync(CLASSES_FILE, 'utf-8'))
  } catch {
    return DEFAULT_CLASSES
  }
}

export function saveClasses(classes: ClassData[]) {
  ensureDirs()
  fs.writeFileSync(CLASSES_FILE, JSON.stringify(classes, null, 2), 'utf-8')
}

export function getClassById(id: string): ClassData | null {
  return loadClasses().find(c => c.id === id) ?? null
}

export function saveClassImage(filename: string, buffer: Buffer) {
  ensureDirs()
  fs.writeFileSync(path.join(IMAGES_DIR, filename), buffer)
}

export function getImagePath(filename: string): string {
  return path.join(IMAGES_DIR, filename)
}

export function imageExists(filename: string): boolean {
  return fs.existsSync(path.join(IMAGES_DIR, filename))
}

export function deleteImage(filename: string) {
  const p = path.join(IMAGES_DIR, filename)
  if (fs.existsSync(p)) fs.unlinkSync(p)
}

export function generateId(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9가-힣]/g, '').slice(0, 20)
  return base + '-' + Date.now().toString(36)
}