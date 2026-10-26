// Monthly audit: lists Boosters/combo subscriptions with schedule status, as CSV.
// Usage: STRIPE_SECRET_KEY=sk_... node scripts/audit.mjs > audit.csv
// Match the emails against kit purchases. Output contains customer data: do not commit it.
import kit from '../bbq-hustle/kit-config.js';
import { createStripe } from '../shared/checkout/stripe.js';

const stripe = createStripe(process.env);
const products = Object.fromEntries(Object.entries(kit.plans).map(([n, p]) => [p.product, n]));
console.log('email,plan,product,status,subscription,schedule');
let after;
do {
  const page = await stripe.get('/subscriptions', {
    status: 'all', limit: 100, starting_after: after,
    expand: ['data.customer', 'data.items.data.price'],
  });
  for (const s of page.data) {
    const item = s.items.data.find((i) => products[i.price.product]);
    if (!item) continue;
    console.log([s.customer.email, products[item.price.product], item.price.product, s.status, s.id, s.schedule || 'NONE'].join(','));
  }
  after = page.has_more ? page.data.at(-1).id : null;
} while (after);
