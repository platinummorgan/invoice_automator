const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
let printedHtml, emailHtml, shared = false;
const mocks = {
  'expo-print': { printToFileAsync: async ({ html }) => { printedHtml = html; return { uri: 'file:///invoice.pdf' }; } },
  'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async () => { shared = true; } },
  'expo-mail-composer': { isAvailableAsync: async () => true, composeAsync: async ({ body }) => { emailHtml = body; return { status: 'sent' }; } },
  'expo-linking': {}, 'react-native': {},
};
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const context = { exports: {}, URL, console, require: name => name.startsWith('.')
    ? load(path.resolve(path.dirname(file), name + '.ts')) : mocks[name] };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  cache.set(file, context.exports);
  return context.exports;
}
const { preparePaymentMethods, paymentMethodUrl } = load('src/utils/paymentMethods.ts');
assert.throws(() => preparePaymentMethods([{ type: 'paypal', label: 'PayPal', value: '  ' }]), /Enter payment details/);
assert.throws(() => preparePaymentMethods([{ type: 'venmo', label: 'Venmo', value: '@recipient' }]), /full Venmo payment link/);
assert.equal(paymentMethodUrl('javascript:alert(1)'), undefined);
assert.equal(paymentMethodUrl('https://user:password@example.com'), undefined);
assert.equal(paymentMethodUrl('name@example.com'), undefined);
const methods = preparePaymentMethods([
  { type: 'paypal', label: 'PayPal', value: ' paypal.me/example ' },
  { type: 'venmo', label: 'Venmo', value: 'https://venmo.com/u/example' },
  { type: 'cash_app', label: 'Cash App', value: 'https://cash.app/$example' },
  { type: 'stripe', label: 'Stripe', value: 'https://buy.stripe.com/example' },
  { type: 'zelle', label: 'Zelle', value: 'billing@example.com' },
  { type: 'bank_transfer', label: 'Bank Transfer', value: 'Reference invoice number' },
]);
const params = {
  invoice: { invoice_number: 'INV-TEST', created_at: '2026-09-20', due_date: '2026-10-20', subtotal: 100, tax_amount: 0, total: 100 },
  items: [{ description: 'Service', quantity: 1, unit_price: 100, amount: 100 }],
  customer: { name: 'Test Customer', email: 'customer@example.com' },
  paymentMethods: methods, paymentInstructions: 'Include invoice number <INV-TEST>',
};
function check(html) {
  for (const method of methods.slice(0, 4)) {
    assert.ok(html.includes(`href="${method.value}"`), method.label + ' link missing');
    assert.ok(html.includes(`Pay with ${method.label}`));
    assert.ok(html.includes(`>${method.value}</span>`), 'Printable URL missing');
  }
  assert.ok(html.includes('billing@example.com'));
  assert.ok(html.includes('Reference invoice number'));
  assert.ok(html.includes('&lt;INV-TEST&gt;'));
  assert.ok(!html.includes('Please contact us for payment instructions.'));
}
(async () => {
  const email = load('src/services/email.ts');
  await email.sendInvoiceEmail(params);
  check(emailHtml);
  await load('src/services/invoicePdf.ts').shareInvoicePdf(params);
  check(printedHtml);
  assert.ok(shared);
  const fallback = email.generateInvoiceEmailHTML({ ...params, paymentMethods: [], paymentInstructions: '' });
  assert.ok(fallback.includes('Please contact us for payment instructions.'));
  const unsafe = email.generateInvoiceEmailHTML({ ...params, paymentMethods: [{ type: 'other', label: 'Other', value: 'javascript:alert(1)' }] });
  assert.ok(!unsafe.includes('href="javascript:'));
  console.log('Payment settings validation and payment links in email/PDF export passed.');
})().catch(error => { console.error(error); process.exit(1); });
