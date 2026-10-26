// Stripe webhook: gives every new Boosters subscription a 12-month schedule.
// Handles thin events (fetch the object by id) and snapshot events alike.
// Idempotent without storage: the subscription itself says whether it already
// has a schedule, and Stripe idempotency keys cover concurrent deliveries.
import { createStripe, verifyWebhook } from './stripe.js';

const HANDLED = new Set(['checkout.session.completed', 'customer.subscription.created']);

const isConfigured = (schedule, iterations) =>
  schedule.end_behavior === 'cancel' &&
  schedule.phases.length === 1 &&
  schedule.phases[0].iterations === iterations;

function relatedId(event) {
  return event.related_object?.id || event.data?.object?.id;
}

export function webhookHandler(kit) {
  return async ({ request, env }) => {
    const raw = await request.text();
    let event;
    try {
      event = await verifyWebhook(raw, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return new Response(`invalid signature: ${err.message}`, { status: 400 });
    }
    if (!HANDLED.has(event.type)) return new Response('ignored', { status: 200 });

    try {
      const result = await processEvent(kit, createStripe(env), event);
      return new Response(result, { status: 200 });
    } catch (err) {
      // Non-2xx makes Stripe retry.
      console.error('webhook failed', event.id, err.message);
      return new Response('error', { status: 500 });
    }
  };
}

export async function processEvent(kit, stripe, event) {
  const id = relatedId(event);
  if (!id) return 'no object id';

  let subId = id;
  if (event.type === 'checkout.session.completed') {
    const session = await stripe.get(`/checkout/sessions/${id}`);
    if (session.mode !== 'subscription' || !session.subscription) return 'not a subscription';
    subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
  }

  const sub = await stripe.get(`/subscriptions/${subId}`, { expand: ['items.data.price'] });
  const items = sub.items.data;
  const plan = Object.entries(kit.plans).find(([, p]) => p.product && items.some((i) => i.price.product === p.product));
  if (!plan) return 'not a scheduled product';
  // incomplete = first payment not collected yet; checkout.session.completed will follow.
  if (sub.status !== 'active' && sub.status !== 'trialing') return `status ${sub.status}`;

  const [planName, planCfg] = plan;
  const iterations = kit.boostersMonths;
  let schedule;
  if (sub.schedule) {
    schedule = await stripe.get(`/subscription_schedules/${typeof sub.schedule === 'string' ? sub.schedule : sub.schedule.id}`);
  } else {
    schedule = await stripe.post('/subscription_schedules', { from_subscription: sub.id },
      { idempotencyKey: `hustle-schedule-create-${sub.id}` });
  }

  if (!isConfigured(schedule, iterations)) {
    const phase = schedule.phases[0];
    schedule = await stripe.post(`/subscription_schedules/${schedule.id}`, {
      end_behavior: 'cancel',
      proration_behavior: 'none',
      phases: [{
        start_date: phase.start_date,
        items: phase.items.map((i) => ({ price: typeof i.price === 'string' ? i.price : i.price.id, quantity: i.quantity })),
        iterations,
      }],
    });
  } else {
    console.log(JSON.stringify({ schedule: schedule.id, subscription: sub.id, note: 'already scheduled' }));
    return 'already scheduled';
  }

  const customer = await stripe.get(`/customers/${sub.customer}`);
  console.log(JSON.stringify({
    audit: true, kit: kit.name, email: customer.email, product: planCfg.product,
    plan: planName, subscription: sub.id, schedule: schedule.id,
  }));
  return 'scheduled';
}
