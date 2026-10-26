# Brief for Dex: Hustle kit checkout and Boosters schedule

## Goal
Replace the current Stripe Payment Link subscriptions for Boosters, and for the kit + Boosters combo, with a checkout that creates a 12-month subscription schedule automatically. Today, Boosters renews until canceled, with no end date. Customers were promised 12 months, so the subscription must end on its own.

Start with the BBQ Hustle kit. The Farmstand and SideGig kits follow the same pattern later.

## Repo and hosting
- Repo: `hustle-kits-sites` (private, GitHub). Folders: `bbq-hustle/`, `farmstand-hustle/`, `sidegig-hustle/`, `shared/`, `docs/`.
- Hosting: Cloudflare Pages project `bbq-hustle` (serves thebbqhustle.com). Put checkout endpoints in `functions/` so they deploy with the site. The Pages project is currently a direct-upload project, not connected to this repo. Connecting it is a separate decision for Wes.
- Work on a branch. Test before merging to `main`. Do not deploy to production without Wes's approval.

## Stripe account
- One Stripe account and one bank deposit for all three Hustle kits. Kits are separated by product name.
- Audit by product: Boosters subscribers are on `prod_VIrAiHc6lQaAEX`; combo buyers are on `prod_VVvXVUYJkHLsLm`. No metadata tags are needed.
- Test mode first. Use only test-mode keys until Wes approves going live.

## Stripe IDs (BBQ Hustle)
Products and prices
- Kit product: `prod_VIr8uTdugWwOqn`, price `price_1USfAIHul7zqmXuKjeHYTgwH` ($87 one-time)
- Boosters product: `prod_VIrAiHc6lQaAEX`, price `price_1UIFSRHul7zqmXuKFEjzOHkG` ($15/month)
- Combo product: `prod_VVvXVUYJkHLsLm`, prices `price_1UUuTvHul7zqmXuKo4mkVmak` ($87 one-time) and `price_1UUtgWHul7zqmXuKxXwctylL` ($15/month)

Payment links (current, to be replaced by checkout)
- Kit: `plink_1USfkxHul7zqmXuKe09mmsYE`, https://buy.stripe.com/bJe6oH58hcdlcVpbj533W02. Promo codes allowed.
- Combo: `plink_1UUuwUHul7zqmXuK2s8bzAKG`, https://buy.stripe.com/7sY4gzdEN4KT6x172P33W06. Promo codes allowed.
- Boosters only: `plink_1UIFaGHul7zqmXuKn0s0pnmK`, https://buy.stripe.com/8x2aEXbwFb9h08Dbj533W01. Promo codes NOT allowed. Keep it that way.

Black Friday discount (live, tested)
- Coupon `F2kqBJLv`: $40 off, once, restricted to the kit and combo products only (not Boosters). Redeem by 1796101140 (November 30, 2026, 11:59 PM Eastern).
- Promotion code `promo_1UUwsRHul7zqmXuKAirgVGjX`, code `BLACKFRIDAY47`, active.
- Retired: coupon `x1wMXPwq` and promotion code `promo_1UUuwUHul7zqmXuKIHIg48mo` (deactivated, do not reuse). Coupon `6UtWZj1f` and promotion code `promo_1USfU3Hul7zqmXuKaa3NsAKA` (inactive, leave alone).

## Pricing rules (do not change)
- Kit: $87 one-time. During Black Friday, $47 (coupon takes $40 off).
- Boosters: $15/month for 12 months. No discount. Never below $15.
- Combo: first charge $62 during Black Friday ($47 kit + $15 Boosters), then $102 ($87 kit + $15 Boosters).
- Black Friday ends November 30 on the website. The coupon ends November 30 at 11:59 PM Eastern. If anything disagrees, flag it to Wes rather than picking one.

## What to build
1. **Boosters checkout.** A server endpoint creates a Stripe Checkout Session in subscription mode with the Boosters price. Boosters-only buyers land on a welcome page after payment. Ask Wes for that URL before building the success redirect.
2. **Combo checkout.** Same endpoint pattern. The kit's one-time $87 price goes on the first invoice with the Boosters subscription. The Black Friday coupon applies to the kit and combo products only. Confirm in test mode that $62 is charged on the first invoice during Black Friday.
3. **Webhook.** Use Stripe's thin event payloads: fetch the full object from the API after each event. Listen for `checkout.session.completed` and `customer.subscription.created`. Verify the Stripe signature with the endpoint's signing secret (starts `whsec_`). Make the handler idempotent, so a retried event doesn't create two schedules.
4. **Subscription schedule.** For each new Boosters subscription, create a Subscription Schedule from that subscription with one phase: $15 monthly, 12 iterations, end behavior `cancel`. Stripe's answers have conflicted on whether this can be done in the dashboard or only through the API. Verify in test mode before building on either.
5. **Audit support.** Log each subscriber's email, product, plan, and schedule ID, so Wes can match Boosters subscribers against kit purchases monthly.

## Keys and secrets
- The Stripe secret key and webhook signing secret go in Cloudflare environment variables for the `bbq-hustle` project. Never in the repo or in chat.
- Keep separate test and live variables.

## Testing (in Stripe test mode)
- Test clocks: Wes can create one in the Stripe dashboard, or Dex can create one through the API.
- Boosters-only: first charge $15, then 12 monthly charges, then the subscription ends.
- Combo during Black Friday: first charge $62. After Black Friday (use a test clock): $102 onward.
- Kit during Black Friday: $47.
- Boosters-only link: no promo code box appears.
- Webhook replay: the same event delivered twice creates one schedule.
- Redirects: kit purchases land on the thank-you page. Boosters-only purchases land on the welcome page.

## Hand back to Wes
- Test results, with Stripe event IDs.
- Any question about pricing, dates or copy. Do not guess.
- A short deploy note: what changed, which environment variables are needed, and how to roll back.

## Do not
- Change pricing, coupons, or Stripe products without Wes's approval.
- Re-enable promo codes on the Boosters-only link.
- Deploy to production without approval.
- Commit keys, customer data, or receipts to the repo.
