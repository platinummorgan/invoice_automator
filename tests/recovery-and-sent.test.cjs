const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
function load(path,requireMock){const ctx={exports:{},URL,URLSearchParams,require:requireMock};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,ctx);return ctx.exports;}
const {parseRecoveryLink,RECOVERY_REDIRECT}=load('src/utils/recoveryLink.ts');
assert.equal(parseRecoveryLink('https://example.com/#type=recovery&access_token=a&refresh_token=b'),null);
assert.equal(parseRecoveryLink('not a url'),null);
assert.equal(parseRecoveryLink('com.invoiceautomator.app://other/callback/recovery'),null);
assert.ok(parseRecoveryLink(RECOVERY_REDIRECT+'#type=signup&access_token=a&refresh_token=b').error);
assert.ok(parseRecoveryLink(RECOVERY_REDIRECT+'#error=access_denied').error);
assert.ok(parseRecoveryLink(RECOVERY_REDIRECT+'#type=recovery&access_token=a').error);
assert.equal(parseRecoveryLink(RECOVERY_REDIRECT+'#type=recovery&access_token=a&refresh_token=b').refreshToken,'b');
let state='draft',writes=0,sentAt;const conditions=[];
const db={from:()=>({update:payload=>{conditions.length=0;const query={eq:(key,value)=>{conditions.push([key,value]);return query},select:()=>query,maybeSingle:async()=>{assert.deepEqual(conditions,[['id','invoice-1'],['status','draft']]);if(state==='draft'){writes++;state=payload.status;sentAt=payload.sent_at;return {data:{id:'invoice-1'},error:null}}return {data:null,error:null}}};return query}})};
const {invoiceService}=load('src/services/invoice.ts',name=>name==='./supabase'?{supabase:db}:{});invoiceService.getInvoice=async()=>({status:state});
(async()=>{await invoiceService.markInvoiceSent('invoice-1');assert.equal(state,'sent');assert.ok(sentAt);await invoiceService.markInvoiceSent('invoice-1');assert.equal(writes,1);for(const status of ['paid','void','cancelled']){state=status;await assert.rejects(invoiceService.markInvoiceSent('invoice-1'),/no longer a draft/);assert.equal(state,status);}assert.equal(writes,1);console.log('Recovery URL validation and conditional/idempotent sent transition passed.');})().catch(e=>{console.error(e);process.exit(1)});
