# Converge

A real-time collaboration platform where multiple authenticated users can edit shared content simultaneously, see live updates, and handle conflicts gracefully using CRDT (Conflict-free Replicated Data Types).

![Next.js](https://img.shields.io/badge/Next.js-16.0-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-green)
![Yjs](https://img.shields.io/badge/Yjs-CRDT-purple)

## ✨ Features

- **Real-Time Collaboration** - Multiple users can edit documents simultaneously
- **CRDT-Based Sync** - Conflict-free editing using Yjs
- **Live Presence** - See who's online and where they're editing
- **Role-Based Access Control** - Owner, Editor, and Viewer roles
- **JWT Authentication** - Secure user authentication
- **Auto-Save** - Changes are saved automatically with debouncing
- **Dark UI** - Modern, futuristic dark theme

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Configure your database URL and JWT secret in .env

# Push database schema
npm run db:push

# Start development servers (in two terminals)
npm run dev:server  # Terminal 1: Socket.IO server
npm run dev         # Terminal 2: Next.js frontend
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## 📚 Documentation

- [**SETUP.md**](./SETUP.md) - Detailed setup instructions
- [**ARCHITECTURE.md**](./ARCHITECTURE.md) - System architecture and design decisions

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Real-Time | Socket.IO |
| CRDT | Yjs |
| Database | PostgreSQL, Prisma ORM |
| Auth | JWT, bcrypt |
| Language | TypeScript |

## 📁 Project Structure

```
converge/
├── app/                 # Next.js pages and API routes
├── components/          # React components
├── hooks/               # Custom React hooks
├── lib/                 # Core libraries (auth, crdt, db)
├── prisma/              # Database schema
├── server/              # Socket.IO server
└── types/               # TypeScript definitions
```

## 🔐 Access Control

| Permission | Owner | Editor | Viewer |
|------------|-------|--------|--------|
| View Document | ✅ | ✅ | ✅ |
| Edit Content | ✅ | ✅ | ❌ |
| Delete Document | ✅ | ❌ | ❌ |
| Manage Collaborators | ✅ | ❌ | ❌ |

## 📝 License

MIT License
