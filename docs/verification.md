# Local verification — 15 October 2026

- 23 automated tests passed: money parsing, Manila billing dates, full-month payment rules, selected-month settlement, proof review/reversal, funds and move-out, input/upload validation, origin checks, database RLS and state pagination.
- SQL tests execute the migration in PGlite with Auth stubs; they do not replace hosted Supabase integration checks.
- TypeScript check and Next.js production build passed.
- Browser demo checks: owner approval updates collected total and the selected bill; onboarding creates a renter with full first-month rent and held advance; switching to renter hides other renters; mobile image submission creates pending payment without clearing rent.
- Phone layout checked at 390 × 844. An interrupted dev-server connection displayed the internet-required fallback and recovered using Try again.
- Review fixes: clear temporary-password notices on logout/session loss and role switch; show chosen bill month during review; paginate beyond Supabase's row cap; align demo and SQL move-out/reversal rules.

No dedicated cloud project is configured. Hosted Auth/password changes, Storage, Cron, real concurrent requests, device PWA installation and Vercel deployment remain unverified. Follow README setup and smoke-test with synthetic accounts before entering real records. Electricity and late fees remain outside v1.
