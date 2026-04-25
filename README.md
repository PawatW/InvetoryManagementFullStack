# Grading System

ระบบจัดการคะแนนและการส่งงานสำหรับสถาบันการศึกษา สร้างด้วย Next.js 14 (App Router), Prisma ORM, และ NextAuth.js v5

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) + TypeScript strict |
| Styling | Tailwind CSS + shadcn/ui |
| ORM | Prisma + PostgreSQL |
| Auth | NextAuth.js v5 (Credentials / JWT) |
| Validation | Zod + react-hook-form |
| UI Extras | sonner, lucide-react, date-fns, recharts |

## Project Structure

```
.
├── app/
│   ├── (auth)/login/          # Login page
│   ├── (dashboard)/           # Protected dashboard routes
│   │   ├── admin/             # Admin views
│   │   ├── instructor/        # Instructor views
│   │   └── student/           # Student views
│   ├── api/auth/[...nextauth] # NextAuth handler
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── ui/                    # shadcn/ui primitives
│   └── providers.tsx          # SessionProvider wrapper
├── lib/
│   ├── db.ts                  # Prisma client singleton
│   ├── auth-utils.ts          # getCurrentUser, requireRole helpers
│   └── utils.ts               # cn() utility
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Development seed data
├── types/
│   └── next-auth.d.ts         # Session type augmentation
├── auth.ts                    # NextAuth configuration
├── middleware.ts               # Route protection
└── .env.example
```

## Roles

| Role | Dashboard | Permissions |
|------|-----------|-------------|
| ADMIN | `/dashboard/admin` | จัดการผู้ใช้, ดูภาพรวมระบบ |
| INSTRUCTOR | `/dashboard/instructor` | จัดการคอร์ส, ตรวจงาน, ให้คะแนน |
| STUDENT | `/dashboard/student` | ส่งงาน, ดูคะแนน, รับ notification |

## Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd <repo-dir>
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env
# แก้ไข .env ให้ถูกต้อง
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Random secret (ใช้ `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | URL ของแอป (dev: `http://localhost:3000`) |

### 3. Database

```bash
npx prisma migrate dev --name init
npm run seed
```

### 4. Run Dev Server

```bash
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

## Test Accounts (Seed Data)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@uni.ac.th | admin123 |
| Instructor | smith@uni.ac.th | inst123 |
| Instructor | jones@uni.ac.th | inst123 |
| Student | student1@uni.ac.th | std123 |
| Student | student2@uni.ac.th | std123 |
| Student | student3@uni.ac.th | std123 |
| Student | student4@uni.ac.th | std123 |
| Student | student5@uni.ac.th | std123 |
| Student | student6@uni.ac.th | std123 |

## Database Schema Overview

```
User ──< Course (as Instructor)
User ──< Enrollment >── Course
Course ──< Assignment ──< Submission ──── Grade
Assignment ──< RubricCriteria
Submission >── User (Student)
User ──< Notification
```
