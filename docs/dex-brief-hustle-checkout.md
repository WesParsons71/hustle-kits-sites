# Brief for Dex: Hustle kit checkout and Boosters schedule

## Goal
Replace the current Stripe Payment Link subscriptions for Boosters (and the kit + Boosters combo) with a checkout that creates a 12-month subscription schedule automatically. Today, Boosters renews until canceled, with no end date. Customers were promised 12 months, so this must end on its own.

Start with the BBQ Hustle kit. The Farmstand and SideGig kits will follow the same pattern later.

## Repo and hosting
- Repo: `hustle-kits-sites` (private, GitHub). Folders: `bbq-hustle/`, `farmstand-hustle/`, `sidegig-hustle/`, `shared/`.
- Hosting: Cloudflare Pages project `bbq-hustle` (serves thebbqhustle.com). Put checkout endpoints in `functions/` so they deploy with the site.
- Work on a branch. Test before merging to `main`. Do not deploy to production without Wes's approval.

## Stripe account
- One Stripe account for all three Hustle kits. Separate kits with metadata and product names, not separate accounts.
- Every subscription and checkout session gets metadata: `kit=bbq-hustle` and `plan=boosters` or `plan=combo`.
- Test mode first. Use only test-mode keys until Wes approves going live.

## Known Stripe IDs (BBQ Hustle)
- Boosters price (monthly, $15): `price_1UIFSRHul7zqmXuKFEjzOHkG`
- Boosters-only Payment Link: `https://buy.stripe.com/8x2aEXbwFb9h08Dbj533W01` (to be replaced by checkout)
- Combo Payment Link: `https://buy.stripe.com/7sY4gzdEN4KT6x172P33W06?prefilled_promo_code=BLACKFRIDAY47` (to be replaced by checkout)
- Kit Payment Link: `https://buy.stripe.com/bJe6oH58hcdlcVpbj533W02?prefilled_promo_code=BLACKFRIDAY47`
- Black Friday coupon: `BLACKFRIDAY47` ($40 off, kit line only)
- Kit product and price IDs, combo product ID: ask Wes (see handoff list).

## Pricing rules (do not change)
- Kit: $87 one-time. During Black Friday, $47 (the coupon takes $40 off).
- Boosters: $15/month for 12 months. No discount. Never below $15.
- Combo: first charge $62 during Black Friday (kit $47 + Boosters $15), then $102 (kit $87 + Boosters $15).
- Black Friday ends November 30 on the website. Make sure the coupon's redeem-by date matches. Flag any mismatch to Wes rather than picking one.

## What to build
1. **Boosters checkout.** A server endpoint creates a Stripe Checkout Session in subscription mode, with the Boosters price and metadata tags. Boosters-only buyers land on a welcome page after payment. Ask Wes for that URL before building the success redirect.
2. **Combo checkout.** Same endpoint pattern. The kit's one-time $87 goes on the first invoice. The Black Friday coupon applies to the kit line only. Confirm this works in test mode before anything else.
3. **Webhook.** Listen for `checkout.session.completed`. Verify the Stripe signature. For each new Boosters subscription, create a Subscription Schedule from that subscription with one phase: $15 monthly, 12 iterations, end behavior `cancel`. Make the webhook idempotent, so a retried event doesn't create two schedules.
4. **Audit support.** Log each subscriber's email, kit tag, plan, and schedule ID, so Wes can check kit owners against kit purchases monthly.

## Keys and secrets
- Stripe secret key and webhook signing secret go in Cloudflare environment variables for the `bbq-hustle` project. Never in the repo or in chat.
- Use separate test and live variables.

## Testing (in Stripe test mode)
- Boosters-only purchase: first charge $15, then 12 monthly charges, then the subscription ends. Test the schedule with Stripe's test clock.
- Combo during Black Friday: first charge $62. After Black Friday (use a test clock): $102 onward.
- Webhook replay: the same event twice creates one schedule.
- Redirect: kit purchases land on the thank-you page, and Boosters-only purchases land on the welcome page.

## Hand back to Wes
- Test results, with screenshots or Stripe event IDs.
- Any question about pricing, dates or copy. Do not guess.
- A short deploy note: what changed, what env vars are needed, and how to roll back.

## Do not
- Change pricing, coupons, or Stripe products without Wes's approval.
- Deploy to production without approval.
- Commit keys, customer data, or receipts to the repo.
