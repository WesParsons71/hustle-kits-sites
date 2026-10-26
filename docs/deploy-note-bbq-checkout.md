# BBQ Hustle checkout: deploy note (branch `claude/new-session-8smpn8`)

## What changed
- `bbq-hustle/functions/api/checkout/boosters.js` and `combo.js`: create a Stripe Checkout Session (subscription mode) and 303-redirect to it. Linked from `boosters.html` and the combo button on `index.html` (kit buttons stay on the Payment Link).
- `bbq-hustle/functions/api/webhook.js`: verifies the Stripe signature, then gives each new Boosters/combo subscription a Subscription Schedule: one phase, 12 monthly iterations, end behavior `cancel`. Handles thin and snapshot events, re-fetches objects from the API, and is idempotent (checks the subscription's `schedule`, plus Stripe idempotency keys).
- `shared/checkout/`: the reusable code. `bbq-hustle/kit-config.js`: product and price IDs.
- `scripts/audit.mjs`: monthly CSV of subscribers, plan, product, status, schedule ID (`NONE` flags a missed schedule). The webhook also logs one `audit` JSON line per schedule.
- Boosters-only sessions never set `allow_promotion_codes` or `discounts`. The combo session auto-applies the Black Friday promo code until the coupon's redeem-by time, then switches to a promo-code box.

## Cloudflare env vars (project `bbq-hustle`; set Test and Live separately)
| Var | Notes |
|---|---|
| `STRIPE_SECRET_KEY` | secret |
| `STRIPE_WEBHOOK_SECRET` | secret, `whsec_...` of the endpoint `https://<site>/api/webhook` |
| `BOOSTERS_SUCCESS_URL` | welcome page URL (path or full). Boosters checkout refuses to run without it. |
| `BLACK_FRIDAY_PROMO_ID` | `promo_1UUwsRHul7zqmXuKAirgVGjX` live; a test-mode promo in test |
| `STRIPE_PRICE_BOOSTERS`, `STRIPE_PRICE_COMBO_KIT`, `STRIPE_PRICE_COMBO_BOOSTERS` | required in test mode (defaults are live IDs) |
| `COMBO_SUCCESS_URL`, `SITE_URL`, `STRIPE_API_VERSION` | optional (defaults: `/thank-you`, thebbqhustle.com, account default) |

Webhook events to send: `checkout.session.completed`, `customer.subscription.created`.

## Deploy
Functions live in `bbq-hustle/functions`, so deploy from that folder: `cd bbq-hustle && npx wrangler pages deploy . --project-name bbq-hustle`. (Dashboard drag-and-drop uploads do not include functions.) Pages Preview deployments use the Preview env vars, which is the safe place to test.

## Roll back
Cloudflare Pages dashboard > Deployments > previous deployment > Rollback. That restores the Payment Link buttons. Subscriptions already created keep their schedules.

## Tests
`npm test` (mocked Stripe: session params, signature checks, two events + replay = one schedule). Live Stripe test-mode runs are still to do; see open questions.
