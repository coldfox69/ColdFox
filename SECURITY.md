# ColdFox Security

## Security Model

### Multi-Tenancy
- Every tenant table has `organization_id` column
- Row Level Security (RLS) policies enforce `is_org_member(organization_id)` for all tenant access
- Client-supplied `organization_id` is never trusted; server derives it from session + membership
- Active organization from `cf_org_id` cookie, validated against user's memberships

### Authentication & Authorization
- Supabase Auth handles user accounts (email/password, OAuth)
- Server-side session validation via `@supabase/ssr`
- Role-based access: `owner`, `admin`, `member`, `viewer`
- Platform admin via explicit `grant_platform_admin(email)` (never auto-assigned)
- `requireApiSession(roles)` enforces role-based access on API routes

### Data Protection
- Mailbox credentials encrypted at rest using `MAILBOX_ENCRYPTION_KEY`
- Service role key used for all server-side writes (bypasses RLS intentionally)
- User RLS is defense-in-depth, not primary access control
- Audit logging for all mutations (actor, action, entity, metadata)
- Rate limiting on all API endpoints (per-user, per-endpoint)

### Secrets Management
- `.env.local` is gitignored (never committed)
- `.env.example` contains variable names only, no values
- No tokens or keys printed to logs
- Gmail/Microsoft OAuth secrets absent → marked "not configured"
- Billing provider absent → checkout returns 503

### Email Compliance
- Suppression list for unsubscribes, hard bounces, spam complaints
- Unsubscribe links via `/api/unsubscribe?token=...` with signed tokens
- RFC 8058 one-click unsubscribe support via POST
- No spam-filter evasion claims or deceptive practices
- AI writer instructed to avoid deceptive subject lines and unsupported claims

## Known Gaps

| Area | Status | Notes |
|------|--------|-------|
| Gmail OAuth | Not configured | No Google Cloud project credentials |
| Microsoft Graph | Not configured | No Entra app credentials |
| Billing | Not configured | Checkout returns 503 |
| Webhook secrets | Not configured | Webhook endpoints exist but unverified |
| E2E tests | Not implemented | Unit tests only |
| SOC2 / compliance | Not certified | Self-assessed only |

## Incident Response

- Suspected compromise: rotate `MAILBOX_ENCRYPTION_KEY`, `CRON_SECRET`, `UNSUBSCRIBE_TOKEN_SECRET`
- Data breach: review `audit_logs`, suspend affected organizations via `organizations.is_suspended`
- Abuse complaints: review `email_complaints` and `email_bounces` tables, add to suppression list
