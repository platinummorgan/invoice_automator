const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const context={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('supabase/functions/verify-apple-purchase/entitlement.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
const {entitlementFromApple:check}=context.exports;
const now=Date.parse('2026-09-30T12:00:00Z');
const base={
 appAccountToken:'9b42133d-e6da-4519-b0f9-a32f8313efb5',bundleId:'com.invoiceautomator.app',
 environment:'Sandbox',expiresDate:Date.parse('2026-10-30T12:00:00Z'),inAppOwnershipType:'PURCHASED',
 originalTransactionId:'2000001234567890',productId:'swift_invoice_pro_monthly',transactionId:'2000001234567891',
 signedDate:now-1000,type:'Auto-Renewable Subscription'
};
assert.equal(check(base,now).active,true);
assert.equal(check(base,now).tier,'monthly_basic');
assert.equal(check({...base,productId:'swift_invoice_pro_annual'},now).tier,'annual_basic');
assert.equal(check({...base,expiresDate:now},now).state,'expired');
assert.equal(check({...base,revocationDate:now-1},now).state,'revoked');
assert.equal(check({...base,isUpgraded:true},now).state,'upgraded');
for(const bad of [
 {...base,bundleId:'com.attacker.app'}, {...base,productId:'unknown'}, {...base,type:'Consumable'},
 {...base,appAccountToken:'not-a-uuid'}, {...base,environment:'Xcode'}, {...base,transactionId:'invalid'},
 {...base,signedDate:now+10*60*1000}
]) assert.throws(()=>check(bad,now));
console.log('Apple entitlement validates app, product, account binding, environment, expiry, revocation and upgrades.');
