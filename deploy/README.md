# Timeweb deployment

Project: Dostavita (2975851). Dedicated server: 9220153, 201.34.159.235.
Ubuntu 24.04, Novosibirsk NSK-1, 2 CPU, 4 GB RAM, 50 GB NVMe disk.
Monthly total: RUB 1,800 (server 1,300 + one backup 300 + public IPv4 200).
The unused server 9219953 and its public IP were deleted before ordering this replacement.
Existing sites and servers are separate.

This budget configuration has limited memory headroom for the application and Supabase.
Measure memory usage under load before cutover; build application images outside the production server where possible.

## Current deployment (2026-09-28)

The application and self-hosted Supabase are running on this server. DNS points
`dostavita.by` to `201.34.159.235`, `www` to `dostavita.by`, and `api` to the server IP.
Nginx terminates HTTPS; certificates for the application and API renew using Certbot's nginx plugin.
The server has a 2 GB swap file. UFW permits SSH, HTTP and HTTPS; database/API container ports bind only to loopback.

The source Supabase project is retained for recovery. Its application tables and
Storage objects/buckets have `dostavita_migration_freeze` statement triggers to
reject writes, preventing split-brain operation while old DNS/client caches expire.
Do not unfreeze the source or reverse DNS after new writes without reconciling data.
Vercel is also retained; it is no longer the destination of the primary domain.

Private source exports are in `/opt/dostavita/private/backup-20260928T142845Z` and
`/opt/dostavita/private/final-data.sql`, with a second copy on the operator's Mac.
The final export's 52 COPY blocks matched the initial export. All 18 application
table row counts and all 13 password hashes were verified after restoration.
Eight Storage objects were restored and verified with SHA-256. Four avatar URLs
were updated to the new API hostname. Existing push keys were preserved.

Five empty Auth tables/column layouts absent from the pinned self-hosted version
were omitted only in the working import (`data.compatible.sql`); original exports
are unchanged. No nonempty table was omitted.

Existing users must sign in again because the new instance uses new signing keys.
SMTP has not been configured or validated; email delivery remains a follow-up.

## Layout

- `/opt/dostavita/app`: this repository.
- `/opt/dostavita/supabase`: upstream Supabase Docker distribution pinned to `self-hosted/v0.8.2`.
- `/opt/dostavita/private`: mode 0700; runtime environment and database exports, files mode 0600.
- Application container binds localhost:3000; API gateway localhost:8000; PostgreSQL ports localhost only.
- Reverse proxy must expose only application and intended Supabase API paths over HTTPS. Do not publish Studio, metadata API or database ports.

## Migration gates

1. Export source roles, schema, data (including Auth), and Storage objects using official Supabase migration instructions. Keep original exports intact and private.
2. Initialize self-hosted Supabase with new generated secrets; never start default credentials. Match extensions and PostgreSQL version.
3. Restore on the new, isolated instance. Schema exports can omit ACLs, auth-schema triggers and Realtime publications. Apply migrations 123–126 after restoration, then run `psql -v ON_ERROR_STOP=1 -f deploy/verify-database.sql`. Confirm effective grants (including column grants), table counts, auth users, order/payment functions, RLS policies and private storage objects. A successful import or passing source tests alone is not a deployment gate.
4. Build application with destination public URL/key. Supply service role and VAPID private key only at runtime. Preserve push keys or arrange re-subscription.
5. Test on a separate staging hostname: login for roles, driver/company links, balances, orders, concurrent acceptance/payment, file uploads, realtime and push. Configure working SMTP before registration email tests.
6. For final cutover, stop writes on the old app, take a fresh final export and import, verify counts and then change application DNS. Do not allow independent writes to old and new databases.
7. Keep Vercel and original Supabase for rollback. After new writes begin, rollback requires reconciliation; it is not just a DNS reversal.

## Build/run

Use the official Docker repository for Docker Compose supporting `!override`.

```sh
docker compose --env-file /opt/dostavita/private/app.env -f deploy/compose.app.yml up -d --build
```

Combine upstream `docker-compose.yml` with `deploy/compose.supabase.private.yml` when running Supabase. Keep compose project settings consistent between invocations. Never run upstream reset scripts against imported data.

A database dump does not include Storage file content, SMTP configuration, or OAuth provider configuration. Migration must cover these independently.

## Audit repairs (2026-09-28)

Migrations 123–126 restore effective grants and restrictive financial policies, company order assignment, input validation, atomic location writes, signup profiles, Realtime publications and private chat photos. Existing balances are never rewritten by these migrations. Preserve a fresh full database dump before applying them. After migration, run the invariant checker and exercise authenticated HTTP/Realtime/Storage against an isolated environment.

The private photo path is `driver-org-chat/<organization>/<driver-or-general>/<uploader>/<uuid>.<ext>`. Messages keep the object path; the application issues short-lived signed URLs after Storage authorizes the reader. Do not make this bucket public.

When renaming containers in an isolated stack, preserve the Realtime network alias `realtime-dev.supabase-realtime`: upstream Envoy uses that DNS name and tenant host. Missing this alias causes WebSocket 503 even with a correct database publication.

Migration 126 allows multiple push devices per user while retaining unique endpoints and owner-only RLS. Mobile push requires an explicit permission button and confirmed server registration. GPS retries transient errors and refreshes on reconnect/visibility; background execution on physical phones still requires device testing. SMTP setup is deferred at the owner's request.
