const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
let printedHtml, emailHtml, attachments, shared = false;
const mocks = {
  'expo-print': { printToFileAsync: async ({ html }) => { printedHtml = html; return { uri: 'file:///invoice.pdf' }; } },
  'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async () => { shared = true; } },
  'expo-mail-composer': { isAvailableAsync: async () => true, composeAsync: async ({ body, attachments: files }) => { emailHtml = body; attachments = files; return { status: 'sent' }; } },
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
  assert.equal(attachments[0], 'file:///invoice.pdf');
  const quote = { ...params, invoice: { ...params.invoice, document_type: 'quote', status: 'sent', invoice_number: 'QUO-TEST', photos: [
    { stage: 'before', path: 'before.jpg', url: 'https://example.test/before.jpg' },
    { stage: 'finished', path: 'unsafe', url: 'javascript:alert(1)' },
  ] } };
  for (const header_layout of ['inline', 'stacked']) {
    const html = email.generateInvoiceEmailHTML({ ...quote, templateSettings: { header_layout } });
    assert.ok(html.includes('Quote #QUO-TEST'));
    assert.ok(html.includes('Quoted Total'));
    assert.ok(html.includes('Valid Until'));
    assert.ok(!html.includes('Pay with'));
    assert.ok(!html.includes('Payment Instructions:'));
    assert.ok(!html.includes('Total Due'));
    assert.ok(html.includes('before.jpg'));
    assert.ok(!html.includes('javascript:'));
  }
  await email.sendInvoiceEmail(quote);
  assert.ok(printedHtml.includes('Quote #QUO-TEST'));
  const paid = { ...params, invoice: { ...params.invoice, status: 'paid', paid_at: '2026-09-21', photos: [
    { stage: 'finished', path: 'after.jpg', url: 'https://example.test/after.jpg' },
  ] } };
  await load('src/services/invoicePdf.ts').shareInvoicePdf(paid, true);
  assert.ok(printedHtml.includes('Payment Receipt'));
  assert.ok(printedHtml.includes('Total Paid'));
  assert.ok(printedHtml.includes('Finished pictures'));
  assert.ok(printedHtml.includes('after.jpg'));
  assert.ok(!printedHtml.includes('Pay with'));
  await assert.rejects(() => load('src/services/invoicePdf.ts').shareInvoicePdf(quote, true), /paid invoice/);
  const receiptResult = await email.sendReceiptEmail(paid);
  assert.equal(receiptResult.success, true);
  assert.ok(emailHtml.includes('Total Paid'));
  assert.equal(attachments[0], 'file:///invoice.pdf');
  console.log('Quote labeling, payment suppression, receipt eligibility, photos and PDF attachments passed.');
  console.log('Payment settings validation and payment links in email/PDF export passed.');
})().catch(error => { console.error(error); process.exit(1); });
