// Local checks for the pieces that don't need Stripe. Run: node tests/stripe.test.mjs
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { encodeForm, verifySignature } from '../functions/_lib/stripe.js';

const sign = (body, secret, t) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
const now = 1_800_000_000_000;
const t = now / 1000;

assert.equal(await verifySignature('{}', sign('{}', 'whsec_a', t), 'whsec_a', 300, now), true);
assert.equal(await verifySignature('{}', sign('{}', 'whsec_a', t), 'whsec_b', 300, now), false, 'wrong secret');
assert.equal(await verifySignature('{"x":1}', sign('{}', 'whsec_a', t), 'whsec_a', 300, now), false, 'tampered body');
assert.equal(await verifySignature('{}', sign('{}', 'whsec_a', t - 600), 'whsec_a', 300, now), false, 'stale');
assert.equal(await verifySignature('{}', null, 'whsec_a', 300, now), false, 'missing header');

assert.equal(
  encodeForm({ mode: 'subscription', line_items: [{ price: 'p', quantity: 1 }], expand: ['customer'] }).join('&'),
  'mode=subscription&line_items%5B0%5D%5Bprice%5D=p&line_items%5B0%5D%5Bquantity%5D=1&expand%5B0%5D=customer');
console.log('ok');
