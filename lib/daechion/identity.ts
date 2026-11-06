import { DaechionError, normalizePhone, type DaechionStudent, type StudentInput, type StudentPort } from './client'

function samePhone(left: string | null | undefined, right: string): boolean {
  try { return Boolean(left) && normalizePhone(left!) === right } catch { return false }
}

function verify(student: DaechionStudent, input: StudentInput): DaechionStudent {
  if (student.name.trim().normalize('NFC') !== input.name || !samePhone(student.studentPhoneNumber, input.studentPhone)) {
    throw new DaechionError('student_identity_review')
  }
  if (input.guardianPhone && ![student.parentPhoneNumber, student.parentPhoneNumber2].some(p => samePhone(p, input.guardianPhone!))) {
    // The current API has no student update endpoint; do not replace an existing guardian.
    throw new DaechionError('guardian_identity_review')
  }
  // Inactive students remain eligible; enrollment is allowed to reactivate them.
  return student
}

export async function resolveStudent(port: StudentPort, raw: StudentInput): Promise<{ student: DaechionStudent; created: boolean }> {
  const input: StudentInput = {
    name: raw.name.trim().normalize('NFC'), studentPhone: normalizePhone(raw.studentPhone),
    ...(raw.guardianPhone ? { guardianPhone: normalizePhone(raw.guardianPhone) } : {}),
  }
  if (!input.name) throw new DaechionError('invalid_student_name')
  // Name filtering would hide an account using this phone under a different name
  // (including a typo), and could incorrectly fall through to createStudent.
  const candidates = await port.students(input.studentPhone, '')
  if (candidates.length > 1) throw new DaechionError('student_identity_review')
  if (candidates.length === 1) return { student: verify(candidates[0], input), created: false }
  let created: DaechionStudent
  try { created = await port.createStudent(input) } catch (error) {
    if (!(error instanceof DaechionError) || error.status !== 409 || error.code !== 'student_exists' || !error.existingStudentId) throw error
    return { student: verify(await port.student(error.existingStudentId), input), created: false }
  }
  return { student: verify(created, input), created: true }
}
