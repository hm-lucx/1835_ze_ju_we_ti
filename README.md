# 🚂 1835 – Digitales Spielbegleitsystem

> Ein webbasiertes Begleitsystem für das Brettspiel **1835** – verwaltet Aktien, Spielstände, Züge und Gesellschaften direkt am Tisch, optimiert für Tablets.

---

## Überblick

**1835** ist ein komplexes Eisenbahn-Aktienspiel, das in der deutschen Gründerzeit (um 1835) angesiedelt ist. Dieses Projekt digitalisiert die Spielverwaltung: Konten, Aktienbesitz, Gesellschaften, Phasen und Regelabläufe – damit der Fokus am Tisch auf der Strategie liegt, nicht auf der Buchhaltung.

### Kernfunktionen

- 🔐 **Authentifizierung** – Registrierung, Login, Passwort-Reset per E-Mail
- 🎮 **Spielverwaltung** – Runden erstellen, Spieler per QR-Code/Link einladen
- 📊 **Dashboard** – Kontostand, Aktienbesitz, Ranking, Direktor-Status
- 🏦 **Bank & Aktien** – Kauf/Verkauf mit regelkonformer Phasenlogik
- 🔄 **Rundenablauf** – Aktienrunde → Operationsrunde nach 1835-Regelwerk
- 💾 **Spielstand speichern** – inkl. Foto-Upload von Board und Bank
- ⏸️ **Pause-Funktion** – Spiel unterbrechen und fortsetzen

---

## Tech Stack

| Bereich | Technologie |
|---|---|
| Frontend | React 18 + Vite (TypeScript) |
| Styling | Tailwind CSS |
| Backend | Node.js + Express (TypeScript) |
| Datenbank | PostgreSQL via Prisma ORM |
| Echtzeit | Socket.io |
| Authentifizierung | JWT + bcrypt |
| E-Mail | Resend (oder Nodemailer + SMTP) |
| Datei-Upload | Cloudinary (oder lokaler S3-kompatibler Store) |
| Testing | Vitest + Supertest |
| CI/CD | GitHub Actions |

---

## Projektstruktur

```
1835/
├── frontend/               # React-App (Vite + TypeScript)
│   ├── src/
│   │   ├── components/     # Wiederverwendbare UI-Komponenten
│   │   ├── pages/          # Seiten (Login, Lobby, Dashboard, ...)
│   │   ├── hooks/          # Custom React Hooks
│   │   ├── store/          # Zustand (z.B. Zustand oder Redux)
│   │   └── socket/         # Socket.io Client-Setup
│   └── ...
│
├── backend/                # Express-Server (TypeScript)
│   ├── src/
│   │   ├── routes/         # API-Routen
│   │   ├── controllers/    # Request-Handler
│   │   ├── services/       # Geschäftslogik
│   │   ├── game/           # Spiellogik & State Machine
│   │   ├── models/         # Prisma-Modelle
│   │   └── socket/         # Socket.io Server-Events
│   └── ...
│
├── shared/                 # Gemeinsame Typen & Konstanten
│   ├── types/              # TypeScript-Interfaces
│   └── constants/          # Spielkonstanten (Startkapital, Phasen, ...)
│
├── prisma/                 # Datenbankschema & Migrationen
│   └── schema.prisma
│
├── .github/
│   ├── copilot-instructions.md   # Copilot Agent Kontext
│   ├── workflows/                # CI/CD Pipelines
│   └── ISSUE_TEMPLATE/           # Issue-Templates
│
├── docs/                   # Dokumentation
│   ├── ARCHITECTURE.md
│   ├── state-machine.md    # Spielablauf als State Machine
│   └── rules-summary.md    # 1835-Regelwerk-Zusammenfassung
│
├── README.md
└── docker-compose.yml      # Lokale Entwicklungsumgebung
```

---

## Lokales Setup

### Voraussetzungen

- Node.js >= 20
- PostgreSQL >= 15 (oder Docker)
- npm >= 10

### Installation

```bash
# Repository klonen
git clone https://github.com/dein-org/1835.git
cd 1835

# Abhängigkeiten installieren
npm install
cd frontend && npm install
cd ../backend && npm install

# Umgebungsvariablen konfigurieren
cp backend/.env.example backend/.env
# → .env mit eigenen Werten befüllen (DB, JWT Secret, E-Mail, ...)

# Datenbank einrichten
cd backend
npx prisma migrate dev

# Entwicklungsserver starten
npm run dev       # Startet Frontend + Backend parallel
```

### Mit Docker

```bash
docker-compose up
# → App läuft auf http://localhost:5173
# → API läuft auf http://localhost:3000
```

---

## Umgebungsvariablen

Erstelle `backend/.env` anhand der `.env.example`:

```env
# Datenbank
DATABASE_URL="postgresql://user:password@localhost:5432/1835"

# Authentifizierung
JWT_SECRET="dein-geheimer-schluessel"
JWT_EXPIRES_IN="7d"

# E-Mail (Resend)
RESEND_API_KEY="re_..."
EMAIL_FROM="noreply@deinedomain.de"

# Datei-Upload
CLOUDINARY_URL="cloudinary://..."

# App
NODE_ENV="development"
PORT=3000
FRONTEND_URL="http://localhost:5173"
```

---

## Spielregeln & Kontext

Dieses System implementiert die Spielregeln des Brettspiels **1835** von Francis Tresham. Eine Zusammenfassung der relevanten Regelabläufe (Aktienrunde, Operationsrunde, Phasenwechsel) findet sich in [`docs/rules-summary.md`](docs/rules-summary.md).

---

## Entwicklung mit GitHub Copilot

Dieses Projekt nutzt **GitHub Copilot Agents** für die Entwicklung. Jedes Feature ist als GitHub Issue strukturiert. Konventionen und Architektur-Entscheidungen sind in [`.github/copilot-instructions.md`](.github/copilot-instructions.md) dokumentiert.

**Workflow:**
1. Issue öffnen
2. Copilot Agent zuweisen (`@copilot` oder „Assign to Copilot")
3. Automatisch erstellten PR reviewen
4. Feedback als Issue-Kommentar → Copilot iteriert
5. Nach Approval: Merge

---

## Mitspielen (Spieler-Anleitung)

1. Registrierung unter `[URL]` (Mindestalter: 16 Jahre)
2. Host erstellt eine neue Spielrunde und teilt den QR-Code
3. Mitspieler scannen den Code und treten der Runde bei (3–7 Spieler)
4. Host startet das Spiel → Startkapital wird automatisch verteilt
5. Das Dashboard führt durch alle Runden und Phasen

---

## Lizenz

Privates Projekt – alle Rechte vorbehalten.
Das Brettspiel 1835 ist ein eingetragenes Warenzeichen seiner jeweiligen Inhaber.
