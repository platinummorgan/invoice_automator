const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
let profile = {subscription_tier:'monthly_basic',subscription_status:'cancelled',subscription_verified_at:'2026-01-01',subscription_ends_at:'2099-01-01'};
let profileError = null, countError = null, invoiceCount = 1;
const supabase = {auth:{getUser:async()=>({data:{user:{id:'test'}}})},from:table=>{
 const query={select:()=>query,eq:()=>query,gte:async()=>({count:invoiceCount,error:countError}),single:async()=>({data:profile,error:profileError})};return query;
}};
const loadService = platform => {
 const context={exports:{},console:{error:()=>{}},require:name=>name==='./supabase'?{supabase}:name==='react-native'?{Platform:{OS:platform}}:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/subscription.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
 return context.exports.subscriptionService;
};
const service=loadService('android');
(async()=>{
 assert.equal((await service.getSubscriptionStatus()).isPro,true);
 const iosStatus=await loadService('ios').getSubscriptionStatus();
 assert.equal(iosStatus.isPro,false);
 assert.equal(iosStatus.tier,'free');
 assert.equal(iosStatus.status,'free');
 assert.equal(iosStatus.invoiceLimit,2);
 assert.equal(iosStatus.expiresAt,null);
 invoiceCount=2;
 const iosLimit=await loadService('ios').canCreateInvoice();
 assert.equal(iosLimit.allowed,false);
 assert.match(iosLimit.reason,/monthly allowance resets/);
 invoiceCount=1;
 profile.subscription_ends_at='2000-01-01';assert.equal((await service.getSubscriptionStatus()).isPro,false);
 profileError=new Error('Offline');await assert.rejects(service.getSubscriptionStatus(),/Offline/);
 profileError=null;countError=new Error('Count unavailable');await assert.rejects(service.getSubscriptionStatus(),/Count unavailable/);
 console.log('Canceled access expires correctly; iOS stays Free; connection failures do not falsely report Free.');
})().catch(e=>{console.error(e);process.exit(1)});
