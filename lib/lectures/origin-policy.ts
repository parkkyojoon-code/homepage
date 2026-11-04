type OriginSettings = { primary?: string; additional?: string }

function isOrigin(value: string) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && url.origin === value
  } catch { return false }
}

export function acceptsLectureOrigin(request: Request, settings: OriginSettings) {
  const supplied = request.headers.get('origin')
  if (!supplied || !isOrigin(supplied)) return false

  if (settings.primary) {
    const origins = [settings.primary, ...(settings.additional ? settings.additional.split(',').map(value => value.trim()) : [])]
    // A malformed deployment setting must not broaden the trusted origins.
    return origins.every(isOrigin) && origins.includes(supplied)
  }
  // Aliases only extend an explicit primary; they never replace it.
  if (settings.additional) return false
  const url = new URL(request.url)
  const local = `${url.protocol}//${request.headers.get('host') || url.host}`
  return supplied === local
}
