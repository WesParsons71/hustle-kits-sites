// Run: node tests/email.test.mjs  (no Stripe or Resend needed)
import assert from 'node:assert/strict';
import { isKitPurchase, kitEmail, sendEmail, firstName } from '../functions/_lib/email.js';
import { BBQ, EMAIL } from '../functions/_lib/bbq-config.js';

for (const mode of ['test', 'live']) {
  const cfg = BBQ[mode];
  const combo = Object.entries(cfg.products).find(([, v]) => v === 'combo')[0];
  const boosters = Object.entries(cfg.products).find(([, v]) => v === 'boosters')[0];
  const s = (product, over = {}) => ({ payment_status: 'paid', line_items: { data: [{ price: { product } }] }, ...over });
  assert.equal(isKitPurchase(s(cfg.kitProduct), cfg), true, `${mode}: kit`);
  assert.equal(isKitPurchase(s(combo), cfg), true, `${mode}: combo includes the Kit`);
  assert.equal(isKitPurchase(s(boosters), cfg), false, `${mode}: Boosters alone gets no Kit email`);
  assert.equal(isKitPurchase(s(cfg.kitProduct, { payment_status: 'unpaid' }), cfg), false, `${mode}: unpaid`);
  assert.equal(isKitPurchase(s(cfg.kitProduct, { payment_status: 'no_payment_required' }), cfg), true, `${mode}: fully discounted`);
  assert.equal(isKitPurchase(s('prod_other'), cfg), false, `${mode}: other product`);
}

assert.equal(firstName('  Wes   Parsons '), 'Wes');
assert.equal(firstName(''), null);
assert.equal(firstName(null), null);

const m = kitEmail({ name: 'Sam <b>Hack</b>', deliveryUrl: 'https://example.com/kit?a=1&b=2' });
assert.match(m.subject, /ready/);
assert.ok(m.text.includes('https://example.com/kit?a=1&b=2'), 'text has the link');
assert.ok(m.html.includes('https://example.com/kit?a=1&amp;b=2'), 'html link is escaped');
assert.ok(m.html.includes(EMAIL.dfyFormUrl.replace(/&/g, '&amp;')) && m.text.includes(EMAIL.dfyFormUrl), 'form link in both');
assert.ok(!m.html.includes('<b>Hack'), 'name is escaped');
assert.ok(m.text.startsWith('Hi Sam,'), 'first name only');
assert.ok(kitEmail({ name: null, deliveryUrl: 'u' }).text.startsWith('Hi there,'));

let call;
const fakeFetch = async (url, opts) => { call = { url, opts }; return { ok: true, json: async () => ({ id: 'em_1' }) }; };
const out = await sendEmail({ RESEND_API_KEY: 're_x' }, { to: 'a@b.com', subject: 'S', html: '<p>h</p>', text: 't', idempotencyKey: 'k1' }, fakeFetch);
assert.equal(out.id, 'em_1');
assert.equal(call.url, 'https://api.resend.com/emails');
assert.equal(call.opts.headers.Authorization, 'Bearer re_x');
assert.equal(call.opts.headers['Idempotency-Key'], 'k1');
const body = JSON.parse(call.opts.body);
assert.deepEqual(body.to, ['a@b.com']);
assert.equal(body.from, EMAIL.from);
assert.equal(body.reply_to, EMAIL.replyTo);

await assert.rejects(() => sendEmail({}, { to: 'a@b.com', subject: 'S', html: '', text: '' }, fakeFetch), /RESEND_API_KEY/);
await assert.rejects(() => sendEmail({ RESEND_API_KEY: 'x' }, { to: 'a@b.com', subject: 'S', html: '', text: '' },
  async () => ({ ok: false, status: 422, json: async () => ({ message: 'domain not verified' }) })), /domain not verified/);
console.log('ok');
