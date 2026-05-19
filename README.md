# SER BioSciences - Farm Purchase Manager

Web app for SER BioSciences (Colombian citrus & cattle farm) to digitize physical invoices from hardware stores and agricultural suppliers using AI-powered OCR.

## Features

- **AI OCR** — Photograph or upload a receipt; GPT vision extracts supplier, date, line items, and totals automatically
- **Editable review** — Confirm and correct extracted data before saving
- **Invoice list** — Global search, filter by category, supplier and date range, sortable columns
- **Column visibility** — Toggle which columns are visible; preference is saved locally
- **Bulk operations** — Multi-select invoices for bulk delete
- **Suppliers view** — Aggregated stats per supplier (spend, invoice count, last purchase)
- **Calendar view** — Visualize invoice activity by date
- **Dashboard** — Spend summaries by category, supplier, and month
- **Notifications** — In-app notification bell for important events
- **Notion sync** — Invoices are automatically synced to a Notion database
- **Excel export** — Download all invoices and line items as `.xlsx`
- **User tracking** — Records who created or last edited each invoice
- **Multi-user auth** — Sign in with Google or email via Clerk
- **Role-based access** — Admin-only sections protected by middleware (audit log)
- **Audit log / Governance** — Full history of who did what and when, with statistics and Excel export (admins only)
- **Fully bilingual** — Spanish / English interface (i18n)

## Categories

Categories are stored in their canonical Spanish form (used by OCR prompts, database, and Notion sync):

| Category (stored value) | English meaning |
|---|---|
| `Alimentación animal` | Animal feed, concentrates, forage, supplements |
| `Construcción` | Hardware-store and construction materials |
| `Consumibles del Laboratorio` | Lab reagents, lab supplies, analyses |
| `Energía` | Electricity, gas, energy other than fuel |
| `Gasolina` | Gasoline, diesel, ACPM |
| `Limpieza` | Detergents, disinfectants, cleaning supplies |
| `Salud Animal` | Veterinary medicines, vaccines, animal-health products |
| `Transporte` | Freight, cargo and transport services |
| `Otros` | Anything else |

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Runtime | Node.js 24 |
| Language | TypeScript 5.9 |
| Frontend | React + Vite + TanStack Query |
| Backend | Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4 + drizzle-zod |
| API contract | OpenAPI 3 + Orval codegen |
| AI / OCR | OpenAI GPT (vision) via Replit AI proxy |
| Auth | Clerk (Google OAuth + email) |
| Integrations | Notion API |
| Excel export | ExcelJS |
| Build | esbuild (CJS bundle) |

## Project Structure

```
artifacts/
  api-server/        # Express API (PORT env)
  finca-facturas/    # React + Vite frontend
lib/
  db/                # Drizzle schema & migrations
  api-spec/          # OpenAPI specification
  api-client-react/  # Generated React Query hooks
  api-zod/           # Generated Zod validators
scripts/             # Shared utility scripts
```

## Database Tables

- `invoices` — invoice headers (supplier, date, category, total, imageBase64, createdBy/updatedBy)
- `invoice_items` — line items per invoice
- `notifications` — in-app notifications
- `audit_logs` — full audit trail of user/system actions (action, entityType, entityId, user info, before/after diff, metadata)

## API Routes

### Public

| Method | Path | Description |
|---|---|---|
| GET | `/api/healthz` | Health check |

### Authenticated

| Method | Path | Description |
|---|---|---|
| GET | `/api/me/role` | Returns `{ isAdmin: boolean }` for the current user |
| GET | `/api/invoices` | List invoices (filters: search, category, supplier, startDate, endDate) |
| POST | `/api/invoices` | Create invoice with line items |
| POST | `/api/invoices/bulk-delete` | Delete multiple invoices by id |
| GET | `/api/invoices/summary` | Dashboard stats (totals, by category, by supplier, recent) |
| GET | `/api/invoices/export` | Excel export (base64) |
| GET | `/api/invoices/:id` | Single invoice with items |
| PATCH | `/api/invoices/:id` | Update invoice |
| DELETE | `/api/invoices/:id` | Delete invoice |
| GET | `/api/invoices/:id/items` | List items of an invoice |
| POST | `/api/ocr/extract` | Extract invoice data from image using GPT vision |
| GET | `/api/notifications` | List in-app notifications |

### Admin-only (require admin role)

| Method | Path | Description |
|---|---|---|
| GET | `/api/audit-logs` | List audit log entries (filters: search, action, entityType, entityId, userId, dates, limit) |
| GET | `/api/audit-logs/stats` | Aggregated audit statistics (totals, by action/user/entity, daily activity) |
| GET | `/api/audit-logs/export` | Export audit logs to Excel (base64) |

## Authorization Model

All routes except `/api/healthz` require an authenticated Clerk session. The audit log routes additionally require **admin** privileges, enforced by the `requireAdmin` middleware. A user is considered admin if **any** of the following is true:

1. Their Clerk `publicMetadata.role` is `"admin"` (read from the session JWT for speed)
2. Their full Clerk profile has `publicMetadata.role === "admin"` (fallback if claim is stale)
3. Their primary email is listed in the `ADMIN_EMAILS` environment variable (bootstrap / emergency access)

User identity is cached for 5 minutes to minimize Clerk API calls. Any denied access attempt is recorded in the audit log itself with action `access_denied`.

On the frontend, the `useIsAdmin()` hook hides the **Audit Log** link from the sidebar for non-admin users, and the audit page renders a "Restricted access" card if entered via direct URL. Security is enforced server-side — frontend hiding is purely UX.

## Audit Log

The system logs the following actions automatically:

- `created`, `updated` (with before/after diff), `deleted` — for invoices (including bulk delete)
- `exported` — when an Excel export is generated
- `access_denied` — when a non-admin tries to reach an admin route

Each entry stores: action, entity type/id/label, user id/email/name, JSON diff or snapshot, optional metadata, and timestamp. Indexes on `createdAt`, `userId`, and `(entityType, entityId)` keep filters fast.

## Getting Started

### Prerequisites

- Node.js 24+
- pnpm
- PostgreSQL database

### Environment Variables

```env
DATABASE_URL=                       # PostgreSQL connection string
SESSION_SECRET=                     # Express session secret
NOTION_API_KEY=                     # Notion integration token
DEFAULT_OBJECT_STORAGE_BUCKET_ID=   # Replit object storage
ADMIN_EMAILS=                       # Comma-separated emails granted admin (bootstrap)
```

Clerk publishable/secret keys are configured via Replit's Clerk integration; no manual env setup is required.

### Install & Run

```bash
# Install dependencies
pnpm install

# Push database schema
pnpm --filter @workspace/db run push

# Regenerate API client (after OpenAPI changes)
pnpm --filter @workspace/api-spec run codegen

# Run API server
pnpm --filter @workspace/api-server run dev

# Run frontend
pnpm --filter @workspace/finca-facturas run dev
```

### Typecheck

```bash
pnpm run typecheck
```

## Granting Admin Access

There are two ways to make a user admin:

1. **Clerk Dashboard (preferred)** — Open the user in Clerk → Metadata → Public Metadata → add `{ "role": "admin" }`. Takes effect on the next session refresh.
2. **`ADMIN_EMAILS` env var (bootstrap)** — Add the user's email to the comma-separated list and restart the API server. Useful before the Clerk dashboard is fully set up.

To revoke admin rights, remove the role from Clerk and/or remove the email from `ADMIN_EMAILS`. Changes propagate within ~5 minutes (user info cache TTL).

## License

Private — SER BioSciences
