# Curases (Medusa Backend + Next.js Storefront)

This repository contains the Curases commerce project as a Medusa v2 setup:

- `backend`: Medusa server and admin.
- `storefront`: Next.js storefront connected to the Medusa backend.

## Tech Stack

- Medusa v2 (`@medusajs/medusa` 2.14.x)
- PostgreSQL (required by Medusa)
- Next.js storefront (port `8000`)
- Medusa backend/admin (port `9000`)

## Prerequisites

Based on Medusa docs:

- Node.js `>=20` and `<25` recommended for backend + Next.js starter compatibility.
- npm (repo uses npm lockfiles).
- PostgreSQL database.
- Git.

## Project Structure

- `backend/`: Medusa app (`medusa-config.ts`, API routes, jobs, workflows, modules).
- `storefront/`: Next.js storefront that consumes Medusa Store APIs.

## Environment Setup

### 1) Backend

Copy and fill backend env:

```bash
cp backend/.env.template backend/.env
```

Required backend variables:

- `DATABASE_URL`: PostgreSQL connection string.
- `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`: allowed origins.
- `JWT_SECRET`, `COOKIE_SECRET`: secure random strings.

Example with Supabase pooler (replace password):

```env
DATABASE_URL=postgresql://postgres.lnkgpshnahbqnmffvmgs:YOUR_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
```

Notes:

- Use URL format from Medusa docs: `postgres://[user][:password]@[host][:port]/[dbname]`
- `backend/medusa-config.ts` reads `process.env.DATABASE_URL`.

### 2) Storefront

Ensure `storefront/.env.local` contains:

- `NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000`
- `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=<your_publishable_key>`
- `NEXT_PUBLIC_DEFAULT_REGION=<existing region code in your Medusa backend>`

## Install Dependencies

Install per app:

```bash
cd backend && npm install
cd ../storefront && npm install
```

## Database Commands (Medusa)

From `backend/`:

```bash
npx medusa db:setup
npx medusa db:migrate
```

Then optionally seed (if seed script/data exists in your setup):

```bash
npx medusa exec ./src/scripts/seed.ts
```

## Running Locally

Start backend:

```bash
cd backend
npm run dev
```

Start storefront:

```bash
cd storefront
npm run dev
```

Expected local URLs:

- Backend/Admin: `http://localhost:9000`
- Storefront: `http://localhost:8000`

## Why `npx medusa db:migrate` May Fail

Common causes:

1. `DATABASE_URL` is empty or invalid in `backend/.env`.
2. Wrong DB credentials or special characters in password not URL-encoded.
3. Database is unreachable from your machine (network/firewall).
4. PostgreSQL user lacks required permissions.
5. Command not executed from `backend/` where `@medusajs/cli` is installed.
6. Node version mismatch (`<20` or unsupported).

Quick checks:

```bash
cd backend
node -v
npm ls @medusajs/cli
npx medusa --version
```

If Supabase is used:

- Confirm password is correct.
- Keep host/port/database exactly as provided.
- Prefer the provided transaction pooler string for IPv4 compatibility.

## GitHub Push Workflow

If remote is new or recreated:

```bash
git push --force https://github.com/ABDELKABIR-KH/curases.git main:main
```

If remote history should be preserved:

```bash
git push https://github.com/ABDELKABIR-KH/curases.git main:main
```

## Medusa Documentation References

- [Medusa installation](https://docs.medusajs.com/learn/installation)
- [Medusa environment variables](https://docs.medusajs.com/learn/fundamentals/environment-variables)
- [Medusa config `databaseUrl`](https://docs.medusajs.com/learn/configurations/medusa-config#databaseurl)
- [Next.js starter storefront](https://docs.medusajs.com/resources/nextjs-starter)

