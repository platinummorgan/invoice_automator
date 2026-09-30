const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
let profile = {subscription_tier:'monthly_basic',subscription_status:'cancelled',subscription_verified_at:'2026-01-01',subscription_ends_at:'2099-01-01'};
let profileError = null, countError = null, invoiceCount = 1;
let verify = async () => ({data:{verified:true,isPro:false}});
const supabase = {functions:{invoke:async (...args)=>verify(...args)},auth:{getUser:async()=>({data:{user:{id:'test'}}})},from:table=>{
 const query={select:()=>query,eq:()=>query,gte:async()=>({count:invoiceCount,error:countError}),single:async()=>({data:profile,error:profileError})};return query;
}};
const loadService = (platform, iap) => {
 const context={exports:{},console:{error:()=>{},warn:()=>{},log:()=>{}},require:name=>{
  if(name==='react-native-iap') { if(!iap) throw new Error('No native module'); return iap; }
  return name==='./supabase'?{supabase}:name==='react-native'?{Platform:{OS:platform}}:{};
 }};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/subscription.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
 return context.exports.subscriptionService;
};
const service=loadService('android');
(async()=>{
 assert.equal((await service.getSubscriptionStatus()).isPro,true);
 const iosStatus=await loadService('ios').getSubscriptionStatus();
 assert.equal(iosStatus.isPro,true,'A verified Pro entitlement is available on iPhone once Apple IAP is offered');
 assert.equal(iosStatus.tier,'monthly_basic');
 assert.equal(iosStatus.status,'cancelled');
 assert.equal(iosStatus.invoiceLimit,2);
 assert.equal(iosStatus.expiresAt,'2099-01-01');
 profile.subscription_ends_at='2000-01-01';
 invoiceCount=2;
 const iosLimit=await loadService('ios').canCreateInvoice();
 assert.equal(iosLimit.allowed,false);
 assert.match(iosLimit.reason,/Upgrade to Pro/);
 invoiceCount=1;
 assert.equal((await service.getSubscriptionStatus()).isPro,false);
 profileError=new Error('Offline');await assert.rejects(service.getSubscriptionStatus(),/Offline/);
 profileError=null;countError=new Error('Count unavailable');await assert.rejects(service.getSubscriptionStatus(),/Count unavailable/);
 countError=null;
 let purchaseErrorListener;
 const iap={initConnection:async()=>{},
 purchaseUpdatedListener:()=>({remove:()=>{}}),
 purchaseErrorListener:callback=>{purchaseErrorListener=callback;return {remove:()=>{}};},
 getAvailablePurchases:async()=>[
  {productId:'swift_invoice_pro_monthly',purchaseToken:'old'},
  {productId:'swift_invoice_pro_monthly',purchaseToken:'renewed'}
 ]};
 const native=loadService('android',iap);
 let verified=0;
 verify=async (_, {body})=>{
  verified++;
  if(body.purchaseToken==='old') return {error:new Error('Old token')};
  profile.subscription_ends_at='2099-01-01';
  return {data:{verified:true,isPro:true}};
 };
 assert.equal((await native.getSubscriptionStatus()).isPro,true,'Refresh an elapsed stored expiry from Google before reporting Free');
 assert.equal(verified,2,'An old failed token must not hide the active purchase');
 profile.subscription_ends_at='2000-01-01';invoiceCount=2;
 assert.equal((await native.canCreateInvoice()).allowed,true,'A renewal must bypass the free invoice limit');
 await native.upgradeToPro(); // No checkout methods exist on the mock: an owned plan must restore instead.
 verified=0;
 await Promise.all([native.syncSubscriptionStatus(),native.syncSubscriptionStatus()]);
 assert.equal(verified,2,'Concurrent refreshes must share one verification pass');
 await native.initialize();
 profile.subscription_ends_at='2000-01-01';
 let billingError='not notified';
 const unsubscribe=native.onBillingChange(error=>{billingError=error;});
 await purchaseErrorListener({code:'already-owned'});
 assert.equal(billingError,undefined,'Already-owned events should restore access without a purchase error');
 assert.equal((await native.getSubscriptionStatus()).isPro,true);
 unsubscribe();
 profile.subscription_ends_at='2000-01-01';
 verify=async()=>({error:new Error('Offline')});
 await assert.rejects(native.getSubscriptionStatus(),/could not be verified/,'A failed refresh must not report Free');
 verify=async()=>({data:{verified:true,isPro:false}});
 assert.equal((await native.getSubscriptionStatus()).isPro,false,'A confirmed expired purchase must remain Free');
 const iosIap={initConnection:async()=>{},purchaseUpdatedListener:()=>({remove:()=>{}}),purchaseErrorListener:()=>({remove:()=>{}}),getAvailablePurchases:async()=>[{productId:'swift_invoice_pro_monthly',purchaseToken:'apple-jws'}]};
 const iosNative=loadService('ios',iosIap);
 verify=async (name,{body})=>{assert.equal(name,'verify-apple-purchase');assert.equal(body.signedTransaction,'apple-jws');profile.subscription_ends_at='2099-01-01';return {data:{verified:true,isPro:true}};};
 assert.equal(await iosNative.restorePurchases(),true,'Apple restore must verify StoreKit JWS on the server');
 console.log('Renewals, concurrent refresh, restore-before-checkout, already-owned recovery, iOS restore and expiry pass; verification failures do not falsely report Free.');
})().catch(e=>{console.error(e);process.exit(1)});
