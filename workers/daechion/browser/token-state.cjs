// Used only for a read-only acceptance check of the site's normal refresh flow.
// The refresh cookie is never modified. An invalid, expired access token is put
// in an isolated browser copy; the persistent session changes only after login
// is confirmed again by the real administrator page.
const {storageState}=require('./provider.cjs')
function accessTokens(state){
  const found=[]
  for(const origin of state.origins)for(const item of origin.localStorage??[]){
    for(const token of String(item.value).match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)??[]){
      try{const payload=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));if(Number.isFinite(payload.exp))found.push({token,payload})}catch{}
    }
  }
  return found.sort((a,b)=>a.payload.exp-b.payload.exp)
}
function accessExpiry(value){return accessTokens(storageState(value))[0]?.payload.exp??null}
function expiredAccessCopy(value){
  const state=storageState(value),current=accessTokens(state)[0]
  if(!current)throw Error('CONTENT_SESSION_REFRESH_TEST_UNAVAILABLE')
  const [header,,signature]=current.token.split('.')
  const expired=header+'.'+Buffer.from(JSON.stringify({...current.payload,exp:1})).toString('base64url')+'.'+signature
  for(const origin of state.origins)for(const item of origin.localStorage??[])item.value=String(item.value).replaceAll(current.token,expired)
  return JSON.stringify(state)
}
module.exports={accessExpiry,expiredAccessCopy}
