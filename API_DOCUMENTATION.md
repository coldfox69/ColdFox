# ColdFox API Documentation

## Base URL

All API routes are under `/api/`. Requests and responses use JSON envelopes:

```json
{ "ok": true, "data": { ... } }
```

or

```json
{ "ok": false, "error": "message", "code": "error_code" }
```

## Authentication

Most endpoints require a valid Supabase session cookie. Admin endpoints require platform admin status.

`requireApiSession(roles?)` - validates session and optionally checks role (`owner`, `admin`, `member`, `viewer`).
`requireApiSession(false)` - allows users without an organization (for onboarding).

## Endpoints

### Health

**GET** `/api/health`
Returns service status. No auth required.

### Campaigns

**GET** `/api/campaigns`
List campaigns for the organization.

**POST** `/api/campaigns`
Create a campaign. Body: `{ name, description, mailbox_id, template_id, timezone, daily_limit, lead_ids[], subject, body, follow_up_days, send_window_start, send_window_end, weekdays[], stop_on_reply }`

**GET** `/api/campaigns/[id]`
Get campaign details.

**PATCH** `/api/campaigns/[id]`
Update campaign.

**DELETE** `/api/campaigns/[id]`
Cancel/delete campaign.

**POST** `/api/campaigns/[id]/launch`
Launch campaign. Body: `{ mode: 'now' | 'schedule', send_at?: string }`

**POST** `/api/campaigns/[id]/pause`
Pause campaign.

**POST** `/api/campaigns/[id]/resume`
Resume campaign.

### Leads

**GET** `/api/leads`
List leads with pagination, search, status filter.

**POST** `/api/leads`
Create a lead. Body: lead input fields.

**GET** `/api/leads/[id]`
Get lead details.

**PATCH** `/api/leads/[id]`
Update lead. Body: partial lead fields. `notes` inserts a lead note.

**DELETE** `/api/leads/[id]`
Soft-delete lead.

**GET** `/api/leads/export`
Export leads as CSV.

**POST** `/api/leads/import/analyze`
Analyze uploaded spreadsheet. Multipart: `file`.

**POST** `/api/leads/import/confirm`
Confirm and import leads. Multipart: `file`, `mapping` (JSON).

### Templates

**GET** `/api/templates`
List templates.

**POST** `/api/templates`
Create template. Body: `{ name, subject, body_text, category, tags[], is_shared }`

**GET** `/api/templates/[id]`
Get template details.

**PATCH** `/api/templates/[id]`
Update template.

**DELETE** `/api/templates/[id]`
Archive template.

### Mailboxes

**GET** `/api/mailboxes`
List mailboxes + OAuth provider config flags.

**POST** `/api/mailboxes`
Create/connect mailbox.

**GET** `/api/mailboxes/[id]`
Get mailbox details.

**PATCH** `/api/mailboxes/[id]`
Update mailbox settings.

**DELETE** `/api/mailboxes/[id]`
Disconnect mailbox.

**POST** `/api/mailboxes/[id]/test`
Test mailbox connection.

**GET** `/api/mailboxes/oauth/[provider]/start`
Start OAuth flow (gmail, microsoft).

**GET** `/api/mailboxes/oauth/[provider]/callback`
OAuth callback handler.

### AI

**POST** `/api/ai/email`
Generate/rewrite/optimize email. Body: `{ mode, prompt, tone, subject?, body?, lead?, sender?, context? }`
Modes: `generate`, `rewrite`, `optimize`, `subjects`, `follow_up`

**POST** `/api/ai/columns`
Analyze spreadsheet columns. (Called from import analyze)

**POST** `/api/ai/support`
AI support response generation.

### Inbox

**GET** `/api/inbox`
List conversation threads.

**GET** `/api/inbox/sync`
Sync inbox from connected mailboxes.

**GET** `/api/inbox/[id]`
Get thread details.

**PATCH** `/api/inbox/[id]`
Archive/assign thread.

**GET** `/api/inbox/[id]/read`
Mark thread as read.

**POST** `/api/inbox/[id]/reply`
Reply to thread.

### Analytics

**GET** `/api/analytics`
Campaign and delivery analytics.

### Suppression

**GET** `/api/suppression`
List suppression entries + reasons.

**POST** `/api/suppression`
Add suppression entry. Body: `{ email, reason_key, notes? }`

**DELETE** `/api/suppression?id=...`
Remove suppression entry.

### Deliverability

**GET** `/api/deliverability`
List sending domains + DNS checks.

**POST** `/api/deliverability`
Check domain authentication. Body: `{ domain, dkim_selector? }`

**DELETE** `/api/deliverability?id=...`
Remove domain.

### Support

**GET** `/api/support/tickets`
List support tickets.

**POST** `/api/support/tickets`
Create ticket. Body: `{ subject, description, category_key?, priority }`

**GET** `/api/support/tickets/[id]`
Get ticket + messages.

**POST** `/api/support/tickets/[id]`
Add message. Body: `{ body }`

**PATCH** `/api/support/tickets/[id]`
Update ticket status.

### Settings

**PATCH** `/api/settings`
Update profile and/or organization settings.

### Onboarding

**POST** `/api/onboarding`
Complete onboarding. Body: onboarding form fields.

### Organization

**POST** `/api/org/switch`
Switch active organization.

### Notifications

**POST** `/api/notifications/read`
Mark notifications as read.

### Unsubscribe

**GET** `/api/unsubscribe?token=...`
Show unsubscribe confirmation page.

**POST** `/api/unsubscribe?token=...`
RFC 8058 one-click unsubscribe.

### Billing

**GET** `/api/billing/plans`
List available plans.

**POST** `/api/billing/checkout`
Returns 503 (`billing_not_configured`) until a billing provider is set.

### Cron

**POST** `/api/cron/worker`
Worker tick: process due jobs, send campaign executions, sync inboxes. Requires `Authorization: Bearer ${CRON_SECRET}`.

### Webhooks

**GET/POST** `/api/webhooks/[provider]`
Handle incoming webhooks (email events, bounces, complaints).

### Admin

**GET** `/api/admin/overview`
Platform-wide metrics.

**GET/PATCH/POST** `/api/admin/[module]`
Generic admin module endpoint. Modules: `users`, `organizations`, `subscriptions`, `plans`, `campaigns`, `mailboxes`, `email-activity`, `ai-usage`, `api-usage`, `tickets`, `announcements`, `feature-flags`, `system-health`, `jobs`, `errors`, `audit`, `roles`, `webhooks`, `abuse`, `integrations`, `settings`.

All admin endpoints require `requirePlatformAdmin(permission)`.

## Error Codes

| Code | Description |
|------|-------------|
| `not_found` | Resource not found |
| `invalid_state` | Invalid state transition |
| `plan_limit` | Plan limit reached |
| `ai_credit_limit` | AI credits exhausted |
| `duplicate_lead` | Lead email already exists |
| `ticket_closed` | Support ticket is closed |
| `billing_not_configured` | Billing provider not set |
