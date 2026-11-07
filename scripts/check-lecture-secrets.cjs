const {execFileSync}=require('node:child_process')
const {readFileSync}=require('node:fs')
const {resolve}=require('node:path')
const root=resolve(__dirname,'..')
const git=args=>execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,...args],{cwd:root,maxBuffer:100*1024*1024})
let files=git(['diff','--cached','--name-only','--diff-filter=ACMR','-z']).toString('utf8').split('\0').filter(Boolean)
const staged=files.length>0
if(!staged)files=git(['ls-files','-z']).toString('utf8').split('\0').filter(f=>/^(app\/(?:api\/lectures|admin\/lectures|lectures)\/|lib\/lectures\/|db\/lectures\/|scripts\/|tests\/|workers\/lectures\/|docs\/lecture|docs\/payssam|\.github\/|\.env)/.test(f))
const rules=[
 ['PRIVATE_KEY',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
 ['GITHUB_TOKEN',/\b(?:gh[pousr]_[A-Za-z0-9]{24,}|github_pat_[A-Za-z0-9_]{40,})\b/g],
 ['GOOGLE_API_KEY',/\bAIza[0-9A-Za-z_-]{35}\b/g],
 ['AWS_ACCESS_KEY',/\bAKIA[A-Z0-9]{16}\b/g],
 ['LITERAL_API_KEY',/\b(?:PAYSSAM_API_KEY|SOLAPI_API_KEY|apiKey)\s*[:=]\s*['"][A-Za-z0-9_-]{24,}['"]/g],
]
const failures=[]
for(const file of files){
 if((/(^|\/)\.env(?:\.|$)/.test(file)&&!file.endsWith('.example'))||/\.(?:pem|p12|pfx|key|zip|dump)$/i.test(file)||/(?:service[-_]account|credentials)\.json$/i.test(file))failures.push(`${file}: sensitive file type`)
 const bytes=staged?git(['show',`:${file}`]):readFileSync(resolve(root,file))
 if(bytes.includes(0))continue
 const text=bytes.toString('utf8')
 for(const [name,pattern] of rules){pattern.lastIndex=0;for(const match of text.matchAll(pattern))failures.push(`${file}:${text.slice(0,match.index).split('\n').length}: ${name}`)}
 for(const match of text.matchAll(/postgres(?:ql)?:\/\/[^\s:@/]+:([^@\s]+)@[^\s'"<>]+/g)){
  let safeCi=false
  const ciDatabase={'.github/workflows/lecture-service.yml':'lecture_ci','.github/workflows/daechion.yml':'daechion_ci'}[file]
  if(ciDatabase){try{const url=new URL(match[0]);safeCi=url.username===ciDatabase&&url.password==='ci-test-only'&&url.hostname==='127.0.0.1'&&url.port==='5432'&&url.pathname==='/'+ciDatabase&&!url.search&&!url.hash}catch{}}
  if(!safeCi)failures.push(`${file}:${text.slice(0,match.index).split('\n').length}: DATABASE_PASSWORD_LITERAL`)
 }
}
if(failures.length){process.stderr.write(failures.join('\n')+'\nSecret-pattern check failed. Matched values are intentionally omitted.\n');process.exitCode=1}
else process.stdout.write(`Secret-pattern check passed for ${files.length} ${staged?'staged':'tracked lecture'} files.\n`)
