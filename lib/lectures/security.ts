import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto'
import { promisify } from 'node:util'

const derive = promisify(scrypt)
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const key = await derive(password, salt, 64) as Buffer
  return `scrypt:${salt}:${key.toString('hex')}`
}
export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, expected] = encoded.split(':')
  if (algorithm !== 'scrypt' || !salt || !/^[a-f0-9]{128}$/.test(expected ?? '')) return false
  const key = await derive(password, salt, 64) as Buffer
  return timingSafeEqual(key, Buffer.from(expected, 'hex'))
}
export function newSession() { return randomBytes(32).toString('hex') }
export function tokenHash(token: string) { return createHash('sha256').update(token).digest('hex') }
