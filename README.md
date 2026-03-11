# ThinkPath AI Learning Platform

ThinkPath is a Next.js + Supabase web platform that supports role-based learning flows:

- Teacher login: upload materials and create adaptive assessments.
- Student login: view materials, submit thinking processes, and receive scaffolded AI prompts.
- Interaction logging: records student-AI guidance for teacher review and partial-credit grading.

## Core Features

- Thinking-first workflow (students submit process before hints)
- Socratic and tiered AI feedback scaffolding
- Teacher dashboard for materials, assessments, and interaction logs
- Student dashboard for submissions and feedback history
- Supabase authentication + role-aware profile records
- SQL schema with Row Level Security (RLS) policies

## Tech Stack

- Next.js (App Router, TypeScript)
- Tailwind CSS v4
- Supabase Auth + Postgres
- Supabase SSR helpers for server/client auth session handling

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Add environment variables:

```bash
cp .env.example .env.local
```

Fill in:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- GITHUB_TOKEN
- GITHUB_MODEL_ENDPOINT (optional, defaults to https://models.inference.ai.azure.com)
- GITHUB_MODEL_NAME (optional, defaults to gpt-4o-mini)

3. In Supabase SQL editor, run the schema:

- supabase/schema.sql

4. Start the app:

```bash
npm run dev
```

Open http://localhost:3000

## Main Routes

- / : Product overview and feature landing page
- /login : Role-aware magic-link login
- /dashboard : Role router (teacher vs student)
- /teacher : Teacher dashboard
- /student : Student dashboard

## Notes

- AI scaffolding uses GitHub Models API when `GITHUB_TOKEN` is configured, and falls back to deterministic local prompts if API access is unavailable.
- OCR, LMS integration, and SSO are architecture-ready extensions to add next.
- Original classroom launcher content is preserved in README.classroom.md.
