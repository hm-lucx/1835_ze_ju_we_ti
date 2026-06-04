# Architektur – 1835 Digitales Spielbegleitsystem

## Überblick

Das System ist als **Client-Server-Architektur** aufgebaut. Ein React-Frontend kommuniziert über eine REST-API und WebSockets mit einem Node.js/Express-Backend. Die gesamte Spiellogik liegt ausschließlich serverseitig – der Client rendert nur den vom Server verwalteten Spielzustand.

## Plattformstrategie: Web-First mit App-Option

- **Primäre Plattform:** Responsive Web-Anwendung (Browser-first) mit Fokus auf Tablet-Nutzung.
- **Tablet-Ziel:** Layout und Interaktion sind für Breiten ab **768px** optimiert.
- **Browser-Zielplattform:** Aktuelle Versionen von **Chrome, Safari und Firefox**.
- **App-Migrationspfad:** UI- und Domänenlogik werden klar getrennt (API/WebSocket als Schnittstelle), damit eine spätere Hülle via **React Native** oder **Capacitor** ohne Neuschreiben der Kernlogik möglich bleibt.
- **Kein Framework-Lock-in:** Geschäftslogik bleibt im Backend; Frontend nutzt standardnahe Web-Patterns (HTTP/WebSocket, zustandsgetriebene Views) statt plattformspezifischer Hardcouplings.

```
┌─────────────────────────────────────────────┐
│              Browser / Tablet               │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │         React Frontend (Vite)       │    │
│  │  - Dashboard / Lobby / Auth Pages   │    │
│  │  - Socket.io Client                 │    │
│  │  - REST API Client (Fetch/Axios)    │    │
│  └──────────────┬──────────────────────┘    │
└─────────────────┼───────────────────────────┘
                  │  HTTPS + WSS
┌─────────────────▼───────────────────────────┐
│         Node.js / Express Backend           │
│                                             │
│  ┌────────────┐  ┌────────────────────────┐ │
│  │ REST API   │  │   Socket.io Server     │ │
│  │ /auth      │  │   - game:action        │ │
│  │ /games     │  │   - game:state         │ │
│  │ /players   │  │   - game:pause         │ │
│  └─────┬──────┘  └──────────┬─────────────┘ │
│        └──────────┬──────────┘              │
│           ┌───────▼──────┐                  │
│           │ Game Service │                  │
│           │ (State Mach.)│                  │
│           └───────┬──────┘                  │
└───────────────────┼─────────────────────────┘
                    │
┌───────────────────▼─────────────────────────┐
│            PostgreSQL (via Prisma)          │
└─────────────────────────────────────────────┘
```

---

## Frontend-Architektur

### Technologien
- **React 18** mit TypeScript (Strict Mode)
- **Vite** als Build-Tool
- **Tailwind CSS** für Styling
- **Zustand** für globalen Client-State
- **Socket.io-client** für Echtzeit-Updates
- **React Query** für Server-State und Caching

### Seitenstruktur

```
/login              → LoginPage
/register           → RegisterPage
/forgot-password    → ForgotPasswordPage
/reset-password     → ResetPasswordPage
/lobby              → LobbyPage (Runden erstellen / beitreten)
/game/:id           → GamePage (Haupt-Dashboard)
/game/:id/bank      → BankDashboardPage
```

### Komponenten-Hierarchie (GamePage)

```
<GamePage>
├── <GameHeader>          – Rundeninfo, Phase, Gleisfarbe
├── <TurnIndicator>       – Wer ist am Zug? + Passen-Button
├── <PlayerDashboard>     – Kontostand, Aktien, Direktor-Status
├── <RankingBoard>        – Spieler-Ranking
├── <ActionPanel>         – Mögliche Züge / Aktionen
│   ├── <StockTradeForm>  – Aktien kaufen/verkaufen
│   └── <OperationsStepper> – Schritt-für-Schritt Operationsrunde
├── <InfoButton>          – Regelwerk-Kontext-Hilfe
└── <GameControls>        – Pause, Speichern (Host-only)
```

### State-Management

| State-Art | Zuständig |
|---|---|
| Authentifizierung (User, Token) | Zustand Store |
| Spielzustand (Echtzeit) | Socket.io → Zustand Store |
| Server-Daten (REST) | React Query Cache |
| UI-State (Modals, etc.) | Lokaler useState |

**Prinzip:** Der Server ist immer die Single Source of Truth. Der Client-Store ist ein Spiegel des vom Server gepushten Spielzustands.

---

## Backend-Architektur

### Technologien
- **Node.js 20** + **Express** (TypeScript)
- **Prisma ORM** mit PostgreSQL
- **Socket.io** für WebSocket-Kommunikation
- **bcrypt** für Passwort-Hashing
- **JWT** für Authentifizierung
- **Resend** für E-Mail-Versand
- **Zod** für Request-Validierung

### Schichtenmodell

```
Request
  │
  ▼
Router (routes/)          → Routing & Middleware
  │
  ▼
Controller (controllers/) → HTTP Request/Response Handling
  │
  ▼
Service (services/)       → Geschäftslogik
  │
  ▼
Repository / Prisma       → Datenbankzugriff
```

### API-Endpunkte

#### Auth
```
POST /api/auth/register        – Registrierung
POST /api/auth/login           – Login → JWT
POST /api/auth/forgot-password – Reset-E-Mail senden
POST /api/auth/reset-password  – Neues Passwort setzen
```

#### Games
```
POST   /api/games              – Neue Runde erstellen
GET    /api/games/:id          – Runde abrufen
POST   /api/games/:id/join     – Runde beitreten
POST   /api/games/:id/start    – Spiel starten (Host)
POST   /api/games/:id/pause    – Spiel pausieren/fortsetzen (Host)
POST   /api/games/:id/save     – Spielstand speichern
GET    /api/games/:id/saves    – Gespeicherte Stände abrufen
POST   /api/games/:id/load/:saveId – Spielstand laden
```

#### Aktien / Transaktionen
```
POST /api/games/:id/stocks/buy   – Aktie kaufen
POST /api/games/:id/stocks/sell  – Aktie verkaufen
GET  /api/games/:id/stocks       – Aktien-Übersicht
```

### WebSocket Events

#### Client → Server
```
game:action       – Spielzug ausführen (mit Payload: Aktion + Daten)
game:pass         – Passen / „Habe fertig"
game:confirm      – Schritt in der Operationsrunde bestätigen
```

#### Server → Client (Broadcast an Spielraum)
```
game:state        – Vollständiger Spielzustand nach jeder Änderung
game:turn         – Neue Zugrunde / Phasenwechsel
game:notification – Systemnachricht (Pause, Spielstart, etc.)
game:error        – Fehler bei ungültigem Zug
```

---

## Spiellogik: State Machine

Die gesamte Spiellogik ist als **endliche Zustandsmaschine (Finite State Machine)** serverseitig implementiert. Kein Spielzug wird ohne serverseitige Validierung akzeptiert.

### Spielphasen (Top-Level)

```
LOBBY
  │ (Spielstart durch Host, min. 3 Spieler)
  ▼
STOCK_ROUND        ──── (alle passen) ────►  OPERATION_ROUND
  ▲                                               │
  │                                               │ (alle Gesellschaften abgeschlossen)
  └───────────────────────────────────────────────┘
        (nächste Aktienrunde)
```

### Aktienrunde – Zustände

```
STOCK_ROUND_START
  │
  ▼
PLAYER_TURN (pro Spieler, reihum)
  ├── [kaufen/verkaufen] → STOCK_ROUND_START (nächster Spieler)
  └── [passen]          → PLAYER_PASSED
                                │
                        (alle gepasst?)
                          │          │
                         Nein       Ja
                          │          ▼
                          │    OPERATION_ROUND_START
                          ▼
                    (weiter mit
                    nächstem Spieler)
```

### Operationsrunde – Zustände (pro Gesellschaft)

```
COMPANY_TURN_START
  │
  ▼
STEP_NETZBAU        → [OK-Bestätigung]
  │
  ▼
STEP_BAHNHOFSBAU    → [OK-Bestätigung]
  │
  ▼
STEP_ZUGBETRIEB     → [Payoff berechnen & gutschreiben]
  │
  ▼
STEP_ZUGKAUF        → [Zug kaufen oder passen]
  │
  ▼
COMPANY_TURN_END
  │
  ▼ (nächste Gesellschaft: zuerst private, dann Vorpreußen 1-6, ...)
ROUND_END
```

### Phasenwechsel-Kriterien

Phasenwechsel werden automatisch ausgelöst, wenn bestimmte Bedingungen erfüllt sind (z.B. bestimmte Züge gekauft, bestimmte Aktien ausgegeben). Die genauen Kriterien sind in [`docs/rules-summary.md`](docs/rules-summary.md) dokumentiert.

---

## Datenbankschema (Überblick)

```
User
  id, username, email, passwordHash, birthdate, createdAt

Game
  id, hostId → User, status (LOBBY|RUNNING|PAUSED|FINISHED)
  inviteToken, createdAt

GamePlayer
  id, gameId → Game, userId → User, joinedAt

GameState
  id, gameId → Game (1:1)
  phase, currentRound, activeCompanyId
  stateJson (vollständiger Spielzustand als JSON)
  updatedAt

PlayerAccount
  id, gameId, userId, balance

Stock
  id, gameId, companyId, ownerId → User (nullable = Bank)
  everCirculated (bool), acquiredAt

Transaction
  id, gameId, fromId, toId, stockId, amount, type, createdAt

GameSave
  id, gameId, savedAt, stateJson
  boardPhotoUrl, bankPhotoUrl

PasswordResetToken
  id, userId → User, token, expiresAt, usedAt
```

---

## Sicherheitsüberlegungen

- **Alle Spielaktionen serverseitig validieren** – Client-Eingaben niemals blind vertrauen
- **JWT-Tokens** mit kurzer Lebensdauer (7 Tage) + Refresh-Token-Logik (optional)
- **Passwörter** nur als bcrypt-Hash gespeichert (Cost Factor ≥ 12)
- **Reset-Tokens** sind einmalig verwendbar und laufen nach 1 Stunde ab
- **Rate Limiting** auf Auth-Endpunkten (z.B. max. 5 Login-Versuche / Minute)
- **WebSocket-Authentifizierung** via JWT im Handshake
- **Input-Validierung** mit Zod auf allen API-Routen

---

## Echtzeit-Konzept

Alle Spieler einer Runde sind in einem **Socket.io-Room** (`game:{gameId}`). Nach jeder validen Spielaktion:

1. Backend validiert Aktion gegen aktuellen Spielzustand
2. State Machine berechnet neuen Zustand
3. Neuer Zustand wird in DB gespeichert
4. Server broadcast `game:state` an alle Spieler im Room
5. Clients rendern den neuen Zustand (kein eigener Client-State für Spiellogik)

---

## Deployment

### Empfohlene Infrastruktur

| Komponente | Empfehlung |
|---|---|
| Frontend | Vercel oder Netlify |
| Backend | Railway, Render oder eigener VPS |
| Datenbank | Supabase (PostgreSQL) oder Railway |
| Datei-Upload | Cloudinary (Free Tier reicht für Start) |
| E-Mail | Resend (kostenlos bis 3.000 Mails/Monat) |

### GitHub Actions CI/CD

```yaml
# Läuft auf jedem Push / PR
- Lint (ESLint + Prettier)
- Type Check (tsc --noEmit)
- Tests (Vitest)
- Build (Frontend + Backend)
```

---

## Entscheidungs-Log (ADR – Architecture Decision Records)

| # | Entscheidung | Begründung |
|---|---|---|
| 1 | Spiellogik nur serverseitig | Verhindert Cheating, Single Source of Truth |
| 2 | Socket.io statt native WebSockets | Fallback-Support, Room-Management, einfachere API |
| 3 | Prisma statt raw SQL | Type-safe, Migrations-Management, DX |
| 4 | JWT statt Session-Cookies | Einfacher für zukünftige App-Migration |
| 5 | Zustand statt Redux | Geringere Komplexität für diesen Use Case |
| 6 | Vollständiger Spielzustand als JSON | Einfaches Speichern/Laden von Spielständen |
