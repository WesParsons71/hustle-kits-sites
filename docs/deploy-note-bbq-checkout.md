# Deploy note: BBQ Hustle Boosters checkout (branch, not deployed)

## What changed
- `functions/api/checkout.js`: `/api/checkout?plan=boosters|combo` creates a Stripe Checkout Session (subscription mode) and redirects to it. Kit-only stays on its Payment Link.
- `functions/api/stripe-webhook.js`: verifies the signature, fetches the full object, and gives each new Boosters/combo subscription a Subscription Schedule (one phase, 12 iterations, end behavior `cancel`). Idempotent via existing-schedule check plus Stripe idempotency keys.
- `functions/_lib/`: Stripe helpers and the BBQ price/product config.
- Site: new `boosters-welcome.html` (post-Boosters confirmation); thank-you's Get Boosters button goes straight to checkout; Boosters button on `boosters.html` and combo button on `index.html` now point at `/api/checkout`.
- `tests/stripe.test.mjs`: local checks for signature verification and form encoding (`node tests/stripe.test.mjs`).

## Environment variables (Cloudflare Pages, project `bbq-hustle`, set as secrets)
| Name | Notes |
|---|---|
| `STRIPE_MODE` | `test` (default) or `live` |
| `STRIPE_SECRET_KEY_TEST` / `STRIPE_SECRET_KEY_LIVE` | secret keys |
| `STRIPE_WEBHOOK_SECRET_TEST` / `STRIPE_WEBHOOK_SECRET_LIVE` | `whsec_...` per endpoint |
| `RESEND_API_KEY` | secret. Must be set in **Production** as well as Preview |
| `KIT_DELIVERY_URL` | optional. Overrides the Kit link in the confirmation email. Defaults to the shared Drive folder set in `bbq-config.js` (`EMAIL.deliveryUrl`) |
| `EMAIL_FROM` | optional, defaults to `The BBQ Hustle <hello@thebbqhustle.com>` |
| `BOOSTERS_WELCOME_URL` | optional, defaults to `/boosters-welcome` |
| `SITE_URL` | optional, defaults to the request origin |
| `AUDIT` | optional KV binding for the audit log |

Webhook endpoint: `https://<site>/api/stripe-webhook`, events `checkout.session.completed` and `customer.subscription.created`.

## Deploy / rollback
The project is direct-upload. From the repo root: `wrangler pages deploy bbq-hustle --project-name=bbq-hustle` (picks up `./functions`). Roll back by redeploying the previous deployment from the Pages dashboard, which restores the Payment Links.

## Not yet verified (needs Stripe test mode)
- Test-mode IDs in `bbq-config.js` are null: test mode needs its own products, prices and coupon.
- Schedule creation + update via API, first-invoice $62 on combo, test-clock runs, webhook replay.

## Kit confirmation email (Resend)
- On `checkout.session.completed` for a paid Kit or combo session, the webhook sends one email through Resend with the Kit link and the Done For You form link. Boosters-only purchases get no Kit email.
- Safe to replay: the Resend idempotency key is the Checkout Session id, and the email is the last step, so a retry after a schedule error cannot double-send.
- If `RESEND_API_KEY` is missing, the webhook returns 500 and Stripe retries until it is set.
- Delivery is a shared Google Drive folder ("The BBQ Hustle Kit", view-only for anyone with the link). To rotate the link, change the sharing on the folder and update `EMAIL.deliveryUrl` or `KIT_DELIVERY_URL`. R2 with expiring links is still the longer-term plan.
- Sending domain: thebbqhustle.com. The DKIM record (`resend._domainkey`) and the `send.` SPF and MX records are published. No DMARC record yet.
- Local check: `node tests/email.test.mjs`.

## Not yet verified (email)
- A real send from the Resend account, and the domain showing Verified in the Resend dashboard.
- HubSpot: the strategy note says each buyer is also added to HubSpot. That is not built.
