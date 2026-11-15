/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs')
const path = require('node:path')
const {createHash, randomUUID} = require('node:crypto')

class CatalogStoreError extends Error {
  constructor(code, options) { super(code, options); this.code = code }
}
const unavailable = cause => new CatalogStoreError('CATALOG_UNAVAILABLE', {cause})
const revision = bytes => createHash('sha256').update(bytes).digest('hex')
function validateCatalog(value) {
  if (!Array.isArray(value)) throw unavailable()
  const seen = new Set()
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.id !== 'string' || !item.id.trim() || seen.has(item.id) ||
      typeof item.name !== 'string' || typeof item.visible !== 'boolean' || !item.modes || typeof item.modes !== 'object') throw unavailable()
    seen.add(item.id)
    for (const name of ['online', 'offline']) {
      const mode = item.modes[name]
      if (!mode || typeof mode !== 'object' || typeof mode.enabled !== 'boolean' || typeof mode.price !== 'number' || !Number.isFinite(mode.price) || mode.price < 0 ||
        mode.campuses !== undefined && (!Array.isArray(mode.campuses) || mode.campuses.some(campus => typeof campus !== 'string'))) throw unavailable()
    }
  }
  return value
}
function syncDirectory(directory, io) {
  let fd
  try { fd = io.openSync(directory, 'r'); io.fsyncSync(fd) }
  catch (error) {
    // Windows cannot open a directory for fsync. Rename still stays on-volume.
    if (process.platform !== 'win32' || !['EPERM', 'EISDIR', 'EACCES', 'EINVAL'].includes(error?.code)) throw error
  } finally { if (fd !== undefined) io.closeSync(fd) }
}
function atomicWrite(file, bytes, io = fs) {
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${randomUUID()}.tmp`)
  let fd
  try {
    fd = io.openSync(temporary, 'wx', 0o600)
    io.writeFileSync(fd, bytes)
    io.fsyncSync(fd)
    io.closeSync(fd); fd = undefined
    io.renameSync(temporary, file)
    syncDirectory(path.dirname(file), io)
  } finally {
    if (fd !== undefined) try { io.closeSync(fd) } catch {}
    try { io.unlinkSync(temporary) } catch (error) { if (error?.code !== 'ENOENT') throw error }
  }
}
function createCatalogStore(file, defaults, options = {}) {
  const io = options.fs || fs, backup = file + '.bak', marker = file + '.initialized', lock = file + '.lock'
  function read(target) {
    const bytes = io.readFileSync(target)
    const classes = validateCatalog(JSON.parse(bytes.toString('utf8')))
    return {classes, revision: revision(bytes), bytes}
  }
  function locked(run) {
    let held = false
    try {
      io.mkdirSync(path.dirname(file), {recursive: true})
      // No time-based stealing: a suspended writer may still own this lock.
      io.mkdirSync(lock); held = true
      return run()
    } catch (error) { throw error instanceof CatalogStoreError ? error : unavailable(error) }
    finally { if (held) try { io.rmdirSync(lock) } catch {} }
  }
  const present = target => {
    try { io.statSync(target); return true } catch (error) { if (error?.code === 'ENOENT') return false; throw unavailable(error) }
  }
  const initialized = () => present(backup) || present(marker)
  function mark() { if (!present(marker)) atomicWrite(marker, 'catalog-initialized\n', io) }
  function load() {
    try {
      const snapshot = read(file)
      if (present(marker) && present(backup)) return snapshot
      // Adopt existing installations once, before the first managed edit.
      return locked(() => {
        const current = read(file)
        mark()
        if (!present(backup)) atomicWrite(backup, current.bytes, io)
        return current
      })
    }
    catch (error) {
      if (error?.code !== 'ENOENT') throw error instanceof CatalogStoreError ? error : unavailable(error)
      if (initialized()) throw unavailable(error)
      return locked(() => {
        try { return read(file) } catch (current) { if (current?.code !== 'ENOENT') throw current }
        if (initialized()) throw unavailable()
        const classes = validateCatalog(defaults()), bytes = Buffer.from(JSON.stringify(classes, null, 2) + '\n')
        // A failed initial write must never turn a later load into a reset.
        mark()
        atomicWrite(backup, bytes, io)
        atomicWrite(file, bytes, io)
        return {classes, revision: revision(bytes), bytes}
      })
    }
  }
  function save(classes, expectedRevision) {
    validateCatalog(classes)
    if (typeof expectedRevision !== 'string' || !/^[a-f0-9]{64}$/.test(expectedRevision)) throw new CatalogStoreError('CATALOG_CONFLICT')
    return locked(() => {
      const before = read(file)
      // Validate CAS before changing the backup or primary file.
      if (before.revision !== expectedRevision) throw new CatalogStoreError('CATALOG_CONFLICT')
      const bytes = Buffer.from(JSON.stringify(classes, null, 2) + '\n')
      mark()
      atomicWrite(backup, before.bytes, io)
      atomicWrite(file, bytes, io)
      return revision(bytes)
    })
  }
  function inspect() {
    const inspectOne = target => { try { return {valid: true, revision: read(target).revision} } catch { return {valid: false} } }
    return {main: inspectOne(file), backup: inspectOne(backup), initialized: initialized(), locked: present(lock)}
  }
  function recover() {
    return locked(() => {
      const saved = read(backup)
      let original
      try { original = io.readFileSync(file) } catch (error) { if (error?.code !== 'ENOENT') throw error }
      if (original) {
        let valid = false
        try { validateCatalog(JSON.parse(original.toString('utf8'))); valid = true } catch {}
        if (valid) throw new CatalogStoreError('CATALOG_RECOVERY_NOT_REQUIRED')
      }
      const preserved = original ? file + '.corrupt-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID() : null
      if (preserved) atomicWrite(preserved, original, io)
      mark()
      atomicWrite(file, saved.bytes, io)
      return {revision: saved.revision, preserved}
    })
  }
  return {load, save, inspect, recover, paths: {file, backup, marker, lock}}
}
module.exports = {CatalogStoreError, createCatalogStore, validateCatalog, atomicWrite}
