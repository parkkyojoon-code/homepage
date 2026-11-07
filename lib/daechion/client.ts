import { z } from 'zod'

const id = z.number().int().positive().safe()
const studentSchema = z.object({
  id, name: z.string().min(1), active: z.boolean(),
  studentPhoneNumber: z.string().nullable().optional(),
  parentPhoneNumber: z.string().nullable().optional(),
  parentPhoneNumber2: z.string().nullable().optional(),
})
export type DaechionStudent = z.infer<typeof studentSchema>
const externalId = z.union([z.string().min(1), id])
const meSchema = z.object({ tenantId: externalId, keyId: externalId, keyName: z.string().nullable().optional(), scopes: z.array(z.string()) })
const lectureSchema = z.object({
  id, name: z.string(), opened: z.boolean(),
  weeklyLectures: z.array(z.object({ id, name: z.string(), date: z.string().nullable().optional() })),
})
const enrollmentSchema = z.object({
  lectureId: id, studentId: id,
  enrolledWeeklyLectureIds: z.array(id), alreadyEnrolledWeeklyLectureIds: z.array(id),
})
export type DaechionEnrollment = z.infer<typeof enrollmentSchema>

export class DaechionError extends Error {
  constructor(public readonly code: string, public readonly status = 0,
    public readonly existingStudentId?: number, public readonly retryAfterMs?: number) {
    // Never retain upstream message/details, request bodies, phones or API keys.
    super(`Daechion request failed (${code})`)
  }
}

export function normalizePhone(value: string): string {
  const phone = value.replace(/[\s-]/g, '')
  if (!/^01\d{9}$/.test(phone)) throw new DaechionError('invalid_phone')
  return phone
}

export interface StudentInput { name: string; studentPhone: string; guardianPhone?: string }
export interface StudentPort {
  students(phone: string, name: string): Promise<DaechionStudent[]>
  student(studentId: number): Promise<DaechionStudent>
  createStudent(input: StudentInput): Promise<DaechionStudent>
}

export function daechionClient(config: { apiKey: string; fetcher?: typeof fetch; timeoutMs?: number }) {
  if (!config.apiKey.trim() || /[\r\n]/.test(config.apiKey)) throw new DaechionError('missing_api_key')
  const fetcher = config.fetcher ?? fetch
  async function request<T>(method: 'GET' | 'POST', path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
    let response: Response
    try {
      response = await fetcher(`https://api.daechion.com${path}`, {
        method, redirect: 'error', cache: 'no-store',
        headers: { 'X-Api-Key': config.apiKey, Accept: 'application/json', 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(config.timeoutMs ?? 15000),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    } catch { throw new DaechionError('transport_unknown') }
    let data: unknown
    try { data = await response.json() } catch { throw new DaechionError('invalid_response', response.status) }
    if (!response.ok) {
      const error = z.object({ error: z.object({ code: z.string(), details: z.unknown().optional() }) }).safeParse(data)
      const code = error.success && /^[a-z_]{1,64}$/.test(error.data.error.code) ? error.data.error.code : 'request_failed'
      const details = error.success ? z.object({ studentId: id }).safeParse(error.data.error.details) : null
      const seconds = response.headers.get('Retry-After')
      const retryAfterMs = seconds !== null && /^\d+$/.test(seconds) ? Math.min(Number(seconds), 86400) * 1000 : undefined
      throw new DaechionError(code, response.status,
        response.status === 409 && code === 'student_exists' && details?.success ? details.data.studentId : undefined,
        retryAfterMs)
    }
    const result = schema.safeParse(data)
    if (!result.success) throw new DaechionError('invalid_response', response.status)
    return result.data
  }
  // No automatic retries here: callers must reconcile unknown write results first.
  return {
    me: () => request('GET', '/v1/me', meSchema),
    lectures: () => request('GET', '/v1/lectures', z.array(lectureSchema)),
    students: (phone: string, name: string) => {
      const query = new URLSearchParams({ phone: normalizePhone(phone) })
      if (name.trim()) query.set('name', name.trim().normalize('NFC'))
      return request('GET', `/v1/students?${query}`, z.array(studentSchema))
    },
    student: async (studentId: number) => {
      const result = await request('GET', `/v1/students/${id.parse(studentId)}`, studentSchema)
      if (result.id !== studentId) throw new DaechionError('student_result_mismatch')
      return result
    },
    createStudent: (input: StudentInput) => {
      const name = z.string().trim().min(1).parse(input.name).normalize('NFC')
      return request('POST', '/v1/students', studentSchema, {
        name, studentPhoneNumber: normalizePhone(input.studentPhone),
        ...(input.guardianPhone ? { parentPhoneNumber: normalizePhone(input.guardianPhone) } : {}),
      })
    },
    enroll: async (lectureId: number, studentId: number): Promise<DaechionEnrollment> => {
      id.parse(lectureId); id.parse(studentId)
      const result = await request('POST', `/v1/lectures/${lectureId}/enrollments`, enrollmentSchema, { studentId })
      const added = result.enrolledWeeklyLectureIds, existing = result.alreadyEnrolledWeeklyLectureIds
      if (result.lectureId !== lectureId || result.studentId !== studentId || added.length + existing.length === 0 ||
        new Set([...added, ...existing]).size !== added.length + existing.length) {
        throw new DaechionError('enrollment_result_mismatch')
      }
      return result
    },
  }
}
