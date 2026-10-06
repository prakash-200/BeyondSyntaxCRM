# Training Management System

Internal CRM + student, course, batch, fee, attendance and reporting system for a training institute (programming, software development and video editing). **Employees only** — students never log in.

The frontend is complete and runs entirely on an in-browser mock API. The API layer is written against a REST contract so it can be switched to an **ASP.NET Core Web API** without touching the UI.

## Features

- **CRM**: leads, follow-ups (today / overdue / upcoming / completed), applications with visual timeline, lead → application → student conversion (lead history is retained)
- **Students**: profile, 11-tab detail page, status management, CSV import/export, documents (mock upload)
- **Training**: courses + reorderable modules, batches (capacity, transfers with reason), trainers, attendance (bulk "Mark all present"), assignments + grading, module progress
- **Finance**: fee plans (discount, scholarship, custom fee), installments, payments, overpayment guard, refunds, printable invoices, overdue highlighting
- **Certificates**: issue (requires completion), printable preview, **public verification** at `/verify/<id>`
- **Administration**: employees (activate/deactivate), editable role/permission matrix, audit logs, settings
- **Reports**: business, student, financial, employee performance; global search (Ctrl+K); notification centre
- **Audit trail** for every important action, shown as an activity timeline on students, leads, applications, payments and batches

## Tech stack

React 19 · Vite · TypeScript · React Router · Tailwind CSS v4 · TanStack Query · Axios · React Hook Form + Zod · Recharts · Lucide · Zustand (UI state only) · Sonner (toasts). UI primitives (button, dialog on native `<dialog>`, tabs, dropdown…) are hand-written in `src/components/ui` in a shadcn-like style.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build
npm run preview
```

### Environment variables

Copy `.env.example` to `.env`:

```
VITE_API_BASE_URL=http://localhost:5000/api
VITE_APP_NAME=Training Management System
VITE_USE_MOCK_API=true
```

Never put secrets in `VITE_*` variables — they are public in the bundle.

## Demo accounts

Password for all: `Password@123`

| Role | Email |
| --- | --- |
| Super Admin | superadmin@company.com |
| Admin | admin@company.com |
| Counselor | counselor@company.com |
| Accountant | accountant@company.com |
| Trainer | trainer@company.com |

The login page has one-click "Use" buttons for these.

## Mock data

Generated deterministically in `src/mock/seed.ts` (seeded RNG, Indian names, INR, realistic dates): 10 employees, 50 leads, 100 students, 8 courses (65 modules), 10 batches, ~110 applications, ~215 payments, ~3,600 attendance records, 56 assignments, 1,700 audit entries. "Today" is anchored to **05-Oct-2026** (`src/utils/clock.ts`) so the dataset is stable. Data lives in memory — reload to reset (or Settings → Reset demo data).

## Demo walkthrough

1. Counselor → Leads → *Add lead* ("Rahul Kumar", Full Stack .NET) → *Schedule follow-up* → complete it → *Convert → Create application*
2. Admin → Applications → open it → *Approve admission* (creates the student)
3. Admin/Student page → *Assign batch* `DOTNET-OCT-2026-A`
4. Accountant → student → Fees → *Create fee plan* (₹35,000 − ₹5,000 = ₹30,000, 3 installments) → *Record payment* ₹10,000
5. Trainer → Attendance → mark today's class → Progress → update module → Assignments → grade
6. Accountant records the remaining payments; Admin → *Mark completed* → *Issue certificate*
7. Student → Activity tab shows the full history; `/verify/<certificate id>` works logged out

## Architecture

```
src/
├── api/            Axios client + one module per domain (authApi, studentApi, …), token store
├── components/     ui/ (primitives) · common/ · forms/ · tables/ · charts/ · timeline/ · layout/
├── features/       auth, dashboard, leads, applications, students, courses, batches,
│                   attendance, payments, certificates, admin, reports  (pages, dialogs, hooks)
├── mock/           seed data, in-memory db, REST router + axios adapter (the fake backend)
├── constants/      enums, permission matrix, navigation, label/tone maps
├── types/          domain models
├── routes/         route table + guards
├── hooks/ utils/ store/ layouts/ pages/
```

- **Server state** → TanStack Query (query roots are invalidated per workflow, see `hooks/useApiMutation.ts`). **Auth/session** → React Context. **UI state** → Zustand. Forms → React Hook Form + Zod with server-side field errors mapped back onto the form.
- **Statuses** are rendered only through `StatusBadge` (colour + icon + text).
- **Tables** use one `DataTable` + `useListState` (server-side search, filters, sort, pagination).

### Authorization

Permissions are `resource:action` strings (`payments:update`) defined in `src/constants/permissions.ts`. They are enforced in three places:

1. **Routes** – `RequirePermission` guards (`src/routes`)
2. **UI** – `<Can>` / `useAuth().can()` hide actions
3. **API** – the mock server returns **403** for any call the role is not allowed to make, and scopes trainers to their own batches/students and hides financial data from them

The Super Admin can edit the matrix at runtime (Roles & Permissions). Role design notes: counselors get read access to courses/batches because counselling needs them; they cannot touch fees or payments.

### Business rules implemented (and enforced in the mock API)

Outstanding never negative · payment above outstanding needs explicit overpayment · no assignment to completed/cancelled batches · batch capacity · batch transfers need a reason and are audited · fee changes need a reason and are audited · financial records are never deleted (void/refund instead) · students/leads use soft delete · converted leads keep their history · certificates need course completion (or an audited override) · deactivating employees keeps history.

## Connecting the ASP.NET Core API

1. Set `VITE_USE_MOCK_API=false` and `VITE_API_BASE_URL=https://your-host/api`.
2. Implement the REST contract used by `src/api/*.ts` (e.g. `GET /students`, `GET /students/{id}/payments`, `POST /payments`, `POST /auth/login`, `POST /auth/refresh`). Routes, query parameters (`search`, `page`, `pageSize`, `sort`, `order`, `from`, `to`, plus filters) and payloads are all visible in the API modules and in `src/mock/server/handlers/*` — treat those handlers as an executable spec.
3. Lists return `{ items, total, page, pageSize }`; errors should follow `{ status, message, errors?: { field: string[] } }` (ASP.NET `ProblemDetails`-style).
4. Auth: JWT bearer access token + refresh token (`/auth/refresh`). The client retries once after a 401 using the refresh token. Prefer an HttpOnly cookie for the refresh token and add anti-forgery protection if cookie auth is used (see `src/api/tokenStore.ts`).
5. Enforce the same permission claims on the server, derive the audit user/IP from the request, and keep soft-delete and financial rules server-side.

The `src/mock` folder is lazy-loaded and can be deleted once the real API is in place.

## Accessibility & performance

Labelled form fields with inline errors, native dialogs (focus trap, Esc), keyboard-navigable tabs/menus/search, skip link, status never conveyed by colour alone, `prefers-reduced-motion` respected. Routes are lazy-loaded, searches are debounced, and all lists are server-paginated.
