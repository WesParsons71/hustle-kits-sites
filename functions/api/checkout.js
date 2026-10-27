// GET /api/checkout?plan=boosters|combo -> creates a Stripe Checkout Session and 303s to it.
// The kit alone stays on its Payment Link. Boosters-only never allows promo codes.
import { stripe, stripeMode } from '../_lib/stripe.js';
import { BBQ } from '../_lib/bbq-config.js';

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const plan = url.searchParams.get('plan');
  const cfg = BBQ[stripeMode(env)];
  const origin = env.SITE_URL || url.origin;

  if (plan !== 'boosters' && plan !== 'combo') return new Response('Unknown plan', { status: 400 });
  const needed = plan === 'boosters' ? [cfg.prices.boosters] : [cfg.prices.comboKit, cfg.prices.comboBoosters];
  if (needed.some((p) => !p)) return new Response(`Stripe ${stripeMode(env)}-mode IDs are not configured`, { status: 500 });

  const params = { mode: 'subscription' };
  if (plan === 'boosters') {
    params.line_items = [{ price: cfg.prices.boosters, quantity: 1 }];
    params.success_url = env.BOOSTERS_WELCOME_URL || `${origin}/boosters-welcome`;
    params.cancel_url = `${origin}/boosters`;
  } else {
    // Kit's one-time price rides on the first invoice with the monthly Boosters price.
    params.line_items = [
      { price: cfg.prices.comboKit, quantity: 1 },
      { price: cfg.prices.comboBoosters, quantity: 1 },
    ];
    params.success_url = `${origin}/thank-you`;
    params.cancel_url = origin;
    // Checkout can't take both a preset discount and a promo box. Until the coupon
    // expires, apply it automatically; afterwards let buyers enter codes.
    if (cfg.blackFridayCoupon && Date.now() / 1000 < cfg.couponRedeemBy) {
      params.discounts = [{ coupon: cfg.blackFridayCoupon }];
    } else {
      params.allow_promotion_codes = true;
    }
  }

  try {
    const session = await stripe(env, 'POST', '/checkout/sessions', params);
    return Response.redirect(session.url, 303);
  } catch (err) {
    console.error(err.message);
    return new Response('Checkout is unavailable right now. Please try again shortly.', { status: 502 });
  }
}
