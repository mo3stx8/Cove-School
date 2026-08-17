<p align="center">
  <img src="logo/Cove-Logo2-NBG.png" alt="Cove School Logo" width="120">
</p>

<h1 align="center">Cove School</h1>

<p align="center">
  A full-stack School Management System for small-to-medium schools.<br/>
  Built by <strong>SiliconCove Company</strong> (Aogolo).
</p>

---

## Overview

Cove School (SiliconCove-SMS) digitizes core academic and administrative workflows in one place, with full **bilingual (English / Arabic)** support including RTL layout.

**Roles:** Super Admin, Admin, Teacher, Accountant, Student, Parent — each with its own dashboard and permission scopes.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Laravel 12 (PHP 8.2+) |
| **API** | REST JSON (`/api/v1`) |
| **Database** | PostgreSQL (production) / SQLite (tests) |
| **Auth** | Laravel Sanctum (token-based) |
| **Permissions** | Spatie Laravel Permission (teams mode) |
| **Frontend** | React 19 + TypeScript + Vite |
| **Styling** | Tailwind CSS v4 |
| **i18n** | i18next (English + Arabic, RTL) |
| **HTTP Client** | Axios |
| **PDF** | barryvdh/laravel-dompdf |
| **Linting** | Oxlint (frontend) / Laravel Pint (backend) |

---

## Project Structure

```
SiliconCove-SMS/
├── backend/          # Laravel 12 API
│   ├── app/
│   │   ├── Enums/            # 9 PHP enums (status types)
│   │   ├── Http/Controllers/ # 17 REST controllers
│   │   ├── Models/           # 32 Eloquent models
│   │   ├── Policies/         # 16 authorization policies
│   │   ├── Services/         # 10 service classes
│   │   └── Support/          # AuditLogger, NumberGenerator, TenantContext
│   ├── database/migrations/  # 22 migrations
│   └── routes/api.php        # ~80+ endpoints
│
├── frontend/         # React SPA
│   └── src/
│       ├── components/   # UI kit (form.tsx, ui.tsx, Toast.tsx)
│       ├── context/      # AuthContext
│       ├── i18n/         # en.ts, ar.ts (497 keys each)
│       ├── lib/          # api.ts, types.ts, format.ts
│       └── pages/        # 17 page components
│
├── logo/             # Brand assets
└── Project description.txt
```

---

## Features

### Academic
- **Setup Wizard** — Multi-step onboarding (school profile, admin, academic year, terms, grades, fee types)
- **Academic Structure** — Grades, subjects, classes, academic years, terms, grade scales
- **Attendance** — Per-class sessions, present/absent/late/excused, correction workflow
- **Exams & Grading** — Marks entry, submit/review/publish pipeline, report cards (PDF)
- **Assignments** — Publish per class/subject, student submissions, grading
- **Timetable** — Weekly period timetable with conflict detection

### Administration
- **Students** — Enrollment, archive/restore, class assignment, guardian linking, activation emails
- **Teachers** — Full CRUD, archive/restore, subject assignment
- **Classes** — CRUD, subject assignment, student enrollment
- **Announcements** — Targeted by audience (everyone/teachers/students/parents/class)

### Finance
- **Fee Types** — CRUD with auto-generated codes (e.g. FT-0001)
- **Invoices** — Generation, status tracking (paid/partial/unpaid/overdue/cancelled), due date management
- **Payments** — Recording, receipt generation (PDF), search/filtering
- **Reports** — Finance summary, collection rates, outstanding balances

### Reports & Portal
- **Reports** — Student stats, attendance rates, academic performance, finance overview, CSV export
- **Portal** — Student/parent portal for grades, attendance, fees, assignments
- **Notifications** — In-app notification feed with read/unread tracking

### Key Capabilities
- **Bilingual naming** — Grades, subjects, classes carry both English and Arabic names
- **RTL support** — Full right-to-left layout when Arabic is selected
- **Audit logging** — Write operations tracked across the system
- **Role-based dashboards** — Different overview content per role
- **Email activation** — New users receive activation links via SMTP
- **Rate limiting** — Login (5/min), password reset (3/10min), API (300/min authed)

---

## Roles & Permissions

| Role | Access |
|------|--------|
| **Super Admin** | Cross-school wildcard access |
| **Admin** | Full school management (38 permissions) |
| **Teacher** | Classes, students, attendance, exams, assignments |
| **Accountant** | Students (read), fees, payments, reports |
| **Student** | Own grades, attendance, assignments, timetable |
| **Parent** | Linked children's data |

---

## Getting Started

### Prerequisites

- PHP 8.2+
- Composer
- Node.js 18+
- PostgreSQL (or SQLite for local dev)

### Backend Setup

```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate
php artisan db:seed    # Seeds roles and permissions
composer dev            # Runs server, queue, logs, and Vite concurrently
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev            # Starts Vite dev server with API proxy
```

The frontend proxies `/api` requests to `http://127.0.0.1:8000`.

### First Login

1. Open the setup wizard at `/setup`
2. Register your school and admin account
3. Complete the wizard (academic year, terms, grades, fee types)
4. Start enrolling students and teachers

---

## API

All endpoints are under `/api/v1/` and require a Sanctum Bearer token.

| Domain | Endpoints |
|--------|-----------|
| Auth | login, logout, me, profile, password, activation, forgot/reset |
| Setup | school registration, setup progress, school update |
| Academic | CRUD for years, terms, grades, subjects, grade scales |
| Classes | CRUD, subject assignment, student assignment |
| Students | CRUD, archive/restore, class assignment |
| Teachers | CRUD, archive/restore |
| Timetable | Per-class timetable, entries, conflict detection |
| Attendance | Grid, take, corrections |
| Exams | CRUD, marks, workflow, corrections |
| Assignments | CRUD, submissions, grading, attachments |
| Fees | Fee types, invoices, payments, receipts (PDF), summary |
| Announcements | CRUD with audience targeting |
| Notifications | List, unread count, mark read |
| Reports | Students, attendance, academic, finance, CSV, report cards |

---

## License

Proprietary &mdash; SiliconCove Company (Aogolo). All rights reserved.
