import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const DATA_DIR = process.env.DATA_DIR || '/app/data'
const LECTURES_FILE = path.join(DATA_DIR, 'lectures.json')
const SUBMISSIONS_DIR = path.join(DATA_DIR, 'submissions')
const SUBMISSIONS_META = path.join(DATA_DIR, 'submissions_meta.json')

export interface LectureVideo {
  id: string
  title: string
  youtubeUrl: string
  week: number
}

export interface LectureNotice {
  id: string
  title: string
  content: string
  createdAt: string
}

export interface LectureAssignment {
  id: string
  title: string
  description: string
  dueDate: string
}

export interface Lecture {
  id: string
  name: string
  description: string
  videos: LectureVideo[]
  notices: LectureNotice[]
  assignments: LectureAssignment[]
}

export interface Submission {
  id: string
  studentId: string
  studentName: string
  lectureId: string
  lectureName: string
  assignmentId: string
  assignmentTitle: string
  filename: string
  originalName: string
  submittedAt: string
  fileSize: number
  mimeType: string
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export function loadLectures(): Lecture[] {
  ensureDir(DATA_DIR)
  if (!fs.existsSync(LECTURES_FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(LECTURES_FILE, 'utf-8'))
  } catch {
    return []
  }
}

export function saveLectures(data: Lecture[]) {
  ensureDir(DATA_DIR)
  fs.writeFileSync(LECTURES_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

export function loadSubmissions(): Submission[] {
  ensureDir(DATA_DIR)
  if (!fs.existsSync(SUBMISSIONS_META)) return []
  try {
    return JSON.parse(fs.readFileSync(SUBMISSIONS_META, 'utf-8'))
  } catch {
    return []
  }
}

export function saveSubmissions(data: Submission[]) {
  ensureDir(DATA_DIR)
  fs.writeFileSync(SUBMISSIONS_META, JSON.stringify(data, null, 2), 'utf-8')
}

export function saveSubmissionFile(submissionId: string, buffer: Buffer, ext: string): string {
  ensureDir(SUBMISSIONS_DIR)
  const filename = `${submissionId}${ext}`
  fs.writeFileSync(path.join(SUBMISSIONS_DIR, filename), buffer)
  return filename
}

export function getSubmissionFilePath(filename: string): string {
  return path.join(SUBMISSIONS_DIR, filename)
}

export function createLecture(name: string, description: string): Lecture {
  return { id: randomUUID(), name, description, videos: [], notices: [], assignments: [] }
}

export function createVideo(title: string, youtubeUrl: string, week: number): LectureVideo {
  return { id: randomUUID(), title, youtubeUrl, week }
}

export function createNotice(title: string, content: string): LectureNotice {
  return { id: randomUUID(), title, content, createdAt: new Date().toISOString() }
}

export function createAssignment(title: string, description: string, dueDate: string): LectureAssignment {
  return { id: randomUUID(), title, description, dueDate }
}
