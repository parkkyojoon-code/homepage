import { cookies } from 'next/headers'

export async function isAdminAuthed(): Promise<boolean> {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  const secret = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD
  return !!session && !!secret && session === secret
}
