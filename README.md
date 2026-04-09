# OpenResolve

A self-hosted, privacy-first case management platform for personal legal disputes, consumer rights claims, and insurance cases. Your data stays on your machine.

## Quick Start

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET and ADMIN_PASSWORD at minimum
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000) and log in with your admin credentials.

## Features

- **Case management** — create, track, escalate, and close cases
- **Case types** — road traffic accident, consumer rights, insurance, landlord/tenant, financial complaint, or custom
- **Timeline** — every action appended chronologically; notes, calls, documents, emails, status changes
- **Document store** — upload PDFs, images, and files; tagged by type (evidence, correspondence, medical, legal)
- **Call notes** — log calls with caller, number, duration, outcome, and follow-up flag
- **Reminders & deadlines** — browser notifications for overdue items
- **Rights & guidance** — jurisdiction-aware rights info per case type (editable markdown files)
- **Export** — full case PDF summary or ZIP (files + JSON metadata)
- **Email ingestion** — paste emails manually (always available) or configure a per-case alias for automatic ingestion (opt-in)

## Email Ingestion (Optional)

Two modes:

**Simple mode** (always on) — use the "Add Email" action in any case to paste email content manually.

**Alias mode** (opt-in) — each case gets a unique address like `case-OR-2024-ABCD@cases.yourdomain.com`. Inbound emails are automatically attached to the case.

Setup with Cloudflare Email Routing:
1. Add `EMAIL_DOMAIN` and `WEBHOOK_SECRET` to your `.env`
2. Start with the email overlay: `docker compose -f docker-compose.yml -f docker-compose.email.yml up -d`
3. In Cloudflare, create an Email Worker that POSTs to `https://yourdomain.com/api/webhook/email` with `X-Webhook-Secret: <WEBHOOK_SECRET>`

## Rights Content

Rights guidance lives in `rights-content/<jurisdiction>/` as editable markdown files. Add new jurisdictions or edit existing content — no database migration needed.

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + Tailwind CSS |
| Backend | Node.js + Express |
| Database | SQLite (via better-sqlite3) |
| File storage | Local filesystem |
| Export | PDFKit + archiver |
| Auth | JWT (single-user or family mode) |
| Deployment | Docker Compose |

## Development

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

Backend runs on :3001, frontend dev server on :5173 (proxies /api to backend).

## Data Location

All data is stored in a named Docker volume (`openresolve-data`). To back up:

```bash
docker run --rm -v openresolve-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/openresolve-backup.tar.gz /data
```
