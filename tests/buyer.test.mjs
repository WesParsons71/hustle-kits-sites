// Run: node tests/buyer.test.mjs  (no Stripe needed)
import assert from 'node:assert/strict';
import { classifyBuyer } from '../functions/_lib/buyer.js';
import { BBQ } from '../functions/_lib/bbq-config.js';

for (const mode of ['test', 'live']) {
  const cfg = BBQ[mode];
  const [boostersProd, comboProd] = Object.keys(cfg.products);
  const session = (product, over = {}) => ({
    status: 'complete', payment_status: 'paid',
    line_items: { data: [{ price: { product } }] }, payment_intent: { latest_charge: { refunded: false } }, ...over,
  });

  assert.deepEqual(classifyBuyer([], cfg), { hasKit: false, hasBoosters: false }, `${mode}: unknown email`);
  assert.deepEqual(classifyBuyer([session(cfg.kitProduct)], cfg), { hasKit: true, hasBoosters: false }, `${mode}: kit buyer may continue`);
  assert.equal(classifyBuyer([session(comboProd)], cfg).hasBoosters, true, `${mode}: combo buyer already has Boosters`);
  assert.equal(classifyBuyer([session(comboProd)], cfg).hasKit, false, `${mode}: combo is not a kit-only purchase`);
  assert.equal(classifyBuyer([session(cfg.kitProduct), session(boostersProd)], cfg).hasBoosters, true, `${mode}: kit + boosters`);
  assert.equal(classifyBuyer([session(cfg.kitProduct, { payment_intent: { latest_charge: { refunded: true } } })], cfg).hasKit, false, `${mode}: refunded kit`);
  assert.equal(classifyBuyer([session(cfg.kitProduct, { payment_status: 'unpaid' })], cfg).hasKit, false, `${mode}: unpaid kit`);
  assert.equal(classifyBuyer([session(cfg.kitProduct, { status: 'open' })], cfg).hasKit, false, `${mode}: abandoned checkout`);
  assert.equal(classifyBuyer([session('prod_other')], cfg).hasKit, false, `${mode}: some other product`);
}
console.log('ok');
