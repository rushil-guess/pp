# Personal AI Career — Web (Scaffold)

This folder contains the scaffold for the Next.js + TypeScript web app for the Personal AI Career & Jobs platform.

Quick start (after installing dependencies):

1. Copy `.env.example` -> `.env.local` and configure DATABASE_URL and keys.
2. Run `npm install` in the `web` folder.
3. Run `npx prisma generate` and `npx prisma migrate dev` to initialize the database.
4. Run `npm run dev` to start the dev server.

Architecture notes:
- Next.js (pages) + TypeScript
- Tailwind CSS for styling
- Prisma for DB schema and migrations
- Auth with NextAuth + Supabase for production (or NextAuth provider)
- Background scheduled jobs will be implemented using Supabase Functions / GitHub Actions or Vercel cron.

Deployment:
- Vercel for Next.js
- Supabase Postgres for DB and Storage
- Expo/EAS for iOS builds

Next steps:
- Implement auth routes
- Implement job-source connectors
- Implement news ingestion
- Implement matching engine and recommendation generator
- Implement PWA manifest and service worker
- Create Expo app under /mobile
