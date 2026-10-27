// Decides whether an email may buy Boosters on its own: it must have paid for the Kit (kit-only,
// not refunded) and must not already hold Boosters (a Boosters or combo purchase).
import { stripe } from './stripe.js';

const paid = (s) => s.status === 'complete' && s.payment_status === 'paid';
const products = (s) => (s.line_items?.data ?? []).map((li) => li.price?.product);

// Pure: classify the buyer from their completed Checkout Sessions (line_items and the kit
// payment's latest charge expanded).
export function classifyBuyer(sessions, cfg) {
  const done = sessions.filter(paid);
  const hasBoosters = done.some((s) => products(s).some((p) => ['boosters', 'combo'].includes(cfg.products[p])));
  const hasKit = done.some(
    (s) => products(s).includes(cfg.kitProduct) && !s.payment_intent?.latest_charge?.refunded);
  return { hasKit, hasBoosters };
}

// Stripe matches customer_details.email case-sensitively, so try the email as typed and lowercased.
export async function lookupBuyer(env, cfg, rawEmail) {
  const typed = rawEmail.trim();
  const sessions = new Map();
  for (const email of new Set([typed, typed.toLowerCase()])) {
    const res = await stripe(env, 'GET', '/checkout/sessions', {
      customer_details: { email },
      limit: 100,
      expand: ['data.line_items', 'data.payment_intent.latest_charge'],
    });
    for (const s of res.data) sessions.set(s.id, s);
  }
  return classifyBuyer([...sessions.values()], cfg);
}
