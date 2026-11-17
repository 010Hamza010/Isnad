# إسناد — Isnad

A personal web app for a shaykh or a student to record their **أسانيد** (chains of transmission),
for the **المتون** (classical texts) and the **قرآن** (qiraat / riwayat / turuq). You enter only your
direct links: who you read with, and who they read with. The app builds every chain up to the
author or to the Prophet ﷺ, writes it as isnad prose with تحويل, and issues verifiable **إجازات**.

The interface is Arabic, right to left. One installation belongs to one person: the account is
created on first run, and there is no public registration.

**Contents:** [Features](#features) · [How it works](#how-it-works) · [Getting started](#getting-started) ·
[Configuration](#configuration-backendenv) · [Updating](#updating-an-existing-installation) ·
[Your data](#your-data) · [Project structure](#project-structure) · [API](#api) · [Tests](#tests) ·
[Known gaps](#known-gaps)

---

## Features

### Persons — «الأعلام»
- **One profile per person:** name, kunya, nisba, death year, century, region, gender and bio. The
  mutoon and the Quran share it.
- **A permanent code per person,** so the same person is recognised across installations.
- **Built for long lists:**
  - pages of 50, with search, filters and sorting kept in the URL;
  - filters: imams, rawis, century, region, «يحتاج إكمالاً» (no death year, century or link);
  - sorting: by name, death year or number of links.
- **The century fills itself** from the hijri death year («852هـ» → 9).
- **«دمج في علَم آخر»:** merges a duplicate into the person you keep. It shows what will move
  before it does anything, and moves links, authorship, imam / rawi roles and teacher orders.
- **Forgiving search,** everywhere: tashkeel, Quranic marks, hamza forms, ة/ه, Persian letters,
  invisible characters from copy-paste, Arabic-Indic digits, and «ابن» = «بن».

### Links and routes
- **Matn links:** each link is for one matn, or **general** («عام — لكل المتون»). A general link to
  your own shaykh opens every matn he holds. Links above him count only when they name the matn.
- **Quran links:** one link can carry several qiraat / riwayat / turuq, groups («العشر الصغرى»,
  «الحرميان»…), the books read «بمضمنها» (الشاطبية، الدرة، الطيبة), «عام — كل القراءات», the
  reading mode («غيباً من حفظي / نظراً»), the number of khatmat, the date and how you met.
- **Automatic routes:** every path from you to the author, or to the Prophet ﷺ, is found, numbered
  and grouped by shaykh.
  - A Quran chain that stops short is marked **منقطع**.
  - You can switch routes off per matn or per riwaya.
- **Fast entry:** paste an isnad as text. The names are matched against your persons, you check
  them, and everything is saved in one step.

### Isnad text
- **Configurable wording:** keywords («أخبرنا، حدثنا، عن»…) or clear sentences («قرأتُ على
  شيخنا فلان، وهو قرأ على …»), per transmission kind and per gender. Optionally death years and
  full names (kunya in its case + nisba).
- **Each link written once (matn isnads):**
  - my teachers taken the same way, together: «قرأتُ على شيخنا زياد، وشيخنا عمار، كلاهما سمع من محمد وهب»;
  - a short split as «كلاهما»: «عن ربيع، وعن شريح، كلاهما عن الفاسي»;
  - «ح» only where a route stops to wait for another;
  - never «ح» after a route that reaches the author;
  - «وأرويه أيضاً سماعاً من شيخنا فلان بسنده المتقدم» for a teacher whose sanad is already written.
- **Details:** [`backend/src/services/isnadText/README.md`](backend/src/services/isnadText/README.md).

### Ijazat
- **Generated from your isnad:**
  - for a matn, or for several Quran choices at once (riwayat, whole qiraat, groups);
  - the teachers paragraph follows your saved order;
  - a later Quran paragraph points back with «بإسناده المتقدم»;
  - a group's isnad stops at ابن الجزري («وإسناده موجود في كتابه النشر…»).
- **Two versions:** normal, and detailed with footnotes, full names and a tree.
- **The document:** designs and templates, export to PDF, freezing, and an archive.
- **Verification:** a signed QR code and a short code (`ISN-XXXX-XXXX`). The verification page
  says whether an ijaza is valid, revoked or altered.
- **Revoke, correct or delete:** a revoked ijaza can be re-enabled or deleted for good. A valid one
  must be revoked first; after deletion its QR code shows «غير موجودة».

### Data and account
- **Share one isnad** as a file. The importer shows who is who and what will be written before
  anything is saved.
- **Export or import a whole thabat:** mutoon, general and Quran links with their books, groups and
  «عام», master data, bios. An import merges and skips what already exists.
- **Full backup and restore.** The current data is kept automatically before every restore.
- **Account:** username, password, sign out other devices, and a profile (full name, short name,
  gender, place) used in ijazat and isnad text.

---

## How it works

```
 your links ──► routes ──► isnad text ──► ijaza
 (DB)          (graph)     (isnadText)     (template + certificate)
```

1. **Links.** A link is «student → shaykh», for a matn or for Quran items. Person `0` is you.
2. **Routes.** `services/graphService.js` walks the links from you up to the target: the matn's
   author, or the rawi / imam / النبي ﷺ for the Quran. The Quran rules (rawi → imam → النبي ﷺ,
   «منقطع», groups, turuq as labels) live in `services/quranChain.js` and `quranGroupIsnad.js`.
3. **Isnad text.** `services/isnadText/render.js` turns the routes into prose.
   - **Matn isnads** are written from the network of links: each link once.
   - **Quran isnads** stay route by route. عاصم gave حفص his riwaya through السلمي and شعبة
     through زر, so links can't be freely combined there.
4. **Ijaza.** The page (`frontend/src/pages/ijazat/NewIjaza.jsx`) fills your template with the
   isnad, the teachers paragraph and the dates. The certificate
   (`frontend/src/components/ijaza/Certificate.jsx`) lays it out, colours the names and paginates.

---

## Getting started

Requirements: Node.js 18+ and MySQL 8 or MariaDB.

### 1. Database

Use your own MySQL / MariaDB server, or the database service in `docker-compose.yml`:

```bash
docker compose up -d db        # MySQL on :3306 with an empty isnad_db
```

Without Docker, create an empty database:

```bash
mysql -u root -p -e "CREATE DATABASE isnad_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
```

The tables are created in step 2. `migrations/000_base.sql` holds the base schema and the
reference data: the ten qurra and their rawis, qiraat / riwayat / turuq, common mutoon and their
authors, and the transmission types. The later files add everything since.

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

**Production:** the backend serves the app itself from `backend/views/` (a committed build), so
`npm start` in `backend/` is enough: open http://localhost:4000. To rebuild it after frontend changes:

```bash
cd frontend && npm run build && rm -rf ../backend/views && cp -r dist ../backend/views
```

Commit it as «Build <frontend commit>». Anything outside `/api` gets `index.html`, so the app's own
routes work on reload. Hashed files in `/assets` are cached for a year; `index.html` never is.
`FRONTEND_DIR` in `.env` points elsewhere if needed. Without a build, the server is API only.

### Scripts

| Where      | Command                    | What it does                                               |
|------------|----------------------------|------------------------------------------------------------|
| `backend`  | `npm run dev` / `start`    | API with nodemon / plain node                              |
| `backend`  | `npm test`                 | Unit tests (no database needed)                            |
| `backend`  | `npm run migrate`          | Apply pending `migrations/NNN_name.sql`                    |
| `backend`  | `npm run migrate:status`   | List applied / pending migrations                          |
| `backend`  | `npm run backup [-- file]` | Plain-SQL dump to `backend/backups/` (no mysqldump needed) |
| `frontend` | `npm run dev`              | Vite dev server                                            |
| `frontend` | `npm run build`            | Production build to `frontend/dist/`                       |
| `frontend` | `npm test`                 | Unit tests                                                 |

---

## Configuration (`backend/.env`)

| Variable      | Default      | Notes |
|---------------|--------------|-------|
| `PORT`        | `4000`       | API port |
| `DB_HOST`     | `localhost`  | |
| `DB_PORT`     | `3306`       | |
| `DB_USER`     | `root`       | |
| `DB_PASSWORD` |              | |
| `DB_NAME`     | `isnad_db`   | |
| `JWT_SECRET`  |              | **Required**, 32+ characters. The server refuses to start without it, or with the example value. |
| `JWT_EXPIRES` | `7d`         | Session length without «remember me» (with it: 30 days). |
| `QR_SECRET`   | `JWT_SECRET` | Optional. Signs the ijaza QR codes: keep it stable, or older QR codes stop verifying. |
| `FRONTEND_DIR` | `backend/views` | Optional. The built app the server serves (none → API only). |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Never commit `.env`.

---

## Updating an existing installation

```bash
git pull
cd backend && npm install && npm run migrate
cd ../frontend && npm install && npm run build
```

- `npm run migrate` applies only what is pending, and every migration can be run again safely.
- On a database made before the migrations existed, `000_base.sql` is recorded without running,
  so your data is not touched.
- Check with `npm run migrate:status`.

| Migration | Adds |
|---|---|
| 001–010 | user settings, ijazat (styles, verification, archive, two versions), reading mode, gender, transmission kinds, account |
| 011 | person codes and `person_links` (sharing between installations) |
| 012 | books read «بمضمنها» on Quran links |
| 013 | «عام — كل القراءات» on Quran links |
| 014 | Quran groups |
| 015 | drops `persons.primary_qiraa_id` (imams and rawis come from the qiraat and riwayat) |

---

## Your data

**Backups.** Use «الإعدادات ← النسخ والنقل ← تنزيل نسخة احتياطية», or `npm run backup` in
`backend/`. Take one before a large import or a merge.

**Duplicates.** An import may create a person you already have under another spelling. Merge it
with «دمج في علَم آخر» on the «الأعلام» page. A chain that suddenly stops reaching the author is
often a duplicate: the links reach the copy, not the author.

**Looking inside the database.** `backend/sql/inspect.sql` holds read-only queries:
- find a person;
- matn and Quran links person → person, readable;
- everything around one person;
- the chains going up from a person;
- mutoon with their links;
- what was added in the last day.

Run them block by block in the mysql client, phpMyAdmin or DBeaver.

---

## Project structure

```
.
├── docker-compose.yml
├── Isnad-API.postman_collection.json
├── backend/
│   ├── config/db.js
│   ├── migrations/                000_base.sql (schema + reference data), then NNN_name.sql
│   ├── scripts/                   migrate.js, backup.js
│   ├── sql/inspect.sql            read-only queries to look into the data
│   ├── views/                     the built frontend, served by the backend (committed builds)
│   ├── src/
│   │   ├── index.js               Express app, routes mounted under /api
│   │   ├── frontend.js            serves backend/views (index.html for the app routes)
│   │   ├── routes/ controllers/   HTTP layer
│   │   ├── models/                SQL access (PersonModel.merge: merging duplicates)
│   │   ├── services/
│   │   │   ├── graphService.js    routes from me to the target
│   │   │   ├── quranChain.js, quranGroups.js, quranGroupIsnad.js   Quran rules
│   │   │   ├── isnadText/         chains ↔ isnad prose, تحويل (see its README.md)
│   │   │   ├── ijaza/, shareIsnad.js, thabat.js, personMerge.js, …
│   │   ├── middleware/            auth (JWT + token version), error handler
│   │   └── utils/
│   └── test/
└── frontend/
    ├── vite.config.js
    ├── src/
    │   ├── routes.js              navigation, titles
    │   ├── pages/                 mutoon, quran, ijazat, shared (persons, graph, settings…)
    │   ├── components/            isnad views, ijaza certificate, UI kit
    │   ├── utils/                 ijaza text, Quran options, person list, search (text.js)…
    │   ├── context/ hooks/
    │   └── styles/
    └── test/
```

---

## API

Every endpoint is under `/api` and needs `Authorization: Bearer <token>`, except `/health`,
`/auth/status`, `/auth/setup` and `/auth/login`. In link bodies, `from_person_id: 0` means you.

| Area | Endpoints |
|------|-----------|
| Auth | `GET /auth/status` · `POST /auth/setup` · `POST /auth/login` · `GET /auth/me` · `PUT /auth/username` · `PUT /auth/password` · `POST /auth/logout-others` |
| Profile | `GET/PUT /profile` |
| Persons | `GET/POST /persons` (the list includes `links_count`) · `PUT/DELETE /persons/:id` · `POST /persons/:id/merge` `{ into, dry_run }` |
| Mutoon | `GET/POST /mutoon` · `PUT/DELETE /mutoon/:id` |
| Links | `/matn-connections`, `/quran-connections`: `GET/POST /`, `PUT/DELETE /:id` |
| Quran master data | `/quran/qiraat`, `/quran/riwayat`, `/quran/turuq`, `/quran/groups` (CRUD) · `POST /quran/groups/known` (adds the well-known groups) |
| Transmission types | `GET /tx-types` · `GET /tx-types/kinds` · `PUT /tx-types/:id/kind` |
| Routes and graph | `GET /graph/matn/:id/paths` · `GET /graph/quran/paths?riwaya_id=&tariq_id=&qiraa_id=` · `GET /graph/quran/group-paths?group_id=&mode=stop/all/riwaya&riwaya_id=` · `PUT /graph/disabled-routes/:scope` · `GET /graph/full?module=` · `GET /graph/heights` |
| Isnad text | `GET/PUT/DELETE /isnad-text/settings` · `POST /isnad-text/render` · `POST /isnad-text/parse` · `POST /isnad-text/import` |
| Ijazat | `GET/PUT/DELETE /ijazat/settings` · `GET /ijazat/teacher-orders` · `PUT /ijazat/teacher-orders/:key` · `POST /ijazat/verify` · `GET/POST /ijazat` · `GET /ijazat/:id` · `DELETE /ijazat/:id` (only a revoked ijaza) · `POST/DELETE /ijazat/:id/revoke` · `POST /ijazat/:id/freeze` · `GET /ijazat/:id/document` · `POST/GET /ijazat/:id/pdf` |
| Share | `GET /share/matn/:id` · `GET /share/quran` · `POST /share/preview` · `POST /share/import` · `GET /share/thabat` · `POST /share/thabat/preview` · `POST /share/thabat/import` |
| Backup | `GET /data/summary` · `GET /data/backup` · `GET /data/backup/pre-restore` · `POST /data/restore` |

`Isnad-API.postman_collection.json` has a ready request for most endpoints. Run **Auth → Setup**
(or **Login**) first: the token is stored in the `token` collection variable and sent with every
other request.

---

## Tests

```bash
cd backend && npm test      # services, models with a stubbed database, controllers
cd frontend && npm test     # utils: ijaza text, chains, person list, search, certificate…
```

No database or browser is needed. The isnad writer has the most tests
(`backend/test/isnadText.test.js`), including real isnads (`realData.test.js`).

---

## Known gaps

- **Docker:** the `backend` and `frontend` services in `docker-compose.yml` expect a `Dockerfile`
  in each folder, and none is included yet. Only the `db` service works.
- **Quran isnads** are still written route by route. Forks in the middle of a Quran chain can
  repeat a part of it.
- **The «كلاهما» meeting setting** (`tahwilMeet: joined`) and **routes switched off** also use
  the route-by-route writer.
- **No browser tests:** the interface is checked by hand.
