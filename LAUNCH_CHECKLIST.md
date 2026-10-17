# Launch checklist

Everything to do before real students use the site. Reviewed together at Milestone 8.
Costs checked October 2026.

## Must do before launch

- [ ] **Buy a domain** (~$10–15/year), e.g. from Cloudflare, Namecheap or Porkbun. Point it at Vercel
      (Vercel → Settings → Domains), then update Supabase → Authentication → URL Configuration
      (Site URL + `https://yourdomain/**` redirect).
- [ ] **Custom email (Resend, free up to 3,000 emails/month).** Verify the domain in Resend, then paste
      its SMTP details into Supabase → Authentication → Emails → SMTP Settings. Without this, Supabase
      only emails members of your Supabase organization, and new free projects can't edit email
      templates. Afterwards, paste the templates from `supabase/templates/` (they let people confirm on a
      different device than they signed up on).
- [ ] **Upgrade Supabase to Pro ($25/month).** Daily backups (the free plan has none), 250 GB/month photo
      bandwidth instead of 5 GB, and the project never pauses.
- [ ] **Bot protection (Cloudflare Turnstile, free).** Stops scripts from mass-creating accounts.
      Supabase → Authentication → Bot and Abuse Protection.
- [ ] **Delete the old `cu-housing` Vercel project** (the one without `-9c7p`) if it still exists.
- [ ] **Review the Terms of Use and Privacy Policy** pages (to be drafted in Milestone 8). Have a lawyer
      look before charging money.

## When you start making money

- [ ] **Upgrade Vercel to Pro ($20/month).** The free Hobby plan is for non-commercial use only.
- [ ] **Stripe** for featured listings / subscriptions (no monthly fee, ~2.9% + 30¢ per payment).

## Optional

- [ ] **Mapbox** (free at this scale; credit card on file) for address suggestions while typing and a
      nicer browse map. The site currently uses the free US Census address lookup, which needs no account.
- [ ] Error monitoring (Sentry free tier).

## Expected monthly cost

| Stage | Monthly |
|---|---|
| Building and testing | $0 |
| Launched, free for students | ~$26 (Supabase Pro + domain) |
| Charging money | ~$46 + Stripe fees |
| Large (thousands of active users) | ~$70–100 |
