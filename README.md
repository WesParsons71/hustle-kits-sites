# hustle-kits-sites

Sites and checkout code for the Hustle kits. One Stripe account and one bank deposit for all kits. Kits are separated by product names and by the `kit` metadata tag on every Stripe object.

## Layout
- `bbq-hustle/`: BBQ Hustle kit site (Cloudflare Pages project `bbq-hustle`, serves thebbqhustle.com)
- `farmstand-hustle/`: Farmstand Hustle kit site (not yet built)
- `sidegig-hustle/`: SideGig Hustle kit site (not yet built)
- `shared/`: checkout and webhook code used by all kits (not yet built)
- `docs/`: briefs and notes

## Rules
- Work on a branch. Merge to `main` only after testing in Stripe test mode and Wes's approval.
- Never commit keys, customer data or receipts. Stripe keys live in Cloudflare environment variables for each project.
- Pricing lives in each kit's own config. Change it only with Wes's approval.
