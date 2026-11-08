# ColdFox Database Schema

## Overview

~60 tables with multi-tenant RLS. All tenant tables have `organization_id` column. RLS policies enforce tenant isolation.

## Migrations

- `0001` - Core tables (organizations, profiles, memberships, plans, subscriptions)
- `0002` - Leads and CRM fields
- `0003` - Mailboxes, messaging, suppression, domains, deliverability
- `0004` - Automations, AI, support, admin, system settings
- `0005` - RLS policies
- `0006` - Security fixes
- `0007` - Usage tracking and limits
- `0008` - Additional indexes and functions
- `0009` - Inbox ownership (`email_threads.assigned_to`)

## Key Tables

### Tenant Tables (all have `organization_id` + RLS)

| Table | Description |
|-------|-------------|
| `organizations` | Tenant workspaces |
| `profiles` | User profiles |
| `organization_members` | User-org memberships with roles |
| `leads` | CRM contacts |
| `campaigns` | Outreach campaigns |
| `campaign_leads` | Campaign-lead assignments |
| `campaign_steps` | Campaign step sequences |
| `campaign_executions` | Per-lead execution records |
| `campaign_settings` | Campaign sending config |
| `email_templates` | Reusable message templates |
| `mailboxes` | Connected sending mailboxes |
| `mailbox_credentials` | Encrypted mailbox credentials |
| `suppression_entries` | Unsubscribes, bounces, complaints |
| `suppression_reasons` | Suppression reason codes |
| `unsubscribe_tokens` | Unsubscribe link tokens |
| `sending_domains` | Domain authentication records |
| `domain_authentication_checks` | DNS check results |
| `email_events` | Send/delivery/reply events |
| `email_threads` | Conversation threads |
| `email_messages` | Individual email messages |
| `lead_notes` | Lead notes |
| `lead_activities` | Lead activity log |
| `lead_tags` / `lead_tag_assignments` | Lead tagging |
| `support_tickets` / `support_messages` | Support system |
| `kb_articles` | Knowledge base |
| `automation_workflows` / `automation_steps` | Automation builder |
| `automation_executions` / `automation_execution_logs` | Automation runs |
| `background_jobs` / `background_job_logs` | Durable job queue |
| `error_logs` | Error tracking |
| `audit_logs` | Audit trail |
| `notifications` | User notifications |
| `feature_flags` | Feature flags |
| `system_settings` | System configuration |
| `announcements` | Platform announcements |
| `rate_limits` | API rate limit tracking |
| `ai_generations` / `ai_usage_records` | AI usage tracking |
| `webhook_events` | Incoming webhooks |
| `admin_roles` / `platform_admins` | Admin RBAC |
| `subscription_plans` | Plan definitions |
| `usages` / `org_usage` | Usage metering |

## RLS Policies

- `tenant_select` / `tenant_insert` / `tenant_update` / `tenant_delete` - tenant isolation via `is_org_member()`
- Read-only policies on messaging/billing/jobs tables for users
- Service role bypasses RLS (used by API routes)
- Platform admin read access to otherwise service-only tables
- Public read on `kb_articles`, `feature_flags`, `announcements`, `system_settings` (public ones)

## Key Functions

- `bootstrap_organization(...)` - Idempotent org creation with owner membership
- `claim_background_jobs(...)` - Claim jobs for worker processing
- `process_unsubscribe(token_hash)` - Public unsubscribe processing
- `check_org_limit(org, metric, increment)` - Plan limit enforcement
- `org_usage(org, metric)` - Current usage check
- `record_usage(org, metric, quantity)` - Usage recording
- `is_suppressed(org, email)` - Suppression check
- `is_org_member(org_id)` - Membership check
- `is_platform_admin()` - Platform admin check
- `has_admin_permission(permission)` - Admin permission check
