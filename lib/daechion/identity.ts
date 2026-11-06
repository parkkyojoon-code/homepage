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

export class IdentityReview extends DaechionError {
  constructor(code: string, public readonly detected: 'NEW' | 'EXISTING' | 'UNKNOWN') { super(code) }
}
export async function resolveStudent(port: StudentPort, raw: StudentInput, options: {
  history?: 'NEW' | 'EXISTING'; knownCreatedId?: number; manualApprovedId?:number
} = {}): Promise<{ student: DaechionStudent; created: boolean; detected: 'NEW' | 'EXISTING' }> {
  const input: StudentInput = {
    name: raw.name.trim().normalize('NFC'), studentPhone: normalizePhone(raw.studentPhone),
    ...(raw.guardianPhone ? { guardianPhone: normalizePhone(raw.guardianPhone) } : {}),
  }
  if (!input.name) throw new DaechionError('invalid_student_name')
  if (!options.history&&!options.manualApprovedId) throw new IdentityReview('identity_declaration_missing', 'UNKNOWN')
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
  if(options.manualApprovedId){
    const selected=candidates.get(options.manualApprovedId)
    if(!selected)throw new IdentityReview('identity_binding_changed',detected)
    try{return {student:verify(selected,input),created:false,detected}}
    catch(error){throw new IdentityReview(error instanceof DaechionError?error.code:'student_identity_review',detected)}
  }
  if (options.knownCreatedId !== undefined) {
    if (candidates.size !== 1 || !candidates.has(options.knownCreatedId)) throw new IdentityReview('identity_binding_changed', detected)
  } else if (options.history !== detected) throw new IdentityReview('identity_declaration_mismatch', detected)
  if (candidates.size > 1) throw new IdentityReview('student_identity_review', detected)
  if (candidates.size === 1) {
    try { return { student: verify([...candidates.values()][0], input), created: false, detected } }
    catch (error) { throw new IdentityReview(error instanceof DaechionError ? error.code : 'student_identity_review', detected) }
  }
  let created: DaechionStudent
  try { created = await port.createStudent(input) } catch (error) {
    if (error instanceof DaechionError && error.status === 409 && error.code === 'student_exists') throw new IdentityReview('identity_declaration_mismatch', 'EXISTING')
    throw error
  }
  return { student: verify(created, input), created: true, detected }
}
