import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import kit from '../../bbq-hustle/kit-config.js';
import { buildSessionParams } from '../checkout/checkout.js';
import { processEvent, webhookHandler } from '../checkout/webhook.js';
import { encodeForm, verifyWebhook } from '../checkout/stripe.js';

globalThis.crypto ??= webcrypto;
const env = { BOOSTERS_SUCCESS_URL: '/welcome', BLACK_FRIDAY_PROMO_ID: 'promo_x' };
const before = Date.parse('2026-11-27T12:00:00Z');
const after = Date.parse('2026-12-02T12:00:00Z');

test('boosters: subscription, one price, never any promo option', () => {
  const p = buildSessionParams(kit, 'boosters', env, before);
  assert.equal(p.mode, 'subscription');
  assert.deepEqual(p.line_items, [{ price: 'price_1UIFSRHul7zqmXuKFEjzOHkG', quantity: 1 }]);
  assert.equal(p.allow_promotion_codes, undefined);
  assert.equal(p.discounts, undefined);
  assert.equal(p.success_url, 'https://thebbqhustle.com/welcome');
});

test('boosters: refuses to build without a success URL', () => {
  assert.throws(() => buildSessionParams(kit, 'boosters', {}, before), /BOOSTERS_SUCCESS_URL/);
});

test('combo: kit + boosters prices, BF code auto-applied only before redeem-by', () => {
  const b = buildSessionParams(kit, 'combo', env, before);
  assert.equal(b.line_items.length, 2);
  assert.deepEqual(b.discounts, [{ promotion_code: 'promo_x' }]);
  assert.equal(b.allow_promotion_codes, undefined);
  const a = buildSessionParams(kit, 'combo', env, after);
  assert.equal(a.discounts, undefined);
  assert.equal(a.allow_promotion_codes, true);
});

test('encodeForm uses bracket notation', () => {
  assert.equal(decodeURIComponent(encodeForm({ a: [{ b: 1 }], c: 'x' }).join('&')), 'a[0][b]=1&c=x');
});

async function sign(body, secret, t = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`))).toString('hex');
  return `t=${t},v1=${sig}`;
}

test('webhook signature: good, tampered, stale', async () => {
  const body = '{"id":"evt_1"}';
  await verifyWebhook(body, await sign(body, 'whsec_a'), 'whsec_a');
  await assert.rejects(verifyWebhook(body + ' ', await sign(body, 'whsec_a'), 'whsec_a'));
  await assert.rejects(verifyWebhook(body, await sign(body, 'whsec_a', 1000), 'whsec_a'));
});

// Fake Stripe holding one subscription; counts schedule creations.
function fakeStripe({ product = 'prod_VIrAiHc6lQaAEX', status = 'active' } = {}) {
  const state = { sub: { id: 'sub_1', status, customer: 'cus_1', schedule: null,
    items: { data: [{ price: { id: 'price_b', product } }] } }, schedules: {}, creates: 0 };
  return {
    state,
    async get(path) {
      if (path.startsWith('/checkout/sessions/')) return { mode: 'subscription', subscription: 'sub_1' };
      if (path === '/subscriptions/sub_1') return state.sub;
      if (path === '/customers/cus_1') return { email: 'a@b.com' };
      return state.schedules[path.split('/').pop()];
    },
    async post(path, params) {
      if (path === '/subscription_schedules') {
        state.creates++;
        state.sub.schedule = 'sub_sched_1';
        return (state.schedules.sub_sched_1 = { id: 'sub_sched_1', end_behavior: 'release',
          phases: [{ start_date: 1, items: [{ price: 'price_b', quantity: 1 }] }] });
      }
      const s = state.schedules.sub_sched_1;
      s.end_behavior = params.end_behavior;
      s.phases = [{ ...params.phases[0] }];
      return s;
    },
  };
}

test('webhook: both events for one subscription create exactly one 12-month schedule', async () => {
  const stripe = fakeStripe();
  const thin = { type: 'checkout.session.completed', related_object: { id: 'cs_1' } };
  const snap = { type: 'customer.subscription.created', data: { object: { id: 'sub_1' } } };
  assert.equal(await processEvent(kit, stripe, thin), 'scheduled');
  assert.equal(await processEvent(kit, stripe, snap), 'already scheduled');
  assert.equal(await processEvent(kit, stripe, thin), 'already scheduled'); // replay
  assert.equal(stripe.state.creates, 1);
  const s = stripe.state.schedules.sub_sched_1;
  assert.equal(s.end_behavior, 'cancel');
  assert.equal(s.phases[0].iterations, 12);
});

test('webhook: ignores other products and unpaid subscriptions', async () => {
  const ev = { type: 'customer.subscription.created', data: { object: { id: 'sub_1' } } };
  const other = fakeStripe({ product: 'prod_other' });
  assert.equal(await processEvent(kit, other, ev), 'not a scheduled product');
  assert.equal(other.state.creates, 0);
  const unpaid = fakeStripe({ status: 'incomplete' });
  assert.equal(await processEvent(kit, unpaid, ev), 'status incomplete');
  assert.equal(unpaid.state.creates, 0);
});

test('webhook handler rejects bad signature with 400', async () => {
  const res = await webhookHandler(kit)({
    request: new Request('https://x/api/webhook', { method: 'POST', body: '{}', headers: { 'stripe-signature': 't=1,v1=aa' } }),
    env: { STRIPE_WEBHOOK_SECRET: 'whsec_a' },
  });
  assert.equal(res.status, 400);
});
