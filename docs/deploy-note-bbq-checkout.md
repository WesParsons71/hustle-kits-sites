# Deploy note: BBQ Hustle Boosters checkout (branch, not deployed)

## What changed
- `functions/api/checkout.js`: `/api/checkout?plan=boosters|combo` creates a Stripe Checkout Session (subscription mode) and redirects to it. Kit-only stays on its Payment Link.
- `functions/api/stripe-webhook.js`: verifies the signature, fetches the full object, and gives each new Boosters/combo subscription a Subscription Schedule (one phase, 12 iterations, end behavior `cancel`). Idempotent via existing-schedule check plus Stripe idempotency keys.
- `functions/_lib/`: Stripe helpers and the BBQ price/product config.
- Site: Boosters button on `boosters.html` and combo button on `index.html` now point at `/api/checkout`.
- `tests/stripe.test.mjs`: local checks for signature verification and form encoding (`node tests/stripe.test.mjs`).

## Environment variables (Cloudflare Pages, project `bbq-hustle`, set as secrets)
| Name | Notes |
|---|---|
| `STRIPE_MODE` | `test` (default) or `live` |
| `STRIPE_SECRET_KEY_TEST` / `STRIPE_SECRET_KEY_LIVE` | secret keys |
| `STRIPE_WEBHOOK_SECRET_TEST` / `STRIPE_WEBHOOK_SECRET_LIVE` | `whsec_...` per endpoint |
| `BOOSTERS_WELCOME_URL` | where Boosters-only buyers land. Not set yet; checkout refuses without it |
| `SITE_URL` | optional, defaults to the request origin |
| `AUDIT` | optional KV binding for the audit log |

Webhook endpoint: `https://<site>/api/stripe-webhook`, events `checkout.session.completed` and `customer.subscription.created`.

## Deploy / rollback
The project is direct-upload. From the repo root: `wrangler pages deploy bbq-hustle --project-name=bbq-hustle` (picks up `./functions`). Roll back by redeploying the previous deployment from the Pages dashboard, which restores the Payment Links.

## Not yet verified (needs Stripe test mode)
- Test-mode IDs in `bbq-config.js` are null: test mode needs its own products, prices and coupon.
- Schedule creation + update via API, first-invoice $62 on combo, test-clock runs, webhook replay.
