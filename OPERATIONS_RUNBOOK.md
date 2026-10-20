# Trakio operations runbook

This runbook covers the minimum recovery procedure for the Neon PostgreSQL
database. It is intentionally written for a single operator and uses a
disposable Neon branch or test database for every rehearsal.

## Safety rules

- Never paste a connection string, password, API token, or secret into this
  document, a ticket, or terminal output.
- Do not run restore commands with `NODE_ENV=production`.
- A restore rehearsal must use a target database that is separate from both
  `DATABASE_URL` and `DIRECT_URL`. Do not use the application database as the
  restore target.
- Use a direct, non-pooled Neon URL for `pg_dump`, `pg_restore`, and `psql`.
  Keep the URL in an environment variable; do not put it in a committed file.
- Confirm the target database in the Neon console before any command that can
  overwrite objects. If there is any doubt, stop.

## Required tools

- Neon console access for creating a disposable branch/database and checking
  branch identity.
- PostgreSQL client tools: `pg_dump`, `pg_restore`, and `psql`.
- A protected location with enough free disk space for the backup file.

## Create a backup

For a scheduled or pre-deployment backup, set the direct source connection in
the current PowerShell session only. The value below is a placeholder and must
not be committed or printed:

```powershell
$env:BACKUP_SOURCE_URL = "<DIRECT_NEON_CONNECTION_STRING>"
$backupDir = Join-Path (Get-Location) "backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$backupFile = Join-Path $backupDir ("track-in-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".dump")
pg_dump --format=custom --no-owner --no-privileges --file=$backupFile --dbname=$env:BACKUP_SOURCE_URL
```

Record only the backup filename, UTC timestamp, source Neon branch name, and
the SHA-256 checksum. Do not record the connection string:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath $backupFile
```

Move the dump to the operator's encrypted backup storage after verifying the
command succeeded. Do not commit `backups/` to Git. Remove the temporary local
copy only through the normal operating-system recycle/trash workflow after
the protected copy has been verified.

## Restore rehearsal (disposable target only)

Perform this at least once before relying on paid traffic and after any major
schema or deployment change.

1. In Neon, create a disposable branch/database from the appropriate recovery
   point. Name it clearly, for example `restore-rehearsal-2026-10-04`.
2. Confirm in the Neon console that the target is disposable and is not the
   production branch. Copy its direct connection string into the current
   PowerShell session without writing it to a file.
3. Set a second variable for the source backup, then verify that the source
   and target variables are not equal. Never display either value.

```powershell
$env:RESTORE_TARGET_URL = "<DISPOSABLE_NEON_DIRECT_CONNECTION_STRING>"
if ([string]::IsNullOrWhiteSpace($env:BACKUP_SOURCE_URL) -or
    [string]::IsNullOrWhiteSpace($env:RESTORE_TARGET_URL)) {
  throw "Set BACKUP_SOURCE_URL and RESTORE_TARGET_URL in this session first."
}
if ($env:BACKUP_SOURCE_URL -eq $env:RESTORE_TARGET_URL) {
  throw "Refusing to restore: source and target are identical."
}
if ($env:NODE_ENV -eq "production") {
  throw "Refusing to restore while NODE_ENV=production."
}
```

4. Restore into the disposable target. The `--clean` option can drop objects,
   so use it only after the Neon target identity has been checked:

```powershell
pg_restore --clean --if-exists --no-owner --no-privileges --dbname=$env:RESTORE_TARGET_URL --verbose --exit-on-error $backupFile
```

5. Apply no application migrations during the first restore check. First
   verify that the dump itself recovered the schema and data. Then compare the
   restored migration history with the source:

```powershell
psql $env:RESTORE_TARGET_URL -X -v ON_ERROR_STOP=1 -c "select current_database(), current_schema();"
psql $env:RESTORE_TARGET_URL -X -v ON_ERROR_STOP=1 -c "select migration_name from _prisma_migrations order by finished_at;"
```

6. Run the application checks against the restored target only if needed. Keep
   the target URL in the current process environment and do not overwrite the
   normal `.env.local`:

```powershell
$env:TEST_DATABASE_URL = $env:RESTORE_TARGET_URL
npm run test:integration
```

The integration suite must pass without using production credentials or
real traffic data. If the restored database is intentionally used for a
manual dashboard check, start the app in a separate terminal with the target
URL and use only the private Basic Auth test credentials.

## Restore rehearsal acceptance checklist

Record the result and date in the operator's private operations log:

- [ ] Neon target branch/database was confirmed disposable and separate from
      the application database.
- [ ] Backup file checksum was recorded before restore.
- [ ] `pg_restore` completed with `--exit-on-error` and no unexplained errors.
- [ ] `_prisma_migrations` exists and contains the expected migration history.
- [ ] Core tables exist: `traffic_sources`, `campaigns`, `clicks`,
      `conversions`, `outbound_postbacks`, and `audit_entries`.
- [ ] A known non-sensitive row-count or fixture check matched expectations.
- [ ] `npm run test:integration` passed against the restored target, when the
      integration environment is available.
- [ ] A private dashboard check showed the expected aggregate and delivery
      status values, when required for the release.
- [ ] No secrets or production credentials appeared in command output or logs.
- [ ] The disposable Neon branch was deleted or retained only with an
      explicit owner decision and an expiration date.

## Recovery notes

If production data is missing or corrupted, stop application writes first and
preserve the current Neon branch. Use Neon point-in-time recovery or a
provider-supported branch from the last known-good timestamp, then rehearse
the restore into a disposable target before changing production. Record the
incident time, recovery point, migration version, and validation results. Do
not improvise a destructive in-place restore while traffic is active.

After recovery, rotate credentials if there is any possibility that the
database URL or platform secret was exposed, and review pending outbound jobs
before resuming traffic.

## Outbound delivery worker

The web process accepts conversions and writes durable outbound jobs. The
separate `trakio-outbox` PM2 process delivers those jobs to the configured
traffic source and applies bounded retries.

Check both processes:

```bash
pm2 status
pm2 logs trakio-outbox --lines 100
```

On a fresh VPS, start the worker from the application directory and persist it
for reboot recovery:

```bash
cd /root/app
pm2 start npm --name trakio-outbox -- run worker:outbox
pm2 save
```

After an accepted test conversion, confirm its Delivery Health row moves from
`pending` to `delivered`. A row with `attempts: 0` and no diagnostic means the
worker has not claimed it; restart the worker and inspect its logs before
retrying the conversion.

## USDT payment monitor

The `trakio-billing` PM2 process polls TronGrid for confirmed incoming USDT
TRC20 transfers. It needs `BILLING_PROVIDER=tron`, the receiving public address
in `BILLING_WALLET_ADDRESS`, and a server-only `TRONGRID_API_KEY`. Do not put a
wallet private key in the app. Apply the Prisma migration before starting it.

```bash
pm2 start npm --name trakio-billing -- run worker:billing
pm2 save
pm2 logs trakio-billing --lines 100
```

Only one instance of this monitor should run. Check `pm2 status` for duplicate
instances. The worker matches only confirmed transfers of the official TRON
USDT contract and the exact invoice amount. Transfers without a matching
invoice are retained, not credited. Their amounts are reserved so future
invoices cannot accidentally reuse them. Review them with this read-only query
in Neon; `amount_atomic` is in USDT micro-units, so divide by 1,000,000 to see
the token amount:

```sql
SELECT transaction_hash, amount_atomic, from_address, block_timestamp
FROM billing_chain_transfers
WHERE payment_id IS NULL
ORDER BY block_timestamp DESC
LIMIT 100;
```

Invoices created before automatic payment monitoring have no unique payment
amount and are not auto-credited. Ask the user to create a new invoice or
reconcile the older transfer carefully. Never activate an account based only
on a browser's “payment sent” claim or an unconfirmed transaction.

For a controlled monitor test, temporarily set `BILLING_TEST_MODE=true` on the
web app and restart it. Sign in, open the subscription page, and create the
dedicated 0.10 USDT test invoice. Send exactly 0.10 USDT over TRC20 to the
displayed wallet, then check `pm2 logs trakio-billing --lines 100` and the
invoice status in the app. The worker records the confirmed transfer against
the test invoice and explicitly does not create or modify a subscription.
After verification, set `BILLING_TEST_MODE=false` and restart the web app. Do
not use this test invoice as a production payment method.

## Transactional email

The `trakio-email` PM2 process sends verification and invoice messages from
the database-backed email outbox through Resend. Apply migrations, set
`RESEND_API_KEY`, `EMAIL_FROM_VERIFICATION`, and `EMAIL_FROM_INVOICE` to sender
identities on the verified sending domain before starting the worker.
Verification defaults to `Trakio <team@trakio.org>` and invoices to
`Trakio Billing <billing@trakio.org>`. The outbox retains queued messages while
Resend is unavailable and retries transient failures. It retries up to eight
times; inspect terminal failures before asking a user to retry signup or
invoice creation.

```bash
pm2 start npm --name trakio-email -- run worker:email -- --env-file .env.production
pm2 save
pm2 logs trakio-email --lines 100
```

Inspect only operational fields when debugging. Verification links are
encrypted in the outbox, and the email payload is cleared after delivery:

```sql
SELECT kind, recipient, status, attempts, next_attempt_at, last_error, created_at
FROM email_outbox
ORDER BY created_at DESC
LIMIT 100;
```

Keep the outbox payload private. The worker derives its encryption key from
`AUTH_SESSION_SECRET`; drain pending welcome emails before rotating that key.
For a terminal invoice-email failure, fix the Resend configuration first, then
requeue only that invoice by its outbox ID. The idempotency key is retained so
the provider can avoid sending the same invoice twice:

```sql
UPDATE email_outbox
SET status = 'pending', attempts = 0, next_attempt_at = CURRENT_TIMESTAMP,
    last_error = NULL, updated_at = CURRENT_TIMESTAMP
WHERE id = 'email-outbox-uuid'
  AND kind = 'invoice_created'
  AND status = 'permanently_failed'
  AND payload <> '{}'::jsonb;
```

For an unverified account, have the user sign in with the correct password and
use **Resend confirmation email** to create a fresh link.
