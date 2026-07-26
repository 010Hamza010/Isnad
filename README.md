# إسناد — Isnad Management App

A full-stack web application for managing **أسانيد** (chains of transmission) for both **متون** (classical texts) and **قرآن** (Quranic recitation).

## Features

- **متون module** — manage matn chains: add connections, auto-resolve complete paths to the author
- **قرآن module** — manage Quran chains by قراءة / رواية / طريق
- **Shared persons** — one profile per person, used across both modules
- **Graph view** — vis-network interactive graph of the full transmission network
- **Auto path resolution** — enter only direct connections, the app builds full chains automatically
- **Munqatiʿ support** — incomplete chains are shown naturally when no path reaches the end
- **JWT authentication** — secure login/register

## Stack

| Layer    | Technology             |
|----------|------------------------|
| Backend  | Node.js + Express      |
| Database | MySQL 8                |
| Frontend | React 18 + Vite        |
| Graph    | vis-network            |
| Auth     | JWT + bcryptjs         |
| Deploy   | Docker + docker-compose|

## Quick Start (Docker)

```bash
# 1. Copy env file
cp .env.example .env
# Edit .env — set strong DB_PASSWORD and JWT_SECRET

# 2. Build and run
docker-compose up --build -d

# 3. Open browser
open http://localhost

# 4. Register your account on the login page
```

## Local Development

### Backend
```bash
cd backend
cp ../.env.example .env    # fill in your local MySQL credentials
npm install
npm run dev                # runs on :4000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                # runs on :5173, proxies /api → :4000
```

## Project Structure

```
isnad2/
├── schema.sql                   ← DB schema + seed data
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── config/db.js
│   └── src/
│       ├── index.js
│       ├── middleware/auth.js
│       └── routes/
│           ├── auth.js
│           ├── persons.js
│           ├── txTypes.js
│           ├── mutoon.js
│           ├── matnConnections.js
│           ├── quran.js             ← qiraat / riwayat / turuq
│           ├── quranConnections.js
│           └── graph.js             ← path traversal engine
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── context/AuthContext.jsx
        ├── utils/api.js
        ├── utils/pathResolver.js
        ├── styles/globals.css
        ├── components/shared/
        │   ├── Sidebar.jsx
        │   ├── Modal.jsx
        │   ├── ChainTree.jsx
        │   ├── PersonSelect.jsx
        │   └── EmptyState.jsx
        └── pages/
            ├── shared/Login.jsx
            ├── shared/Persons.jsx
            ├── shared/Graph.jsx
            ├── mutoon/MatnIsnads.jsx
            ├── mutoon/MatnConnections.jsx
            ├── mutoon/MatnList.jsx
            ├── quran/QuranIsnads.jsx
            ├── quran/QuranConnections.jsx
            └── quran/QuranMasterData.jsx
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register user |
| POST | /api/auth/login | Login |
| GET/POST/PUT/DELETE | /api/persons | Persons CRUD |
| GET/POST/PUT/DELETE | /api/mutoon | Mutoon CRUD |
| GET/POST/PUT/DELETE | /api/matn-connections | Matn connections |
| GET/POST/PUT/DELETE | /api/quran/qiraat | Qiraat CRUD |
| GET/POST/PUT/DELETE | /api/quran/riwayat | Riwayat CRUD |
| GET/POST/PUT/DELETE | /api/quran/turuq | Turuq CRUD |
| GET/POST/PUT/DELETE | /api/quran-connections | Quran connections |
| GET | /api/graph/matn/:id/paths | Resolve matn isnad paths |
| GET | /api/graph/quran/paths?riwaya_id= | Resolve quran isnad paths |
| GET | /api/graph/full?module= | Full graph data for vis-network |

## Next Steps (future)

- Export isnad as PDF / image
- Print-ready chain view
- Multiple users with separate isnads
- Quran: عدّ الآيات and رموز الضبط
- Import from existing databases
