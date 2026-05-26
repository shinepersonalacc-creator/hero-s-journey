# Security Architecture

## Trust Boundary

The browser is not trusted for sensitive operations. Users can inspect code, alter requests, replay messages, and forge payloads. Sensitive state must be validated by PostgreSQL functions, RLS, constraints, and Edge Functions.

```
Browser UI
  -> Supabase Edge Function or RPC
    -> auth.uid() validation
    -> RLS and column grants
    -> PostgreSQL constraints/triggers
    -> append-only XP ledger
    -> derived profile XP/level
```

## Current Enforcement

- `profiles.xp` and `profiles.level` are no longer writable by normal frontend table writes.
- XP awards go through `complete_session_task_secure(task_id)`.
- XP awards are recorded in `xp_ledger` with `unique (user_id, source_type, source_id)` to prevent duplicate claims.
- Task completion has server-side ownership validation through `auth.uid()`.
- Task completion has a PostgreSQL rate limit window.
- Session creation uses `create_shared_session_secure(session_name)` with server-generated UUID ids.
- Anonymous reads for `sessions` are removed.
- Session task direct updates are removed from client grants.
- `session_tasks.points` is constrained to `1..10`.
- Session/task text lengths are constrained.
- `user_action_limits` is not client-readable or client-writable.

## Sensitive Data Rules

- Never expose a Supabase `service_role` key to the client.
- Only `VITE_*` values are allowed in browser code, and those must be treated as public.
- Put `SUPABASE_SERVICE_ROLE_KEY`, CAPTCHA secrets, webhook secrets, and payment secrets only in Supabase Edge Function or deployment server environments.
- Rotate secrets immediately if they appear in client bundles, logs, screenshots, or public commits.

## XP and Progression Rules

- Users cannot set XP directly.
- Rewards must be append-only in `xp_ledger`.
- Profile XP is derived by trusted functions from validated reward events.
- Duplicate reward claims are blocked by unique ledger source keys.
- Replay attempts return an already-completed task with `awarded_xp = 0`.
- Hidden/internal reward calculations should live in SQL functions or Edge Functions, not client TypeScript.

## Storage Rules

- Buckets should be private by default.
- File object paths should include the owner id, for example `user_id/file_id`.
- SELECT/INSERT/UPDATE/DELETE policies should validate `auth.uid()` against the path owner or a metadata owner column.
- Use signed URLs for temporary access.
- Public buckets should only be used for intentionally public assets.

## Auth Rules

- OAuth redirect URLs must be allow-listed in Supabase and deployment provider settings.
- Session pages should not expose session metadata to anonymous visitors.
- Server-side endpoints must verify JWTs and use `auth.uid()` for ownership checks.
- Never rely on UI-only checks for host/admin controls.

## Anti-Abuse

- PostgreSQL rate limiting exists for session creation and task completion.
- Add Turnstile/CAPTCHA verification to Edge Functions before high-abuse operations.
- Add IP/device rate limits at the platform edge for auth-heavy or anonymous endpoints.
- Keep expensive operations behind authentication.

## Future Admin, Moderation, Premium

- Store roles in a dedicated table such as `user_roles`.
- Never trust a client-supplied `role`, `is_admin`, `is_premium`, or entitlement flag.
- Admin actions should go through Edge Functions using service-role clients after explicit role checks.
- Premium entitlements should be derived from signed payment webhooks, not client state.
- Moderation writes should use audit logs with actor id, target id, action, reason, and timestamp.

## Production Deployment

- Apply migrations before deploying frontend changes that call new RPC/functions.
- Deploy `complete-session-task` as a Supabase Edge Function.
- Set `SITE_ORIGIN` on Edge Functions to the production origin.
- Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SITE_URL` in Vercel.
- Configure Supabase Auth allowed redirect URLs for production and local development only.
- Review Supabase table editor grants after every schema change.
