// Checkout Session endpoint shared by all Hustle kits.
// Kit config shape: see bbq-hustle/kit-config.js.
import { createStripe } from './stripe.js';

function isBlackFridayLive(kit, env, now) {
  return Boolean(env.BLACK_FRIDAY_PROMO_ID) && now / 1000 <= kit.blackFridayRedeemBy;
}

export function buildSessionParams(kit, plan, env, now = Date.now()) {
  const p = kit.plans[plan];
  if (!p) throw new Error(`unknown plan: ${plan}`);
  const origin = new URL(env.SITE_URL || kit.siteUrl).origin;
  const successUrl = env[p.successUrlEnv] || p.successUrl;
  if (!successUrl) throw new Error(`${p.successUrlEnv} is not set`);

  const params = {
    mode: 'subscription',
    line_items: p.prices.map((price) => ({ price: env[price.env] || price.id, quantity: 1 })),
    success_url: new URL(successUrl, origin).href,
    cancel_url: new URL(p.cancelPath, origin).href,
  };
  if (p.discounts) {
    // Combo: auto-apply the Black Friday code while it is live, otherwise
    // let buyers type a code. Boosters-only never gets either.
    if (isBlackFridayLive(kit, env, now)) {
      params.discounts = [{ promotion_code: env.BLACK_FRIDAY_PROMO_ID }];
    } else {
      params.allow_promotion_codes = true;
    }
  }
  return params;
}

export function checkoutHandler(kit, plan) {
  return async ({ request, env }) => {
    if (request.method !== 'GET' && request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    try {
      const session = await createStripe(env).post('/checkout/sessions', buildSessionParams(kit, plan, env));
      return Response.redirect(session.url, 303);
    } catch (err) {
      console.error('checkout failed', plan, err.message);
      return new Response('Checkout is unavailable right now. Please email hello@thebbqhustle.com.', { status: 500 });
    }
  };
}
