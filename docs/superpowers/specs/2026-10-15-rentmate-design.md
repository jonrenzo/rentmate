# Rentmate v1

Approved by the owner after the Satoshi/Lucide mockup, 15 October 2026. The instruction to build authorizes implementation without another approval round.

## Agreed product

- A responsive owner dashboard and an installable, internet-required renter PWA, using the approved clean Apple-inspired light UI, Satoshi typography and Lucide icons.
- One owner. Owner creates renters with assigned usernames and temporary passwords. First login and every reset require a new password. Renters ask the owner for resets.
- Rooms have changing occupants. Each renter has their own agreement, owner-set monthly rent amount and monthly due day. No room-wide split in v1.
- Full monthly payments only. The renter chooses the unpaid month to settle, including out-of-order settlement. A payment does not clear other months.
- Bills appear automatically 3 calendar days before the due date. First rent is a full month even on mid-month move-in. No historical notebook import.
- GCash QR/number, screenshot and reference submission, and manual owner verification. Also record cash and bank transfers. Pending proofs do not count as collected rent. Rejections require a reason and allow resubmission.
- One month advance and one month deposit tracked independently. Deposit may settle the final month; advance may be refunded. Recording a refund does not transfer money.
- Owner marks a renter moved out, stops future billing, preserves all records, and keeps the renter's account read-only.
- Renter profile includes name, contact number, room, move-in date, rent amount, due day and advance/deposit records.
- View-only monthly reporting and in-app due/overdue indicators. No exports, signatures, electricity, late fees, offline data, SMS, email reminders, or GCash API integration.
- Supabase Free and Vercel Hobby as explicitly chosen by owner for their hobby project. Hosting eligibility and free-tier quotas remain provider constraints. No paid services or automatic upgrades.

## Implementation defaults

- Next.js App Router + React + TypeScript. Currency stored as integer PHP centavos. Dates follow Asia/Manila. Due days 29–31 clamp to the last day of shorter months; no cumulative date drift.
- A daily Supabase Cron job creates bills idempotently. State loading catches up missed bills after downtime. At onboarding choose the first billing month; no invented pre-onboarding balances. Generated bills keep their original amounts. Rent edits affect future ungenerated bills.
- First billing date is never before move-in: if the selected due day has passed in the first month, the initial full bill is due on move-in day. Later months return to the agreed due day.
- Server-only privileged Supabase client. Every API request verifies auth and the database profile. Database RLS denies unowned records and temporary-password accounts. No public signup. Renter read-only status is checked server-side, not merely by hidden buttons.
- Username maps to an internal auth email; no email is collected from renters. The owner has a documented CLI recovery path. Temporary passwords are generated securely, displayed once, never persisted in app tables, and never logged.
- Approved payments and fund settlement use atomic transactions with row locks. One active payment proof per bill. Duplicate approvals, partial amounts, over-refunds and cross-renter submissions fail. Wrong recorded payments can be reversed with a required reason and retained audit record.
- Proof images are private JPEG/PNG/WebP, limited to 4 MB, verified by signature. QR images are also private. Authorized viewing uses expiring signed URLs. Private data is never cached by the service worker.
- Move-out requires pending proofs to be resolved. Owner may apply deposit only when it can cover an entire final bill. Any remaining deposit and advance can be recorded as refunded separately. No automatic money movement.
- New application has an explicitly labeled browser-local demo so the complete UI can be tried before cloud setup. Demo contains synthetic data, is separate from live login, and can be reset. Live setup never silently falls back to demo data.
- Account/database creation and production deployment need a dedicated Rentmate Supabase project and Vercel connection. Existing unrelated ERP project must not be used.

## Validation

Test bill generation boundaries, Manila dates, short months, full-payment enforcement, selected-month settlement, rejected/resubmitted proofs, duplicate approval, reversals, deposit/refund accounting, move-out, username/password validation and authorization. Check cross-renter isolation and temporary-password restrictions in SQL. Run TypeScript, unit/domain tests, database checks and production build; browser-check mobile/desktop layouts and core demo actions. Clearly report any live-cloud validation that cannot be performed.
