# Timeweb deployment

Project: Dostavita (2975851). Dedicated server: 9220153, 201.34.159.235.
Ubuntu 24.04, Novosibirsk NSK-1, 2 CPU, 4 GB RAM, 50 GB NVMe disk.
Monthly total: RUB 1,800 (server 1,300 + one backup 300 + public IPv4 200).
The unused server 9219953 and its public IP were deleted before ordering this replacement.
Existing sites and servers are separate.

This budget configuration has limited memory headroom for the application and Supabase.
Measure memory usage under load before cutover; build application images outside the production server where possible.

This is deployment preparation, not confirmation of a completed migration.

## Layout

- `/opt/dostavita/app`: this repository.
- `/opt/dostavita/supabase`: upstream Supabase Docker distribution pinned to `self-hosted/v0.8.2`.
- `/opt/dostavita/private`: mode 0700; runtime environment and database exports, files mode 0600.
- Application container binds localhost:3000; API gateway localhost:8000; PostgreSQL ports localhost only.
- Reverse proxy must expose only application and intended Supabase API paths over HTTPS. Do not publish Studio, metadata API or database ports.

## Migration gates

1. Export source roles, schema, data (including Auth), and Storage objects using official Supabase migration instructions. Keep original exports intact and private.
2. Initialize self-hosted Supabase with new generated secrets; never start default credentials. Match extensions and PostgreSQL version.
3. Restore on the new, isolated instance. Confirm table counts, auth users, order/payment functions, RLS policies and storage objects.
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
