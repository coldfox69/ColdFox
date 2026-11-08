# ColdFox

AI-powered cold email outreach and CRM platform for modern sales teams.

## Overview

ColdFox helps sales teams run thoughtful, compliant cold email outreach with AI writing, CRM, unified inbox, deliverability checks, and durable sending infrastructure.

## Features

- **AI Lead Analysis**: Import CSV/XLSX spreadsheets, automatic column mapping with AI suggestions
- **AI Email Writer**: Generate, rewrite, and optimize cold emails using Groq (no spam-evasion claims)
- **Campaign Management**: Create, schedule, pause, resume, and track outreach campaigns
- **CRM**: Lead management with tags, activities, notes, and follow-up reminders
- **Unified Inbox**: Sync and manage conversations across all connected mailboxes
- **Mailbox Integrations**: SMTP/IMAP, Gmail OAuth, Microsoft Graph OAuth
- **Deliverability Center**: SPF/DKIM/DMARC domain authentication checks
- **Suppression List**: Automatic handling of unsubscribes, bounces, and complaints
- **Analytics**: Campaign performance, reply rates, bounce rates, mailbox health
- **Automations**: Follow-up sequences and campaign triggers
- **Support**: Ticket system and knowledge base
- **Admin Panel**: 22-module platform administration console
- **Multi-tenant**: Secure organization isolation with Row Level Security

## Tech Stack

- Next.js 16.4.5 (App Router, Turbopack)
- TypeScript (strict)
- Supabase (Postgres, Auth, Storage)
- Groq AI (server-side)
- Tailwind CSS v4
- Vitest (unit testing)
- Vercel (deployment)

## Quick Start

### Development

```bash
cd project
cp .env.example .env.local
# Fill in .env.local with your values
npm install
npm run dev
```

Open http://localhost:3000

### Production Deployment

See `DEPLOYMENT_GUIDE.md` for full deployment instructions.

```bash
# Build
npm run build

# Start
npm start
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the required values:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Yes | Application URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `GROQ_API_KEY` | Yes | Groq API key |
| `MAILBOX_ENCRYPTION_KEY` | Yes | Encryption key (openssl rand -base64 32) |
| `CRON_SECRET` | Yes | Cron worker secret |
| `ADMIN_BOOTSTRAP_EMAIL` | Yes | First admin email |

## Project Structure

- `src/app/` - Next.js App Router routes
- `src/components/` - React components
- `src/lib/` - Core libraries (AI, email, auth, validation, etc.)
- `src/views/` - Page-level view components
- `supabase/migrations/` - Database migrations
- `vercel.json` - Vercel deployment configuration
- `vitest.config.ts` - Test configuration

## Documentation

- `PROJECT_ARCHITECTURE.md` - System architecture
- `DATABASE_SCHEMA.md` - Database schema and migrations
- `API_DOCUMENTATION.md` - API reference
- `IMPLEMENTATION_PLAN.md` - Implementation status and roadmap
- `DEPLOYMENT_GUIDE.md` - Deployment instructions
- `SECURITY.md` - Security model and controls

## License

Private - ColdFox
