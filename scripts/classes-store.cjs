/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('node:path')
const {createCatalogStore} = require('../lib/catalog-store.cjs')

function parse(args) {
  const [command, flag, directory, ...rest] = args
  if (!['status', 'recover'].includes(command) || flag !== '--data-dir' || !directory ||
    (command === 'status' ? rest.length !== 0 : rest.length !== 1 || rest[0] !== '--confirm-writers-stopped')) throw Error('CATALOG_INVALID_COMMAND')
  return {command, directory: path.resolve(directory)}
}
function run(args) {
  const {command, directory} = parse(args)
  const store = createCatalogStore(path.join(directory, 'classes.json'), () => {throw Error('CATALOG_BOOTSTRAP_FORBIDDEN')})
  return command === 'status' ? store.inspect() : store.recover()
}
if (require.main === module) {
  try { console.log(JSON.stringify(run(process.argv.slice(2)))) }
  catch (error) { console.error(/^CATALOG_[A-Z_]+$/.test(error?.code || error?.message) ? error.code || error.message : 'CATALOG_UNAVAILABLE'); process.exitCode = 1 }
}
module.exports = {parse, run}
