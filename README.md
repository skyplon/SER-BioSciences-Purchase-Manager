# SER BioSciences - Farm Purchase Manager

Web app for SER BioSciences (Colombian citrus & cattle farm) to digitize physical invoices from hardware stores and agricultural suppliers using AI-powered OCR.

## Features

- **AI OCR** — Photograph or upload a receipt; GPT vision extracts supplier, date, line items, and totals automatically
- **Editable review** — Confirm and correct extracted data before saving
- **Invoice list** — Search by supplier, filter by category and date range, sortable columns
- **Column visibility** — Toggle which columns are visible; preference is saved locally
- **User tracking** — Records who created or last edited each invoice
- **Dashboard** — Spend summaries by category and supplier
- **Excel export** — Download all invoices and line items as `.xlsx`
- **Notion sync** — Invoices are automatically synced to a Notion database
- **Google login** — Multi-user access via Clerk Auth (Google OAuth)
- **Fully bilingual** — Spanish / English interface (i18n)

## Categories

`Ferretería` · `Agro` · `Veterinaria` · `Combustible` · `Otros`

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Runtime | Node.js 24 |
| Language | TypeScript 5.9 |
| Frontend | React + Vite |
| Backend | Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4 + drizzle-zod |
| API contract | OpenAPI 3 + Orval codegen |
| AI / OCR | OpenAI GPT (vision) via Replit AI proxy |
| Auth | Clerk (Google OAuth) |
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

## API Routes

| Method | Path | Description |
|---|---|---|
| GET | `/api/healthz` | Health check |
| GET | `/api/invoices` | List invoices (filters: category, supplier, startDate, endDate) |
| POST | `/api/invoices` | Create invoice with line items |
| GET | `/api/invoices/summary` | Dashboard stats |
| GET | `/api/invoices/export` | Excel export (base64) |
| GET | `/api/invoices/:id` | Single invoice with items |
| PATCH | `/api/invoices/:id` | Update invoice |
| DELETE | `/api/invoices/:id` | Delete invoice |
| POST | `/api/ocr/extract` | Extract invoice data from image using GPT vision |

## Getting Started

### Prerequisites

- Node.js 24+
- pnpm
- PostgreSQL database

### Environment Variables

```env
DATABASE_URL=           # PostgreSQL connection string
SESSION_SECRET=         # Express session secret
NOTION_API_KEY=         # Notion integration token
DEFAULT_OBJECT_STORAGE_BUCKET_ID=  # Replit object storage
```

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

## License

Private — SER BioSciences
