# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Project: Gestor de Facturas Finca

A web application for a Colombian citrus and cattle farm to digitize physical invoices from hardware stores and agricultural suppliers. Uses AI (OpenAI GPT) to extract data from invoice images.

### Features
- Camera capture or image upload of invoices
- AI-powered OCR to extract invoice data (supplier, date, items, totals)
- Editable structured data review before saving
- Invoice list with search and category/date filters
- Dashboard with spend summaries by category and supplier
- Excel export (XLSX) of all invoices and line items
- PostgreSQL database storage

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI Integration**: OpenAI (Replit AI Integrations proxy) - gpt-5.2 for vision/OCR
- **Excel export**: ExcelJS

## Artifacts

- `artifacts/api-server` - Express API server (port via PORT env)
- `artifacts/finca-facturas` - React + Vite frontend at `/`

## Database Tables

- `invoices` - invoice headers (supplier, date, category, total, imageBase64)
- `invoice_items` - line items per invoice

## API Routes

- `GET /api/healthz` - health check
- `GET /api/invoices` - list with filters (category, supplier, startDate, endDate)
- `POST /api/invoices` - create invoice with items
- `GET /api/invoices/summary` - dashboard stats (totals, by category, by supplier, recent)
- `GET /api/invoices/export` - Excel export (base64)
- `GET /api/invoices/:id` - single invoice with items
- `PATCH /api/invoices/:id` - update invoice
- `DELETE /api/invoices/:id` - delete invoice
- `GET /api/invoices/:id/items` - list items
- `POST /api/ocr/extract` - extract invoice data from base64 image using GPT vision

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Categories

Ferretería, Agro, Veterinaria, Combustible, Otros

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
