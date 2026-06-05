# 🚂 1835 – Digitales Spielbegleitsystem

> Ein webbasiertes Begleitsystem für das Brettspiel **1835** – verwaltet Konten, Spielstände und Geldtransfers direkt am Tisch, optimiert für Tablets.

---

## Quick Start

### 1. Datenbank starten

```bash
docker compose up -d
# oder einmalig:
npm run db:start
```

### 2. Abhängigkeiten & Migration

```bash
npm install
cp .env.example .env   # DATABASE_URL und JWT_SECRET anpassen
DATABASE_URL="postgresql://dev:dev@localhost:5432/1835" npm run db:migrate
```

### 3. Backend starten (Port 3000)

```bash
DATABASE_URL="postgresql://dev:dev@localhost:5432/1835" npm start
```

### 4. Frontend starten (Port 5173)

```bash
cd frontend && npm install && npx vite
```

Dann im Browser öffnen: **http://localhost:5173**

> Das Frontend proxied `/api` → `localhost:3000` (Vite-Config). Beide Server müssen parallel laufen.

### 5. Testen

```bash
# Backend (mit DB, sequentiell wegen Shared-DB)
DATABASE_URL="postgresql://dev:dev@localhost:5432/1835" \
  node --test --test-concurrency=1 test/auth.test.js test/game.test.js

# Frontend
cd frontend && npx tsc --noEmit && npm run lint && npx vitest run
```

---

## Überblick

**1835** ist ein komplexes Eisenbahn-Aktienspiel. Dieses Projekt digitalisiert die Spielverwaltung: Konten, Geldtransfers, Lobby, Pause/Fortsetzen und Leaderboard – damit der Fokus am Tisch auf der Strategie liegt.

Der aktuelle Stand ist ein **Web-First-Grundgerüst** (responsive Browser-App), das bewusst API-getrieben aufgebaut ist, damit eine spätere App-Hülle (z. B. Capacitor) möglich bleibt.

### Kernfunktionen (implementiert)

- 🔐 **Authentifizierung** – Registrierung, Login, Passwort-Reset
- 🎮 **Spielverwaltung** – Runden erstellen, per QR-Code/Link/Code einladen, eigene Rundenliste
- 📊 **Dashboard** – Kontostand, Leaderboard, Transaktionshistorie
- 💸 **Geldtransfers** – Spieler-zu-Spieler und Spieler-zu-Bank, Bankeinzahlungen
- ⏸️ **Pause-Funktion** – Spiel unterbrechen und mit Bestätigung aller Spieler fortsetzen
- 🏁 **Spiel beenden** – Siegerermittlung bei Gleichstand

### Noch nicht implementiert

- Aktienhandel, Operationsrunde, Echtzeit-WebSockets, Foto-Upload von Spielständen

---

## Tech Stack (Ist-Zustand)

| Bereich | Technologie |
|---|---|
| Frontend | React 19 + Vite 6 + TypeScript (ESM) |
| Styling | Plain CSS (`frontend/src/styles/`) |
| State | React Context (`AuthContext`), lokaler `useState` |
| API-Client | `fetch` via `frontend/src/lib/api.ts` |
| Backend | Node.js 20 + Express 5 (CommonJS) |
| Datenbank | PostgreSQL via Prisma ORM v7 |
| Auth | JWT + bcryptjs |
| Testing | Node `--test` + Supertest (Backend), Vitest (Frontend) |
| CI | GitHub Actions (Backend-Tests, `tsc`, ESLint, Vitest, Build) |

> **Hinweis:** `ARCHITECTURE.md` beschreibt frühere Planungsziele (Tailwind, Socket.io, Zustand, React Query, Zod). Diese Bibliotheken sind **nicht** im Einsatz.

---

## Projektstruktur

```
1835_ze_ju_we_ti/
├── src/                    # Backend (Express, CommonJS)
│   ├── server.js           # Einstiegspunkt
│   ├── app.js              # Routen & Middleware
│   ├── authService.js
│   ├── gameService.js      # Spiellogik (Single Source of Truth)
│   └── lib/db.js           # Prisma oder In-Memory-Fallback
├── frontend/               # React-App (Vite + TypeScript, ESM)
│   └── src/
│       ├── pages/          # Login, Lobby, Dashboard, Join, …
│       ├── components/     # AppHeader, PageShell, Auth-UI
│       ├── contexts/       # AuthContext
│       ├── lib/api.ts      # API-Client
│       ├── types/          # Geteilte API-Typen
│       └── styles/         # layout.css, tokens
├── prisma/                 # Schema & Migrationen
├── test/                   # Backend-Tests (node --test)
└── .github/workflows/      # CI
```

---

## Umgebungsvariablen

Kopiere `.env.example` nach `.env` im **Projektroot** (nicht `backend/`):

```env
DATABASE_URL="postgresql://dev:dev@localhost:5432/1835"
JWT_SECRET="change-me-in-production"
JWT_EXPIRES_IN="7d"
NODE_ENV="development"
PORT=3000
FRONTEND_URL="http://localhost:5173"
```

**Produktion (Render):** `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `NODE_ENV=production`, `PORT=10000`, `FRONTEND_URL`

**Produktion (Vercel Frontend):** `VITE_API_URL=https://one835-ze-ju-we-ti.onrender.com`

Ohne `DATABASE_URL` fällt das Backend auf In-Memory-Maps zurück (nur für lokale Schnelltests).

---

## Deployment

| Service | Hosting | Build/Start |
|---|---|---|
| Backend | Render | `npm ci && npx prisma generate` → `npx prisma migrate deploy && node src/server.js` |
| Frontend | Vercel | `npx vite build` (Root: `frontend/`) |
| Datenbank | Neon (PostgreSQL) | – |

Render Free Tier: Backend schläft nach 15 Min Inaktivität ein (~30–60s Kaltstart). Health Check: `/health`

---

## Entwicklung

- Alle Features werden über **GitHub Issues** und Pull Requests in `main` geliefert.
- Agent-Konventionen: siehe `AGENTS.md` im übergeordneten Repo-Ordner.
- Architektur-Details: [`ARCHITECTURE.md`](ARCHITECTURE.md)

---

## Lizenz

Privates Projekt – alle Rechte vorbehalten.
Das Brettspiel 1835 ist ein eingetragenes Warenzeichen seiner jeweiligen Inhaber.
