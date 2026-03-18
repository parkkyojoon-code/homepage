/**
 * lib/homework.ts
 * Flask app.py의 과제 관련 기능을 TypeScript로 포팅
 *
 * 엑셀 구조:
 *  row 1 : 컬럼 분류 헤더
 *  row 2 : 블록 이름 헤더 (과제명 전체)
 *  row 3+: 학생 데이터
 *
 *  col 0 : 반이름
 *  col 1 : 학생이름
 *  col 2 : 학부모 번호
 *  col 3 : 학생 번호
 *  col 4~: 과제 블록 (5열씩)
 *    [발행일, 과제내용, 제출여부(O/X), 등급(A/B/C 또는 상위X%), 완성도]
 *
 *  타입 감지 (row2 헤더):
 *    "모의논술" → mock       제출카운트 O, A/B/C X
 *    "기초수학" → basic_math 제출카운트 O, A/B/C O
 *    그 외      → homework   제출카운트 O, A/B/C O
 */

import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'
import { randomUUID, createHash } from 'crypto'

// ── 경로 ────────────────────────────────────────────────────────────
const DATA_DIR      = process.env.DATA_DIR || '/app/data'
const STUDENTS_FILE = path.join(DATA_DIR, 'students_data.json')
const META_FILE     = path.join(DATA_DIR, 'meta.json')
const UPLOAD_DIR    = path.join(DATA_DIR, 'uploads')

const DATA_START_ROW       = 1  // 0-indexed (row 2 in Excel = index 1, 1행이 헤더)
const ASSIGNMENT_START_COL = 4
const BLOCK_SIZE           = 5

// 초기 비밀번호 해시 (84431621)
export const INITIAL_PASSWORD_HASH = '8c666cfec12f51780ab882860a24289ad405c505ee66d6767e69db850221a42d'

export function hashPassword(pw: string): string {
  return createHash('sha256').update(pw).digest('hex')
}

// ── 타입 ────────────────────────────────────────────────────────────
export interface Assignment {
  type: 'homework' | 'basic_math' | 'mock'
  date: string
  name: string
  submitted: 'O' | 'X'
  grade: string
  completeness: number | null
}

export interface Student {
  id: string
  class: string
  name: string
  student_phone: string | null
  parent_phone: string | null
  password: string        // SHA-256 해시, 초기값 84431621
  address: string         // 기본 주소
  address_detail: string  // 상세 주소
  total_hw: number
  submitted_count: number
  submission_rate: number
  a_count: number
  b_count: number
  c_count: number
  assignments: Assignment[]
}

export interface HomeworkMeta {
  filename: string
  uploaded_at: string
  count: number
}

// ── 유틸 ────────────────────────────────────────────────────────────
function ensureDirs() {
  if (!fs.existsSync(DATA_DIR))   fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

function normalizePhone(val: unknown): string | null {
  if (val == null) return null
  const digits = String(val).replace(/\D/g, '')
  const normalized = digits.length === 10 && digits.startsWith('10')
    ? '0' + digits
    : digits
  return normalized.length === 11 && normalized.startsWith('010')
    ? normalized
    : null
}

function cellStr(val: unknown): string {
  if (val == null) return ''
  return String(val).trim()
}

// ── 데이터 로드/저장 ────────────────────────────────────────────────
export function loadStudents(): Student[] {
  ensureDirs()
  if (!fs.existsSync(STUDENTS_FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(STUDENTS_FILE, 'utf-8'))
  } catch {
    return []
  }
}

export function saveStudents(data: Student[]) {
  ensureDirs()
  fs.writeFileSync(STUDENTS_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

export function loadMeta(): HomeworkMeta | null {
  if (!fs.existsSync(META_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(META_FILE, 'utf-8'))
  } catch {
    return null
  }
}

export function saveMeta(meta: HomeworkMeta) {
  ensureDirs()
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), 'utf-8')
}

// ── 전화번호 조회 ───────────────────────────────────────────────────
export function lookupByPhone(phone: string): Student[] {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 9) return []
  const suffix = digits.slice(-9)
  return loadStudents().filter(s =>
    (s.student_phone && s.student_phone.endsWith(suffix)) ||
    (s.parent_phone  && s.parent_phone.endsWith(suffix))
  )
}

// ── 집계 재계산 ─────────────────────────────────────────────────────
export function recalcStats(student: Student): Student {
  const { assignments } = student
  const total = assignments.length
  const submitted = assignments.filter(a => a.submitted === 'O').length
  let a = 0, b = 0, c = 0
  for (const a_ of assignments) {
    if (a_.type === 'mock') continue
    if (a_.grade === 'A') a++
    else if (a_.grade === 'B') b++
    else if (a_.grade === 'C') c++
  }
  return {
    ...student,
    total_hw: total,
    submitted_count: submitted,
    submission_rate: total > 0 ? Math.round(submitted / total * 100) : 0,
    a_count: a,
    b_count: b,
    c_count: c,
  }
}

// ── 엑셀 파싱 ───────────────────────────────────────────────────────
export function parseExcel(buffer: Buffer): Student[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  if (rows.length < 3) return []

  // 기존 학생 로드 → 비밀번호/배송지 보존을 위해
  const existingStudents = loadStudents()
  const phoneToExisting = new Map<string, Student>()
  for (const s of existingStudents) {
    if (s.student_phone) phoneToExisting.set(s.student_phone, s)
    if (s.parent_phone)  phoneToExisting.set(s.parent_phone, s)
  }

  // 타입 감지: 1행(index 0)이 헤더 — 블록 시작 열(5,10,15...)의 값으로 타입 결정
  const blockTypes: Record<number, 'homework' | 'basic_math' | 'mock'> = {}
  const blockNames: Record<number, string> = {}

  const headerRow = (rows[0] || []) as unknown[]

  for (let col = ASSIGNMENT_START_COL; col < headerRow.length; col += BLOCK_SIZE) {
    const h = cellStr(headerRow[col])
    if (h.includes('모의논술'))      blockTypes[col] = 'mock'
    else if (h.includes('기초수학')) blockTypes[col] = 'basic_math'
    else                             blockTypes[col] = 'homework'
    blockNames[col] = h
  }

  const students: Student[] = []

  for (let ri = DATA_START_ROW; ri < rows.length; ri++) {
    const row = rows[ri] as unknown[]
    if (!row || row.length < 4) continue

    const className  = cellStr(row[0])
    const name       = cellStr(row[1])
    const parentRaw  = row[2]
    const studentRaw = row[3]

    if (!name) continue

    const studentPhone = normalizePhone(studentRaw)
    const parentPhone  = normalizePhone(parentRaw)
    if (!studentPhone && !parentPhone) continue

    // 기존 학생에서 비밀번호/배송지 보존
    const existing = (studentPhone && phoneToExisting.get(studentPhone))
      || (parentPhone && phoneToExisting.get(parentPhone))
      || null

    const assignments: Assignment[] = []
    let totalCount  = 0
    let submitCount = 0
    let aCount = 0, bCount = 0, cCount = 0

    for (let col = ASSIGNMENT_START_COL; col + BLOCK_SIZE <= row.length; col += BLOCK_SIZE) {
      const dateVal      = row[col]
      const content      = row[col + 1]
      const submittedYn  = row[col + 2]
      const gradeVal     = row[col + 3]
      const completeness = row[col + 4]

      if (dateVal == null && content == null) continue

      const blockType    = blockTypes[col] ?? 'homework'
      const submittedStr = cellStr(submittedYn) === 'O' ? 'O' : 'X'
      const gradeStr     = cellStr(gradeVal) || '-'
      const compVal      = typeof completeness === 'number' ? completeness : null

      totalCount++
      if (submittedStr === 'O') submitCount++

      if (blockType !== 'mock') {
        if (gradeStr === 'A') aCount++
        else if (gradeStr === 'B') bCount++
        else if (gradeStr === 'C') cCount++
      }

      const displayName = blockType === 'mock'
        ? (blockNames[col] || '모의논술')
        : cellStr(content)

      assignments.push({
        type:         blockType,
        date:         cellStr(dateVal),
        name:         displayName,
        submitted:    submittedStr as 'O' | 'X',
        grade:        gradeStr,
        completeness: compVal,
      })
    }

    students.push({
      id:              existing?.id ?? randomUUID(),
      class:           className,
      name,
      student_phone:   studentPhone,
      parent_phone:    parentPhone,
      password:        existing?.password ?? INITIAL_PASSWORD_HASH,
      address:         existing?.address ?? '',
      address_detail:  existing?.address_detail ?? '',
      total_hw:        totalCount,
      submitted_count: submitCount,
      submission_rate: totalCount > 0 ? Math.round(submitCount / totalCount * 100) : 0,
      a_count:         aCount,
      b_count:         bCount,
      c_count:         cCount,
      assignments,
    })
  }

  return students
}

// ── 업로드 파일 저장 ─────────────────────────────────────────────────
export function saveUploadedFile(filename: string, buffer: Buffer) {
  ensureDirs()
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer)
}
