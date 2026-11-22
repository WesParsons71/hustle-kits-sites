// POST /api/stripe-webhook
// On a new Boosters/combo subscription, wrap it in a Subscription Schedule that ends after
// 12 monthly payments. Events are only a pointer: the full object is always fetched from the API,
// so thin and snapshot payloads both work. Safe to replay: all writes are idempotent.
import { stripe, secrets, stripeMode, verifySignature } from '../_lib/stripe.js';
import { BBQ, SCHEDULE_MONTHS } from '../_lib/bbq-config.js';
import { isKitPurchase, kitEmail, sendEmail } from '../_lib/email.js';

export async function onRequestPost({ request, env }) {
  const body = await request.text();
  const { webhookSecret } = secrets(env);
  if (!(await verifySignature(body, request.headers.get('stripe-signature'), webhookSecret))) {
    return new Response('Bad signature', { status: 400 });
  }

  const event = JSON.parse(body);
  const objectId = event.related_object?.id ?? event.data?.object?.id; // thin vs snapshot
  try {
    let subscriptionId = null;
    let session = null;
    if (event.type === 'checkout.session.completed') {
      session = await stripe(env, 'GET', `/checkout/sessions/${objectId}`, { expand: ['line_items'] });
      if (session.mode === 'subscription') subscriptionId = session.subscription;
    } else if (event.type === 'customer.subscription.created') {
      subscriptionId = objectId;
    }
    if (subscriptionId) await ensureSchedule(env, subscriptionId);
    // Email last: a failure above retries the whole event, and the Resend idempotency key stops a double send.
    if (session) await sendKitEmail(env, session);
  } catch (err) {
    console.error(`webhook ${event.id}: ${err.message}`);
    return new Response('Retry', { status: 500 }); // Stripe retries
  }
  return new Response('ok');
}

async function ensureSchedule(env, subscriptionId) {
  const cfg = BBQ[stripeMode(env)];
  const sub = await stripe(env, 'GET', `/subscriptions/${subscriptionId}`, { expand: ['customer'] });
  const item = sub.items.data[0];
  const plan = cfg.products[item?.price?.product];
  if (!plan || sub.status === 'canceled') return;

  // Reuse an existing schedule (webhook replay, or the other event got here first).
  let schedule = sub.schedule
    ? await stripe(env, 'GET', `/subscription_schedules/${sub.schedule}`)
    : await stripe(env, 'POST', '/subscription_schedules', { from_subscription: subscriptionId },
        { idempotencyKey: `hk-sched-create-${subscriptionId}` });

  if (schedule.end_behavior !== 'cancel') {
    schedule = await stripe(env, 'POST', `/subscription_schedules/${schedule.id}`, {
      end_behavior: 'cancel',
      proration_behavior: 'none',
      phases: [{
        start_date: schedule.phases[0].start_date,
        items: [{ price: item.price.id, quantity: 1 }],
        duration: { interval: 'month', interval_count: SCHEDULE_MONTHS },
      }],
    }, { idempotencyKey: `hk-sched-set-${schedule.id}` });
  }

  const row = {
    at: new Date().toISOString(),
    email: sub.customer?.email ?? null,
    product: item.price.product,
    plan,
    subscription: sub.id,
    schedule: schedule.id,
    ends: schedule.phases[0].end_date,
  };
  console.log(JSON.stringify({ audit: row }));
  // Optional durable log: bind a KV namespace named AUDIT to the Pages project.
  if (env.AUDIT) await env.AUDIT.put(`sched:${sub.id}`, JSON.stringify(row));
}

async function sendKitEmail(env, session) {
  if (!isKitPurchase(session, BBQ[stripeMode(env)])) return;
  const to = session.customer_details?.email;
  if (!to) { console.error(`kit email: session ${session.id} has no email`); return; }
  if (!env.KIT_DELIVERY_URL) throw new Error('Missing KIT_DELIVERY_URL');
  const msg = kitEmail({ name: session.customer_details?.name, deliveryUrl: env.KIT_DELIVERY_URL });
  const sent = await sendEmail(env, { to, ...msg, idempotencyKey: `hk-kit-email-${session.id}` });
  console.log(JSON.stringify({ audit: { at: new Date().toISOString(), kitEmail: sent.id, session: session.id } }));
}
