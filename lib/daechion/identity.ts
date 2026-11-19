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

export function studentLoginPhones(student: DaechionStudent): string[] {
  const phones: string[] = []
  for (const value of [student.studentPhoneNumber, student.parentPhoneNumber, student.parentPhoneNumber2]) {
    try { if (value) phones.push(normalizePhone(value)) } catch { /* An invalid stored slot cannot establish a match. */ }
  }
  return [...new Set(phones)]
}

// Existing students may have entered their student and guardian login numbers
// in reversed roles. Preserve the original profile and require every supplied
// login number to belong to this one account; a payer number is never examined.
export function verifyExistingStudent(student: DaechionStudent, raw: StudentInput): DaechionStudent {
  const name = raw.name.trim().normalize('NFC'), studentPhone = normalizePhone(raw.studentPhone)
  const phones = studentLoginPhones(student)
  if (!name || student.name.trim().normalize('NFC') !== name || !phones.includes(studentPhone)) {
    throw new DaechionError('student_identity_review')
  }
  if (raw.guardianPhone && !phones.includes(normalizePhone(raw.guardianPhone))) {
    throw new DaechionError('guardian_identity_review')
  }
  return student
}

export class IdentityReview extends DaechionError {
  constructor(code: string, public readonly detected: 'NEW' | 'EXISTING' | 'UNKNOWN') { super(code) }
}
export async function resolveStudent(port: StudentPort, raw: StudentInput, options: {
  history?: 'NEW' | 'EXISTING'; knownCreatedId?: number; knownExistingId?: number; manualApprovedId?:number
} = {}): Promise<{ student: DaechionStudent; created: boolean; detected: 'NEW' | 'EXISTING' }> {
  const input: StudentInput = {
    name: raw.name.trim().normalize('NFC'), studentPhone: normalizePhone(raw.studentPhone),
    ...(raw.guardianPhone ? { guardianPhone: normalizePhone(raw.guardianPhone) } : {}),
  }
  if (!input.name) throw new DaechionError('invalid_student_name')
  if ([options.knownCreatedId, options.knownExistingId, options.manualApprovedId].filter(id => id !== undefined).length > 1) {
    throw new IdentityReview('identity_binding_changed', 'UNKNOWN')
  }
  if (!options.history&&options.manualApprovedId===undefined) throw new IdentityReview('identity_declaration_missing', 'UNKNOWN')
  const candidates = new Map<number, DaechionStudent>()
  try {
    for (const phone of new Set([input.studentPhone, input.guardianPhone].filter((value): value is string => Boolean(value)))) {
      for (const student of await port.students(phone, '')) {
        if (![student.studentPhoneNumber, student.parentPhoneNumber, student.parentPhoneNumber2].some(value => samePhone(value, phone))) {
          throw new IdentityReview('identity_lookup_invalid', 'UNKNOWN')
        }
        const previous = candidates.get(student.id)
        if (previous && JSON.stringify(previous) !== JSON.stringify(student)) throw new IdentityReview('identity_lookup_changed', 'UNKNOWN')
        candidates.set(student.id, student)
      }
    }
  } catch (error) {
    if (error instanceof IdentityReview) throw error
    throw new IdentityReview('identity_lookup_failed', 'UNKNOWN')
  }
  const detected = candidates.size ? 'EXISTING' : 'NEW'
  if(options.manualApprovedId!==undefined){
    if(candidates.size>1)throw new IdentityReview('student_identity_review',detected)
    const selected=candidates.get(options.manualApprovedId)
    if(!selected)throw new IdentityReview('identity_binding_changed',detected)
    try{return {student:verifyExistingStudent(selected,input),created:false,detected}}
    catch(error){throw new IdentityReview(error instanceof DaechionError?error.code:'student_identity_review',detected)}
  }
  if (options.knownCreatedId !== undefined) {
    if (candidates.size !== 1 || !candidates.has(options.knownCreatedId)) throw new IdentityReview('identity_binding_changed', detected)
  } else if (options.knownExistingId !== undefined) {
    if (candidates.size !== 1 || !candidates.has(options.knownExistingId)) throw new IdentityReview('identity_binding_changed', detected)
  } else if (options.history !== detected) throw new IdentityReview('identity_declaration_mismatch', detected)
  if (candidates.size > 1) throw new IdentityReview('student_identity_review', detected)
  if (candidates.size === 1) {
    try { return { student: (options.knownCreatedId !== undefined ? verify : verifyExistingStudent)([...candidates.values()][0], input), created: false, detected } }
    catch (error) { throw new IdentityReview(error instanceof DaechionError ? error.code : 'student_identity_review', detected) }
  }
  let created: DaechionStudent
  try { created = await port.createStudent(input) } catch (error) {
    if (error instanceof DaechionError && error.status === 409 && error.code === 'student_exists') throw new IdentityReview('identity_declaration_mismatch', 'EXISTING')
    throw error
  }
  return { student: verify(created, input), created: true, detected }
}
