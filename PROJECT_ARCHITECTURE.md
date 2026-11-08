# ColdFox Project Architecture

## Overview

ColdFox is a multi-tenant SaaS platform for AI-powered cold email outreach and CRM. Built with Next.js 16 App Router, TypeScript, Supabase, and deployed on Vercel.

## Tech Stack

- **Framework**: Next.js 16.4.5 (App Router, Turbopack)
- **Language**: TypeScript (strict mode)
- **Database**: Supabase Postgres (multi-tenant with RLS)
- **Auth**: Supabase Auth (email/password, OAuth, PKCE)
- **Cache/Storage**: Supabase Storage
- **AI**: Groq (server-side, llama-3.3-70b-versatile)
- **Email**: SMTP/IMAP, Gmail OAuth, Microsoft Graph OAuth
- **Styling**: Tailwind CSS v4, shadcn/ui components
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **Testing**: Vitest + Testing Library
- **Deployment**: Vercel

## Project Structure

```
project/
├── src/
│   ├── app/                    # Next.js App Router routes
│   │   ├── (public)/           # Public pages (home, features, pricing, etc.)
│   │   ├── app/                # Authenticated dashboard routes
│   │   ├── admin/              # Admin panel routes
│   │   ├── api/                # API routes (REST)
│   │   ├── auth/               # Auth routes (login, signup, callback)
│   │   ├── layout.tsx          # Root layout
│   │   ├── not-found.tsx       # 404 page
│   │   └── page.tsx            # Home page
│   ├── components/
│   │   ├── admin/              # Admin-specific components
│   │   ├── campaign/           # Campaign wizard components
│   │   ├── layout/             # Layout shells (App, Admin, Public)
│   │   ├── leads/              # Lead management components
│   │   ├── mailbox/            # Mailbox connection components
│   │   ├── shared/             # Shared UI components
│   │   └── templates/          # Template editor components
│   ├── lib/
│   │   ├── ai/                 # Groq AI modules (email, columns, support)
│   │   ├── auth/               # Session context, auth helpers
│   │   ├── client/             # Client-side API helpers
│   │   ├── data/               # Server-side data loaders
│   │   ├── email/              # Email engine, providers, templates, deliverability
│   │   ├── import/             # Spreadsheet import pipeline
│   │   ├── http.ts             # API route handlers, auth guards, rate limiting
│   │   ├── validation.ts       # Zod input schemas
│   │   ├── view-models.ts      # Shared UI view models and mappers
│   │   └── crypto.ts           # Encryption for mailbox credentials
│   └── views/
│       ├── app/                # Dashboard views
│       ├── auth/               # Auth views
│       └── public/             # Public marketing views
├── supabase/
│   └── migrations/             # SQL migrations (0001-0009)
├── scripts/
│   └── apply-migrations.mjs    # Migration runner
├── vercel.json                 # Vercel deployment config (cron, env)
├── vitest.config.ts            # Vitest configuration
├── tsconfig.json               # TypeScript configuration
├── next.config.ts              # Next.js configuration
├── package.json                # Dependencies and scripts
└── .env.example                # Environment variable template
```

## Architecture Decisions

### Multi-Tenancy

- Every tenant table has `organization_id` column with RLS policies
- Client-side `organization_id` is never trusted; server derives it from session
- Active organization from `cf_org_id` cookie + membership
- `is_org_member(organization_id)` SQL function for RLS checks

### Authentication

- Supabase Auth handles user accounts
- Session cookies managed server-side via `@supabase/ssr`
- Middleware protects routes (deprecated in Next 16, using proxy instead)
- `requireOrganization()` redirects to onboarding if no org
- `requireAdmin()` redirects to `/app` if not platform admin

### Email Sending

- Status distinguishes `accepted` (provider) from `delivered`
- Ambiguous send failures are NOT auto-retried (prevents duplicates)
- Suppression list for unsubscribes, hard bounces, complaints
- Unsubscribe links via `/api/unsubscribe?token=...` (RFC 8058)
- No fake AI fallback: email generation returns 503 if `GROQ_API_KEY` missing

### Job Queue

- Durable DB-backed job queue (`background_jobs` table)
- Vercel cron invokes `/api/cron/worker` every 5 minutes
- `claim_background_jobs` RPC for workers to claim jobs

### AI

- Groq server-side only; no keys in frontend/git
- Column analysis has deterministic heuristic fallback
- Email generation returns 503 if GROQ_API_KEY missing
- No spam-evasion claims; compliance-focused prompts

## Security

- `.env.local` is gitignored; `.env.example` has names only
- Service role key used for server writes; user RLS is defense-in-depth
- Mailbox credentials encrypted at rest (`MAILBOX_ENCRYPTION_KEY`)
- Rate limiting on all API endpoints
- Audit logging for all mutations
- Admin bootstrap via explicit `grant_platform_admin(email)`
