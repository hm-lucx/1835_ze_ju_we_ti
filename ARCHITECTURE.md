# Architektur – 1835 Digitales Spielbegleitsystem

> Dieses Dokument beschreibt den **aktuellen Ist-Zustand** des Codes. Geplante, aber noch nicht implementierte Teile (WebSockets, Aktienhandel, State Machine) sind als „geplant" markiert.

## Überblick

Das System ist eine **Client-Server-Architektur**. Ein React-Frontend kommuniziert per REST-API mit einem Node.js/Express-Backend. Die gesamte Spiellogik liegt **ausschließlich serverseitig** – der Client rendert den vom Server gelieferten Zustand und pollt bei Bedarf.

```
┌─────────────────────────────────────────────┐
│              Browser / Tablet               │
│  ┌─────────────────────────────────────┐    │
│  │    React 19 + Vite (TypeScript)     │    │
│  │  - AuthContext (JWT in localStorage)│    │
│  │  - fetch via lib/api.ts             │    │
│  │  - Plain CSS (layout.css)           │    │
│  └──────────────┬──────────────────────┘    │
└─────────────────┼───────────────────────────┘
                  │  HTTPS (REST /api/*)
┌─────────────────▼───────────────────────────┐
│         Node.js / Express (CommonJS)        │
│  ┌────────────────────────────────────┐     │
│  │  app.js – Routen & Middleware      │     │
│  │  authService.js / gameService.js   │     │
│  └──────────────┬─────────────────────┘     │
│                 │                           │
│  ┌──────────────▼─────────────────────┐     │
│  │  Prisma → PostgreSQL (oder In-Mem) │     │
│  └────────────────────────────────────┘     │
└─────────────────────────────────────────────┘
```

---

## Frontend

### Technologien (implementiert)

| Bereich | Wahl |
|---|---|
| Framework | React 19, Strict TypeScript |
| Build | Vite 6 |
| Routing | React Router 6 |
| Styling | Plain CSS, mobile-first Breakpoints (375/768/1024px) |
| Auth-State | `AuthContext` – Token synchron in `localStorage` |
| API | `apiGet` / `apiPost` / `apiDelete` in `lib/api.ts` |
| Typen | `src/types/game.ts` für Game/Lobby-Responses |

### Seiten & Routen

```
/login              → LoginPage
/register           → RegisterPage
/forgot-password    → ForgotPasswordPage
/reset-password     → ResetPasswordPage
/lobby              → LobbyPage (Rundenliste, erstellen, beitreten)
/game/:id           → DashboardPage (Kontostand, Transfers, Leaderboard)
/join               → JoinPage (QR-Code / Link)
```

### Datenfluss

1. Nutzer authentifiziert sich → JWT in Context + localStorage
2. Seiten rufen REST-Endpunkte auf (`apiGet`/`apiPost`)
3. Lobby und Dashboard **pollen** periodisch (kein WebSocket)
4. Fehler aus der API werden als `role="alert"` angezeigt

### Geplant (nicht implementiert)

- Socket.io für Echtzeit-Updates
- Zustand / React Query
- Tailwind CSS

---

## Backend

### Technologien (implementiert)

| Bereich | Wahl |
|---|---|
| Runtime | Node.js 20, CommonJS |
| HTTP | Express 5 |
| ORM | Prisma 7 (`prisma.config.ts`, Client in `src/generated/`) |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` |
| DB-Modus | PostgreSQL wenn `DATABASE_URL` gesetzt, sonst In-Memory Maps |
| Concurrency | Serializable Transactions für Join und Geldtransfer |

### Schichten

```
HTTP Request
  → app.js (Routing, requireAuth, Rate Limiting)
  → authService.js / gameService.js (Geschäftslogik)
  → Prisma Client (oder In-Memory Maps via lib/db.js)
```

### Wichtige API-Endpunkte

#### Auth
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

#### Games & Lobby
```
POST   /api/games                    – Runde erstellen
GET    /api/games/mine               – Eigene Runden
GET    /api/games/:id                – Runde abrufen
POST   /api/games/:id/join           – Per Invite-Token beitreten
POST   /api/rounds/join              – Per 6-stelligem Code beitreten
POST   /api/games/:id/leave          – Lobby verlassen (Host-Übergabe)
DELETE /api/games/:id                – Lobby-Runde löschen (Host)
POST   /api/games/:id/start          – Spiel starten (Host, min. 3 Spieler)
POST   /api/games/:id/pause          – Pausieren / Fortsetzen (Host)
POST   /api/games/:id/confirm-resume – Fortsetzen bestätigen (alle Spieler)
POST   /api/games/:id/finish         – Spiel beenden
```

#### Geld & Transaktionen
```
POST /api/games/:id/transfer         – Spieler → Spieler oder Bank
POST /api/games/:id/receive          – Bank → Spieler
GET  /api/games/:id/transactions     – Transaktionshistorie
```

### Sicherheitsregeln (implementiert)

- Invite-Links (`inviteCode`, QR) nur für **Host in LOBBY**
- Join und Transfer mit **Serializable**-Transactions (Race-sicher)
- Alle Spielaktionen serverseitig validiert
- Rate Limiting auf Auth- und Game-Endpunkten
- Passwörter als bcrypt-Hash

---

## Datenbankschema (Prisma, vereinfacht)

```
User              id, username, email, passwordHash, birthdate
Game              id, hostId, status, inviteToken, inviteCode, …
GamePlayer        gameId, userId, resumeConfirmed
PlayerAccount     gameId, userId, balance
BankAccount       gameId, balance
Transaction       gameId, fromId, toId, amount, type, memo
PasswordResetToken userId, token, expiresAt
```

Spielstatus: `LOBBY` → `RUNNING` ↔ `PAUSED` → `FINISHED`

---

## Testing & CI

| Ebene | Werkzeug | Ort |
|---|---|---|
| Backend | `node --test` + Supertest | `test/*.test.js` |
| Frontend | Vitest + Testing Library | `frontend/src/**/*.test.tsx` |
| Typecheck | `tsc --noEmit` | CI + lokal |
| Lint | ESLint (react-hooks) | CI + `npm run lint` |

Backend-Tests laufen in CI mit `--test-concurrency=1` (Shared PostgreSQL).

---

## Deployment

| Komponente | Service |
|---|---|
| Frontend | Vercel (`frontend/`, SPA-Rewrite in `vercel.json`) |
| Backend | Render (Migrate on Start) |
| Datenbank | Neon PostgreSQL |

---

## Geplante Erweiterungen

- **WebSockets** (Socket.io) für Live-Updates statt Polling
- **Aktienrunde / Operationsrunde** als serverseitige State Machine
- **Spielstand speichern** mit Foto-Upload
- **Zod**-Validierung auf allen Routen

Diese Punkte sind in GitHub Issues und der Produkt-Roadmap verankert, aber noch nicht im Code.
