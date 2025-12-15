# Converge - Setup Guide

This guide will walk you through setting up the Converge real-time collaboration platform.

## Prerequisites

Before starting, ensure you have:

- **Node.js** >= 18.0.0
- **npm** or **yarn**
- **PostgreSQL** database (local or cloud)
- **Git** (optional, for version control)

## Quick Start

### 1. Clone and Install Dependencies

```bash
cd converge
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Then edit `.env` and configure:

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/converge` |
| `JWT_SECRET` | Secret key for JWT tokens | (generate a secure random string) |

#### Generate JWT Secret

Run this command to generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and paste it as your `JWT_SECRET` in `.env`.

### 3. Set Up PostgreSQL Database

#### Option A: Local PostgreSQL

1. Install PostgreSQL if you haven't already
2. Create a new database:

```sql
CREATE DATABASE converge;
```

3. Update `DATABASE_URL` in your `.env` file

#### Option B: Cloud PostgreSQL (e.g., Supabase, Railway, Neon)

1. Create a new project on your preferred platform
2. Get the connection string from the dashboard
3. Replace `DATABASE_URL` in your `.env` file

### 4. Initialize the Database

Generate Prisma client and run migrations:

```bash
# Generate Prisma client
npm run db:generate

# Create database tables
npm run db:push
# OR for a proper migration:
npm run db:migrate
```

### 5. Start Development Server

You have two options for development:

#### Option A: Next.js Only (without WebSocket)

```bash
npm run dev
```

This starts Next.js at `http://localhost:3000` but WebSocket features won't work.

#### Option B: Full Stack with WebSocket (Recommended)

Open **two terminals**:

**Terminal 1 - Socket.IO Server:**
```bash
npm run dev:server
```

**Terminal 2 - Next.js Development:**
```bash
npm run dev
```

Then visit `http://localhost:3000`

## Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js development server |
| `npm run dev:server` | Start Socket.IO server with hot reload |
| `npm run build` | Build Next.js for production |
| `npm run start` | Start production Next.js server |
| `npm run db:migrate` | Run database migrations |
| `npm run db:push` | Push schema changes to database |
| `npm run db:studio` | Open Prisma Studio (database GUI) |
| `npm run db:generate` | Generate Prisma client |
| `npm run lint` | Run ESLint |

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Next.js App    │◄───►│  Socket.IO      │◄───►│  PostgreSQL     │
│  (Frontend)     │     │  Server         │     │  (Database)     │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 │ (Optional)
                                 ▼
                        ┌─────────────────┐
                        │                 │
                        │     Redis       │
                        │   (Pub/Sub)     │
                        │                 │
                        └─────────────────┘
```

### Core Technologies

- **Frontend**: Next.js 16 with React 19, Tailwind CSS 4
- **WebSocket**: Socket.IO for real-time communication
- **CRDT**: Yjs for conflict-free collaborative editing
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT-based with bcrypt password hashing

## Project Structure

```
converge/
├── app/                      # Next.js App Router pages
│   ├── (auth)/              # Auth pages (login, register)
│   ├── (dashboard)/         # Protected dashboard pages
│   ├── api/                 # API routes
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Landing page
├── components/              # React components
│   ├── collaboration/       # Collaboration UI components
│   ├── editor/              # Document editor
│   ├── providers/           # Context providers
│   └── ui/                  # Reusable UI components
├── hooks/                   # Custom React hooks
│   ├── use-socket.ts        # WebSocket connection hook
│   └── use-crdt-document.ts # CRDT document hook
├── lib/                     # Core libraries
│   ├── auth/                # Authentication utilities
│   ├── crdt/                # CRDT implementation
│   ├── db/                  # Database client
│   └── utils/               # Utility functions
├── prisma/                  # Database schema
│   └── schema.prisma        # Prisma schema definition
├── server/                  # Server-side code
│   ├── socket/              # Socket.IO server
│   └── index.ts             # Custom server entry
├── types/                   # TypeScript type definitions
└── public/                  # Static assets
```

## Features

### Authentication
- User registration with email/password
- JWT-based session management
- Protected routes and API endpoints

### Documents
- Create, read, update, delete documents
- Rich text collaborative editing
- Auto-save with debouncing (3-second delay)

### Collaboration
- Real-time presence indicators
- Live cursor tracking
- Typing indicators
- Role-based permissions (Owner, Editor, Viewer)

### Access Control
| Role | View | Edit | Delete | Manage Collaborators |
|------|------|------|--------|---------------------|
| Owner | ✅ | ✅ | ✅ | ✅ |
| Editor | ✅ | ✅ | ❌ | ❌ |
| Viewer | ✅ | ❌ | ❌ | ❌ |

## Production Deployment

### Build for Production

```bash
# Build Next.js
npm run build

# Build server (if needed)
npm run build:server
```

### Environment Variables for Production

Set these environment variables:

```env
NODE_ENV=production
DATABASE_URL=your-production-database-url
JWT_SECRET=your-secure-production-secret
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_SOCKET_URL=https://your-domain.com
```

### Scaling with Redis

For horizontal scaling (multiple server instances), configure Redis:

```env
REDIS_URL=redis://your-redis-server:6379
```

The Socket.IO server is already configured to use Redis adapter when `REDIS_URL` is provided.

## Troubleshooting

### Database Connection Issues

1. Verify PostgreSQL is running
2. Check `DATABASE_URL` format
3. Ensure the database exists
4. Try `npm run db:push` to sync schema

### WebSocket Not Connecting

1. Ensure Socket.IO server is running (`npm run dev:server`)
2. Check `NEXT_PUBLIC_SOCKET_URL` matches server URL
3. Verify no firewall blocking WebSocket connections

### Prisma Issues

```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Regenerate client
npm run db:generate
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License - See LICENSE file for details.
