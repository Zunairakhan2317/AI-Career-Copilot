# Frontend (Next.js)

The AI Career Co-Pilot web application is a Next.js 16 (App Router) frontend built with React 19 and Tailwind CSS v4. It provides the user interface for resume optimization, job matching, interview preparation, and career planning.

## Features

- **Dashboard** — Overview of career progress and resume statistics
- **Resume Management** — Upload, view, and manage parsed resumes
- **ATS Tailoring** — Tailor resumes for specific job descriptions with live preview
- **Job Matching** — Match resumes against job descriptions with AI scoring
- **Interview Prep** — Conduct mock interviews with AI interviewer
- **Roadmap** — Track career progression milestones
- **Authentication** — Sign up, sign in, and session management
- **Responsive UI** — Mobile navigation with bottom nav bar

## Quick Start

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Environment Setup

```bash
cp .env.example .env
# Add your environment variables
```

### Required Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous client key |

## Project Structure

```
apps/web/
├── app/                     # Next.js App Router
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Landing page
│   ├── (app)/               # Authenticated app layout
│   │   ├── layout.tsx       # App shell (Sidebar + BottomNav)
│   │   ├── dashboard/page.tsx
│   │   ├── resume/page.tsx
│   │   ├── resume/tailor/page.tsx
│   │   ├── jobs/page.tsx
│   │   ├── interview/page.tsx
│   │   ├── roadmap/page.tsx
│   │   └── profile/page.tsx
│   ├── login/page.tsx
│   └── signup/page.tsx
├── components/
│   ├── Sidebar.tsx          # Desktop navigation
│   ├── Navbar.tsx           # Top bar
│   ├── BottomNav.tsx        # Mobile bottom navigation
│   ├── motion/              # Page transition animations
│   │   ├── PageTransition.tsx
│   │   ├── StaggerContainer.tsx
│   │   └── StaggerItem.tsx
│   └── ui/                  # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── badge.tsx
│       ├── progress.tsx
│       ├── dialog.tsx
│       ├── motion-button.tsx
│       └── motion-card.tsx
├── lib/
│   └── auth-context.tsx     # Authentication context provider
├── next.config.ts           # Next.js configuration
├── postcss.config.mjs       # Tailwind CSS config
├── tsconfig.json            # TypeScript config
└── package.json             # Dependencies
```

## Pages

| Route | Description |
|---|---|
| `/` | Landing page |
| `/login` | Sign in |
| `/signup` | Create account |
| `/dashboard` | Career overview |
| `/resume` | Manage resumes |
| `/resume/tailor` | ATS tailoring workspace |
| `/jobs` | Job matching |
| `/interview` | Mock interview |
| `/roadmap` | Career roadmap |
| `/profile` | User profile |

## Styling

- **Tailwind CSS v4** with `@tailwindcss/postcss`
- **shadcn/ui** component library
- **class-variance-authority** for variant management
- **clsx** + **tailwind-merge** for conditional classes
- **framer-motion** for animations (page transitions, staggered lists)

## Authentication

The frontend uses a React context (`lib/auth-context.tsx`) to manage user sessions. JWT tokens are stored client-side and attached to API requests. The auth context provides:

- `user` — Current authenticated user
- `login()` / `signup()` — Auth actions
- `logout()` — Session termination
- `isAuthenticated` — Auth state

## API Integration

The frontend communicates with the FastAPI backend at `http://localhost:8000`. Key endpoints:

- `POST /api/auth/login`, `POST /api/auth/signup`
- `POST /api/resume/upload`, `GET /api/resume/{user_id}`, `POST /api/resume/tailor`
- `POST /api/job-match/`
- `POST /api/interview/start`, `POST /api/interview/message`, `POST /api/interview/end`
- `GET /api/roadmap`

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build production bundle |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## TypeScript

All source files are TypeScript with strict mode enabled. See `tsconfig.json` for configuration.

## Deployment

```bash
npm run build
npm start
```

Deploy to Vercel:
```bash
vercel --prod
```

## License

MIT