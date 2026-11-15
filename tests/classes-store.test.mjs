import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {tmpdir} from 'node:os'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'
import storeModule from '../lib/catalog-store.cjs'
import recovery from '../scripts/classes-store.cjs'

const {createCatalogStore,CatalogStoreError}=storeModule
const original=()=>[
  {id:'12course',name:'원래 수업',visible:true,modes:{online:{enabled:true,price:400000},offline:{enabled:false,price:0}},
    legacyProperty:{keep:['원본',1]},subjectSelection:{subjects:['수1','수2'],tiers:[{count:1,price:400000}]}},
  {id:'new-p2',purchaseProcess:'PROCESS_2',name:'새 수업',visible:false,modes:{online:{enabled:true,price:1000,custom:'보존'},offline:{enabled:false,price:0}},
    daechionBinding:{tenantId:'fixture-only',lectures:[{id:10,name:'원본 강의'}],verifiedAt:'2026-11-15T00:00:00Z'},futureField:{nested:true}},
]
const ioError=()=>Object.assign(Error('Synthetic disk failure'),{code:'EIO'})
function fixture(){
  const directory=fs.mkdtempSync(path.join(tmpdir(),'pkjmath-catalog-store-')),file=path.join(directory,'classes.json')
  const store=createCatalogStore(file,original)
  return {directory,file,store,close:()=>{
    const resolved=path.resolve(directory)
    assert.equal(path.dirname(resolved),path.resolve(tmpdir()));assert.ok(path.basename(resolved).startsWith('pkjmath-catalog-store-'))
    fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:100})
  }}
}
const unavailable=error=>error instanceof CatalogStoreError&&error.code==='CATALOG_UNAVAILABLE'
const conflict=error=>error instanceof CatalogStoreError&&error.code==='CATALOG_CONFLICT'

test('catalog bootstrap, adoption and edits preserve original process1/2 products and unknown fields',()=>{
  const f=fixture()
  try{
    const snapshot=f.store.load()
    assert.deepEqual(snapshot.classes,original());assert.ok(fs.existsSync(f.file+'.bak'));assert.ok(fs.existsSync(f.file+'.initialized'))
    snapshot.classes[1].name='수정된 새 수업'
    f.store.save(snapshot.classes,snapshot.revision)
    const after=f.store.load().classes
    assert.deepEqual(after[0],original()[0]);assert.deepEqual(after[1].futureField,{nested:true})
    assert.equal(after[1].modes.online.custom,'보존');assert.deepEqual(after[1].daechionBinding,original()[1].daechionBinding)
    assert.deepEqual(JSON.parse(fs.readFileSync(f.file+'.bak','utf8')),original())
    assert.deepEqual(fs.readdirSync(f.directory).filter(name=>name.endsWith('.tmp')),[])
    fs.unlinkSync(f.file+'.bak');fs.unlinkSync(f.file+'.initialized')
    assert.deepEqual(f.store.load().classes,after)
    assert.deepEqual(JSON.parse(fs.readFileSync(f.file+'.bak','utf8')),after)
  }finally{f.close()}
})

test('invalid JSON/root/core fields or unreadable existing catalogs never serve or write defaults',()=>{
  for(const bytes of ['{broken','{}','null',JSON.stringify([{id:'x',name:'수업',visible:true}]),JSON.stringify([...original(),original()[0]])]){
    const f=fixture()
    try{
      f.store.load();const backup=fs.readFileSync(f.file+'.bak','utf8')
      fs.writeFileSync(f.file,bytes)
      assert.throws(()=>f.store.load(),unavailable)
      assert.throws(()=>f.store.save(original(),'a'.repeat(64)),unavailable)
      assert.equal(fs.readFileSync(f.file,'utf8'),bytes);assert.equal(fs.readFileSync(f.file+'.bak','utf8'),backup)
    }finally{f.close()}
  }
  const f=fixture()
  try{
    f.store.load();const before=fs.readFileSync(f.file,'utf8')
    const io={...fs,readFileSync:(file,...args)=>{if(file===f.file)throw Object.assign(Error('unreadable'),{code:'EACCES'});return fs.readFileSync(file,...args)}}
    assert.throws(()=>createCatalogStore(f.file,()=>{throw Error('Defaults must not run')},{fs:io}).load(),unavailable)
    assert.equal(fs.readFileSync(f.file,'utf8'),before)
  }finally{f.close()}
})

test('write failure and a failure before rename leave the valid primary and backup readable',()=>{
  for(const phase of ['write','rename']){
    const f=fixture()
    try{
      const before=f.store.load(),bytes=fs.readFileSync(f.file,'utf8');before.classes[1].name='저장 실패'
      let mainFd
      const io={...fs,
        openSync:(file,...args)=>{const fd=fs.openSync(file,...args);if(typeof file==='string'&&/^\.classes\.json\.\d+\.[\w-]+\.tmp$/.test(path.basename(file)))mainFd=fd;return fd},
        writeFileSync:(fd,...args)=>{if(phase==='write'&&fd===mainFd)throw ioError();return fs.writeFileSync(fd,...args)},
        renameSync:(source,destination)=>{if(phase==='rename'&&destination===f.file)throw ioError();return fs.renameSync(source,destination)},
      }
      assert.throws(()=>createCatalogStore(f.file,original,{fs:io}).save(before.classes,before.revision),unavailable)
      assert.equal(fs.readFileSync(f.file,'utf8'),bytes);assert.equal(fs.readFileSync(f.file+'.bak','utf8'),bytes)
      assert.equal(f.store.load().classes[1].name,'새 수업');assert.equal(fs.existsSync(f.file+'.lock'),false)
      assert.deepEqual(fs.readdirSync(f.directory).filter(name=>name.endsWith('.tmp')),[])
    }finally{f.close()}
  }
})

test('the same-directory temporary file is synced and closed before atomic replacement',()=>{
  const f=fixture()
  try{
    const snapshot=f.store.load(),events=[],files=new Map()
    const io={...fs,
      openSync:(file,...args)=>{const fd=fs.openSync(file,...args);files.set(fd,file);events.push(['open',file,fd]);return fd},
      writeFileSync:(fd,...args)=>{events.push(['write',files.get(fd),fd]);return fs.writeFileSync(fd,...args)},
      fsyncSync:fd=>{events.push(['sync',files.get(fd),fd]);return fs.fsyncSync(fd)},
      closeSync:fd=>{events.push(['close',files.get(fd),fd]);return fs.closeSync(fd)},
      renameSync:(source,destination)=>{events.push(['rename',source,destination]);assert.equal(path.dirname(source),path.dirname(destination));return fs.renameSync(source,destination)},
    }
    snapshot.classes[1].visible=true
    createCatalogStore(f.file,original,{fs:io}).save(snapshot.classes,snapshot.revision)
    const rename=events.findIndex(event=>event[0]==='rename'&&event[2]===f.file),temporary=events[rename][1]
    const index=kind=>events.findIndex(event=>event[0]===kind&&event[1]===temporary)
    assert.ok(index('open')<index('write')&&index('write')<index('sync')&&index('sync')<index('close')&&index('close')<rename)
  }finally{f.close()}
})

test('an error after rename reports an uncertain commit and a stale replay cannot undo it',()=>{
  const f=fixture()
  try{
    const snapshot=f.store.load();snapshot.classes[1].name='이름 변경 완료'
    const io={...fs,renameSync:(source,destination)=>{fs.renameSync(source,destination);if(destination===f.file)throw ioError()}}
    assert.throws(()=>createCatalogStore(f.file,original,{fs:io}).save(snapshot.classes,snapshot.revision),unavailable)
    assert.equal(f.store.load().classes[1].name,'이름 변경 완료')
    assert.throws(()=>f.store.save(original(),snapshot.revision),conflict)
    assert.deepEqual(JSON.parse(fs.readFileSync(f.file+'.bak','utf8')),original())
  }finally{f.close()}
})

test('CAS rejects stale load/await/save edits before touching either file and supports reordered arrays',()=>{
  const f=fixture()
  try{
    const first=f.store.load(),stale=f.store.load()
    first.classes[0].name='다른 관리자의 편집';f.store.save(first.classes,first.revision)
    const main=fs.readFileSync(f.file,'utf8'),backup=fs.readFileSync(f.file+'.bak','utf8')
    stale.classes[1].name='오래된 화면의 저장'
    assert.throws(()=>f.store.save(stale.classes,stale.revision),conflict)
    assert.equal(fs.readFileSync(f.file,'utf8'),main);assert.equal(fs.readFileSync(f.file+'.bak','utf8'),backup)
    const latest=f.store.load();f.store.save([...latest.classes].reverse(),latest.revision)
    assert.deepEqual(f.store.load().classes.map(item=>item.id),['new-p2','12course'])
    assert.equal(f.store.load().classes[1].name,'다른 관리자의 편집')
    assert.throws(()=>f.store.save(original()),conflict)
  }finally{f.close()}
})

test('concurrent processes preserve one committed update and reject the competing stale writer',async()=>{
  const f=fixture(),children=[]
  try{
    f.store.load()
    const helper=fileURLToPath(new URL('../lib/catalog-store.cjs',import.meta.url))
    const source=`const {createCatalogStore}=require(process.argv[2]);const store=createCatalogStore(process.argv[1],()=>[]);const snap=store.load();process.send({ready:true});process.on('message',()=>{snap.classes[1].name=process.argv[3];try{store.save(snap.classes,snap.revision);process.send({saved:true,name:process.argv[3]})}catch(error){process.send({saved:false,code:error.code})}process.disconnect()})`
    for(const name of ['동시 편집 A','동시 편집 B'])children.push(spawn(process.execPath,['-e',source,f.file,helper,name],{windowsHide:true,stdio:['ignore','ignore','ignore','ipc']}))
    await Promise.all(children.map(child=>once(child,'message')))
    const results=children.map(child=>once(child,'message').then(([value])=>value))
    children.forEach(child=>child.send('save'))
    const saved=await Promise.all(results),success=saved.filter(result=>result.saved)
    assert.equal(success.length,1)
    assert.ok(saved.filter(result=>!result.saved).every(result=>['CATALOG_CONFLICT','CATALOG_UNAVAILABLE'].includes(result.code)))
    assert.equal(f.store.load().classes[1].name,success[0].name)
    assert.deepEqual(JSON.parse(fs.readFileSync(f.file+'.bak','utf8')),original())
    await Promise.all(children.map(child=>child.exitCode===null?once(child,'exit'):Promise.resolve()))
  }finally{children.forEach(child=>{if(child.exitCode===null)child.kill()});f.close()}
})

test('a busy or abandoned writer lock is never stolen based on age',()=>{
  const f=fixture()
  try{
    const snapshot=f.store.load();fs.mkdirSync(f.file+'.lock')
    fs.utimesSync(f.file+'.lock',new Date(0),new Date(0))
    assert.throws(()=>f.store.save(original(),snapshot.revision),unavailable)
    assert.throws(()=>f.store.recover(),unavailable)
    assert.equal(fs.existsSync(f.file+'.lock'),true);assert.deepEqual(f.store.load().classes,original())
    fs.rmdirSync(f.file+'.lock')
  }finally{f.close()}
})

test('missing or corrupt primary files require explicit validated backup recovery and preserve corrupt bytes',()=>{
  for(const mode of ['missing','corrupt']){
    const f=fixture()
    try{
      f.store.load()
      if(mode==='missing')fs.unlinkSync(f.file);else fs.writeFileSync(f.file,'{corrupt original bytes')
      const store=createCatalogStore(f.file,()=>{throw Error('Never silently bootstrap a previous store')})
      assert.throws(()=>store.load(),unavailable)
      assert.equal(recovery.run(['status','--data-dir',f.directory]).main.valid,false)
      assert.throws(()=>recovery.run(['recover','--data-dir',f.directory]),/CATALOG_INVALID_COMMAND/)
      const result=recovery.run(['recover','--data-dir',f.directory,'--confirm-writers-stopped'])
      assert.deepEqual(store.load().classes,original())
      if(mode==='corrupt')assert.equal(fs.readFileSync(result.preserved,'utf8'),'{corrupt original bytes')
      else assert.equal(result.preserved,null)
      assert.throws(()=>store.recover(),error=>error.code==='CATALOG_RECOVERY_NOT_REQUIRED')
    }finally{f.close()}
  }
})

test('failed bootstrap and damaged backup never trigger an automatic reset or overwrite',()=>{
  const f=fixture()
  try{
    let defaults=0
    const io={...fs,renameSync:(source,destination)=>{if(destination===f.file)throw ioError();return fs.renameSync(source,destination)}}
    assert.throws(()=>createCatalogStore(f.file,()=>{defaults++;return original()},{fs:io}).load(),unavailable)
    assert.equal(defaults,1);assert.equal(fs.existsSync(f.file),false)
    assert.throws(()=>createCatalogStore(f.file,()=>{defaults++;return []}).load(),unavailable);assert.equal(defaults,1)
    f.store.recover();fs.writeFileSync(f.file,'{main broken');fs.writeFileSync(f.file+'.bak','{backup broken')
    assert.throws(()=>f.store.recover(),unavailable)
    assert.equal(fs.readFileSync(f.file,'utf8'),'{main broken');assert.equal(fs.readFileSync(f.file+'.bak','utf8'),'{backup broken')
  }finally{f.close()}
})

test('classes facade captures array revisions and reordering preserves its CAS for legacy forms',()=>{
  const f=fixture(),previous=process.env.DATA_DIR
  try{
    process.env.DATA_DIR=f.directory;fs.writeFileSync(f.file,JSON.stringify(original()))
    const require=createRequire(import.meta.url),ts=require('typescript'),Module=require('node:module')
    const filename=fileURLToPath(new URL('../lib/classes.ts',import.meta.url))
    const source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText
    const compiled=new Module(filename);compiled.filename=filename;compiled.paths=Module._nodeModulePaths(path.dirname(filename));compiled._compile(source,filename)
    const api=compiled.exports,first=api.loadClasses(),stale=api.loadClasses()
    first[0].name='프로세스1 편집';api.saveClasses(first)
    stale[1].name='프로세스2 오래된 편집';assert.throws(()=>api.saveClasses(stale),conflict)
    const reordered=api.reorderClasses(['new-p2','12course'])
    assert.deepEqual(reordered.map(item=>item.id),['new-p2','12course']);assert.equal(api.getClassById('12course').name,'프로세스1 편집')
    assert.deepEqual(api.getClassById('12course').legacyProperty,original()[0].legacyProperty)
  }finally{if(previous===undefined)delete process.env.DATA_DIR;else process.env.DATA_DIR=previous;f.close()}
})
