# إسناد — Isnad

A personal web app for a shaykh or student to record their **أسانيد** (chains of transmission) for **المتون** (classical texts) and the **قرآن** (qiraat / riwayat / turuq), see every chain up to the author or to the Prophet ﷺ, and issue verifiable **إجازات** to students.

You only enter direct links (who you read with, and who they read with). The app builds the full chains by itself.

The interface is Arabic and right-to-left. One instance belongs to one person: the account is created on first run and there is no public registration.

## Features

**Isnads**
- **Persons (الأعلام)**: one profile per person (name, kunya, nisba, death year, region, gender, bio), shared by the mutoon and Quran modules. Each person has a permanent code so they can be matched across instances.
- **Matn links**: a link is either for one matn or **general** («عام — لكل المتون»). A general link to your own shaykh opens every matn he holds. Links above him only count when they name the matn.
- **Quran links**: one link can cover several qiraa / riwaya / tariq items, with nested turuq, khatmat count, date, meeting and reading mode.
- **Automatic routes**: every path from you to the author or to the Prophet ﷺ is resolved, numbered and grouped by shaykh. Chains that stop short are shown as munqatiʿ. You can switch individual routes off per matn or per riwaya.
- **Isnad views**: tree, prose text (configurable wording, tahwil «ح», restarts with «ويرويه»), reading mode and the full vis-network graph.
- **Fast entry**: paste an isnad as text. Names are resolved against your persons, you review them, and the persons and links are saved in one step.

**Ijazat**
- Generate an ijaza from your isnad (normal or detailed with margin notes and a tree), with designs and templates. Export to PDF, freeze the document and keep it in the archive.
- Every ijaza carries a signed QR code and a short code (`ISN-XXXX-XXXX`). The verification page checks whether it is valid, revoked or altered.

**Data**
- Share one isnad as a file (by names and person codes). The importer previews who is who before writing anything.
- Export or import your whole **thabat** (mutoon, general and Quran links with their books, groups and «عام», master data, bios). The import merges and skips what already exists.
- Full backup and restore from the settings page. The previous data is kept automatically before every restore.

**Account**
- Change your username or password, sign out other devices, and set your profile (full name, short name, gender, place) used in ijazat and isnad text.

## Stack

| Layer    | Technology                                                        |
|----------|-------------------------------------------------------------------|
| Backend  | Node.js, Express, mysql2, JWT (jsonwebtoken), bcryptjs            |
| Database | MySQL 8 / MariaDB                                                 |
| Frontend | React 18, Vite, React Router, vis-network, jsPDF, html2canvas, qrcode |
| Tests    | Node's built-in test runner (`node --test`)                       |

## Getting started

Requirements: Node.js 18+ and MySQL 8 or MariaDB.

### 1. Database

Use your own MySQL server, or start the one in `docker-compose.yml`:

```bash
docker compose up -d db        # MySQL on :3306 with an empty isnad_db
```

Without Docker, create an empty database:

```bash
mysql -u root -p -e "CREATE DATABASE isnad_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
```

The tables are created in step 2 by `npm run migrate`. `migrations/000_base.sql` holds the base schema and the reference data (the ten qurra and their rawis, qiraat / riwayat / turuq, common mutoon and their authors, transmission types). The later files add everything since then.

### 2. Backend

```bash
cd backend
cp .env.example .env           # set DB_* and JWT_SECRET (see below)
npm install
npm run migrate                # create / update the tables (safe to re-run)
npm run dev                    # API on http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                    # http://localhost:5173, proxies /api → :4000
```

Open the app. On first run, the login page asks you to create the account.

For production, run `npm run build` in `frontend/` and serve `frontend/dist/` behind a web server that proxies `/api` to the backend. The `backend` and `frontend` services in `docker-compose.yml` expect a `Dockerfile` in each folder, and none is included yet.

## Scripts

| Where      | Command                   | What it does                                                 |
|------------|---------------------------|--------------------------------------------------------------|
| `backend`  | `npm run dev` / `start`   | API with nodemon / plain node                                |
| `backend`  | `npm test`                | Unit tests (no database needed)                              |
| `backend`  | `npm run migrate`         | Apply pending `migrations/NNN_name.sql`                      |
| `backend`  | `npm run migrate:status`  | List applied / pending migrations                            |
| `backend`  | `npm run backup [-- file]`| Plain-SQL dump to `backend/backups/` (no mysqldump needed)   |
| `frontend` | `npm run dev`             | Vite dev server                                              |
| `frontend` | `npm run build`           | Production build to `frontend/dist/`                         |
| `frontend` | `npm test`                | Unit tests                                                   |

## Configuration (`backend/.env`)

| Variable      | Default      | Notes                                   |
|---------------|--------------|-----------------------------------------|
| `PORT`        | `4000`       | API port                                |
| `DB_HOST`     | `localhost`  |                                         |
| `DB_PORT`     | `3306`       |                                         |
| `DB_USER`     | `root`       |                                         |
| `DB_PASSWORD` |              |                                         |
| `DB_NAME`     | `isnad_db`   |                                         |
| `JWT_SECRET`  |              | Required, 32+ characters. The server refuses to start without it or with the example value |
| `JWT_EXPIRES` | `7d`         | Session length without «remember me» (with it: 30 days) |
| `QR_SECRET`   | `JWT_SECRET` | Optional. Signs the ijaza QR codes; keep it stable or old QR codes stop verifying |

Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Never commit `.env`.

**Existing database?** `npm run migrate` records `000_base.sql` as applied without running it when the tables already exist, so your data is not touched.

## Project structure

```
.
├── docker-compose.yml
├── Isnad-API.postman_collection.json
├── backend/
│   ├── config/db.js
│   ├── migrations/                000_base.sql (schema + reference data), then NNN_name.sql
│   ├── scripts/                   migrate.js, backup.js
│   ├── src/
│   │   ├── index.js               Express app, routes mounted under /api
│   │   ├── routes/ controllers/   HTTP layer
│   │   ├── models/                SQL access
│   │   ├── services/              path engine, isnad text, ijaza, share/thabat, backup
│   │   ├── middleware/            auth (JWT + token version), error handler
│   │   └── utils/
│   └── test/
└── frontend/
    ├── vite.config.js
    ├── src/
    │   ├── routes.js              navigation, titles
    │   ├── pages/                 mutoon, quran, ijazat, shared (persons, graph, settings…)
    │   ├── components/            isnad views, ijaza certificate, UI kit
    │   ├── context/ hooks/ utils/
    │   └── styles/
    └── test/
```

## API

Every endpoint is under `/api` and needs `Authorization: Bearer <token>`, except `/health`, `/auth/status`, `/auth/setup` and `/auth/login`. In link bodies, `from_person_id: 0` means you.

| Area | Endpoints |
|------|-----------|
| Auth | `GET /auth/status` · `POST /auth/setup` · `POST /auth/login` · `GET /auth/me` · `PUT /auth/username` · `PUT /auth/password` · `POST /auth/logout-others` |
| Profile | `GET/PUT /profile` |
| Persons, mutoon | `GET/POST /persons`, `PUT/DELETE /persons/:id` · same for `/mutoon` |
| Links | `/matn-connections`, `/quran-connections` (CRUD) |
| Quran master data | `/quran/qiraat`, `/quran/riwayat`, `/quran/turuq` (CRUD) |
| Transmission types | `GET /tx-types` · `GET /tx-types/kinds` · `PUT /tx-types/:id/kind` |
| Routes and graph | `GET /graph/matn/:id/paths` · `GET /graph/quran/paths?riwaya_id=&tariq_id=&qiraa_id=` · `GET /graph/quran/group-paths?group_id=&mode=stop/all/riwaya&riwaya_id=` · `PUT /graph/disabled-routes/:scope` · `GET /graph/full?module=` |
| Isnad text | `GET/PUT/DELETE /isnad-text/settings` · `POST /isnad-text/render` · `POST /isnad-text/parse` · `POST /isnad-text/import` |
| Ijazat | `GET/PUT/DELETE /ijazat/settings` · `GET /ijazat/teacher-orders` · `PUT /ijazat/teacher-orders/:key` · `POST /ijazat/verify` · CRUD on `/ijazat` · `POST/DELETE /ijazat/:id/revoke` · `POST /ijazat/:id/freeze` · `GET /ijazat/:id/document` · `POST/GET /ijazat/:id/pdf` |
| Share | `GET /share/matn/:id` · `GET /share/quran` · `POST /share/preview` · `POST /share/import` · `GET /share/thabat` · `POST /share/thabat/preview` · `POST /share/thabat/import` |
| Backup | `GET /data/summary` · `GET /data/backup` · `GET /data/backup/pre-restore` · `POST /data/restore` |

`Isnad-API.postman_collection.json` has a ready request for each endpoint. Run **Auth → Setup** (or **Login**) first: the token is stored in the `token` collection variable and sent with every other request.
