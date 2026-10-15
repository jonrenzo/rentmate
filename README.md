# Rentmate

One-owner rental ledger and renter portal. The browser-local demo is separate from live accounts. Rent is stored in integer PHP centavos; billing dates use Asia/Manila. Renter payments require owner verification. Recording a payment or refund never moves money.

## Run locally

Use Node.js 22+ and npm:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000 and choose the demo. Live sign-in returns a setup message until environment variables are configured; it never substitutes demo records. Demo data is synthetic and stays in this browser.

## Set up a dedicated Supabase project

Do not reuse another application's database. No cloud database has been created or changed by this implementation.

1. Create a dedicated Rentmate Supabase project. In Authentication settings disable public signups and anonymous sign-ins. Admin-created users still work. Set the site URL to your deployed origin. Choose an appropriate password policy and review Auth rate limits.
2. Open that project's SQL editor and run `supabase/migrations/20261015093045_rentmate.sql` once. It creates the tables, RLS, private image bucket, transaction functions and the daily billing job. Alternatively use Supabase CLI migrations after explicitly linking only this new project; inspect `supabase link --help` and `supabase db push --help` first. If using the SQL editor, do not later push the same migration without first reconciling migration history.
3. Copy `.env.example` to `.env.local`. Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and the server-only `SUPABASE_SERVICE_ROLE_KEY` from the new project's dashboard. Set `APP_ORIGIN` to the exact origin, with no trailing slash (locally `http://127.0.0.1:3000`). Never put the service-role key in a `NEXT_PUBLIC_` variable, commit it, or send it to a renter.
4. Bootstrap the single owner:

```sh
npm run bootstrap-owner -- --username owner --name "Property owner"
```

The command displays a random temporary password once. Sign in, change it, and discard the terminal output. Do not run this command in shared CI logs. Create rooms and renter accounts from the owner interface. Assigned usernames use 3–32 lowercase letters, digits, periods, underscores or hyphens; the first character must be a letter or digit. Passwords must have at least 12 characters.

If the owner loses their password, run from a trusted machine with the dedicated project's service-role key:

```sh
npm run bootstrap-owner -- --username owner --recover
```

Recovery preserves all records, invalidates earlier application sessions and requires another password change. If a renter reset fails midway, retry from the owner interface; the account remains gated until a successful reset and password change.

## Local Supabase (optional)

Docker and the Supabase CLI are required. The committed `supabase/config.toml` disables signup. Run `supabase start`, then `supabase db reset` **only against the disposable local stack**. Reset erases that local database. Use the local URL/keys shown by the CLI in `.env.local`, then bootstrap an owner. Never use reset against valuable data. This stack was not run in this environment because Docker was unavailable.

## Deploy

Run `npm test`, `npm run typecheck`, and `npm run build`. Connect this repository to Vercel as a Next.js project and add the same four environment variables, using the deployed HTTPS origin for `APP_ORIGIN`. Deploy and bootstrap against the matching Supabase project. Cookies require HTTPS in production. Preview deployments need their own matching origin/environment; origin checks deliberately reject a different hostname.

Vercel Hobby is restricted to personal, non-commercial use. The selected hobby deployment must meet those terms; rental-business use needs an eligible hosting plan or provider. There is no automatic paid upgrade in this app. Review [Vercel Hobby rules](https://vercel.com/docs/plans/hobby) before publishing. Request-body limits also apply; proofs are limited to 4 MB JPEG, PNG or WebP, keeping the multipart upload below Vercel's normal function body limit.

## Billing and security

The database job runs daily at 16:05 UTC (00:05 Philippine time). State loading catches up missed bills idempotently. Bills appear three days before due dates; short months clamp the chosen due day, and the first bill is never due before move-in. Onboarding chooses the first billing month; existing bills retain their amount when rent changes.

All API reads verify the Supabase user and database profile. Cookie sessions are HTTP-only, SameSite Strict, and secure in production; mutation requests require the configured exact origin. Temporary-password users cannot read app records. Reset invalidates sessions established before the reset. Authenticated database users have isolated SELECT access only; mutations use service-role-only transactions after server authorization. Authorization never trusts user-editable metadata.

Only image uploads can create proof paths. The bucket is private with no client storage policy. `/api/file?path=...` checks the associated payment or current QR through RLS and redirects to a 60-second signed URL. Treat that short-lived URL as private. Images are signature-checked, not malware-scanned. Replaced QR images are retained privately; remove obsolete images only after confirming they are unreferenced.

Transactions lock records and enforce one pending/approved payment per bill, complete monthly amounts, one full advance/deposit receipt each, refund limits and final-bill deposit application. Reversals retain history and require a reason; deposit settlement cannot be reversed through the ordinary payment reversal action. Resolve all pending proofs before move-out. Former renters can read their records but cannot submit new proofs. The owner can still record/reverse payments and record remaining fund refunds after move-out.

## Operations and backups

Supabase Free projects can pause after inactivity; billing catches up after the project resumes. Internet access is required. Monitor project quotas and storage usage. Free projects should have regular off-site database dumps, plus **separate copies of Storage images**: database backups do not contain image bytes. Test restoration in a disposable project. See [Supabase production guidance](https://supabase.com/docs/guides/deployment/going-into-prod) and [backup documentation](https://supabase.com/docs/guides/platform/backups). Configure Auth abuse controls before sharing the public login; the app uses Supabase Auth's rate limits rather than a process-local counter that would fail across serverless instances.

## Verification scope

`npm test` includes domain tests and PGlite execution of the actual application migration (with minimal Auth schema stubs; Storage/Cron infrastructure excluded). Backend tests exercise image and input validation, origin checks, RLS isolation and password gates, denied direct writes/RPCs, month boundaries, duplicate approvals/proofs, rejection/resubmission, reversals, refund limits, final deposit settlement and read-only move-out.

PGlite tests do not verify the real Supabase Auth, cookie refresh, hosted Storage, pg_cron extension, concurrent connections, or a deployed Vercel environment. Before real records, smoke-test two renters and an owner on the dedicated project: first password change; reset invalidation; cross-renter access denial; image submission/view; rejection/resubmission/approval; duplicate requests; fund settlement; move-out; and restore from backup. Use Supabase database advisors after migration. No existing unrelated cloud project was accessed or changed.
