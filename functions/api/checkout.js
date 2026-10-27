// GET /api/checkout?plan=combo and POST /api/checkout (plan=boosters, email=...) create a Stripe
// Checkout Session and 303 to it. The kit alone stays on its Payment Link. Boosters-only never
// allows promo codes, and is only sold to an email that already bought the Kit (see _lib/buyer.js).
import { stripe, stripeMode } from '../_lib/stripe.js';
import { BBQ } from '../_lib/bbq-config.js';
import { lookupBuyer } from '../_lib/buyer.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const cfg = BBQ[stripeMode(env)];
  const origin = env.SITE_URL || url.origin;
  const form = request.method === 'POST' ? await request.formData() : null;
  const plan = form ? form.get('plan') : url.searchParams.get('plan');

  if (plan !== 'boosters' && plan !== 'combo') return new Response('Unknown plan', { status: 400 });
  const needed = plan === 'boosters' ? [cfg.prices.boosters] : [cfg.prices.comboKit, cfg.prices.comboBoosters];
  if (needed.some((p) => !p)) return new Response(`Stripe ${stripeMode(env)}-mode IDs are not configured`, { status: 500 });

  const params = { mode: 'subscription' };
  if (plan === 'boosters') {
    // The email goes in a POST body, never the URL. A bare GET lands on the page with the form.
    if (!form) return Response.redirect(`${origin}/boosters`, 303);
    const email = String(form.get('email') ?? '').trim();
    if (!EMAIL.test(email)) return Response.redirect(`${origin}/boosters?error=email`, 303);
    try {
      const buyer = await lookupBuyer(env, cfg, email);
      if (buyer.hasBoosters) return Response.redirect(`${origin}/boosters-already`, 303);
      if (!buyer.hasKit) return Response.redirect(`${origin}/boosters-need-kit`, 303);
    } catch (err) {
      console.error(err.message);
      return new Response('Checkout is unavailable right now. Please try again shortly.', { status: 502 });
    }
    params.customer_email = email;
    params.line_items = [{ price: cfg.prices.boosters, quantity: 1 }];
    params.success_url = env.BOOSTERS_WELCOME_URL || `${origin}/boosters-welcome`;
    params.cancel_url = `${origin}/boosters`;
  } else {
    // Kit's one-time price rides on the first invoice with the monthly Boosters price.
    params.line_items = [
      { price: cfg.prices.comboKit, quantity: 1 },
      { price: cfg.prices.comboBoosters, quantity: 1 },
    ];
    params.success_url = `${origin}/combo-thank-you`;
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
