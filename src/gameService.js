const crypto = require('node:crypto');
const QRCode = require('qrcode');
const { getDb } = require('./lib/db');
const { isAtLeast16, getStoredUser } = require('./authService');

const games = new Map();
const MAX_PLAYERS = 7;
const MIN_PLAYERS = 3;
const STARTING_CAPITAL = 1000;

class GameError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'GameError';
    this.statusCode = statusCode;
  }
}

function generateId() {
  return crypto.randomUUID();
}

function generateInviteToken() {
  return crypto.randomBytes(16).toString('hex');
}

async function createGame({ hostUsername }) {
  const id = generateId();
  const inviteToken = generateInviteToken();
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const inviteLink = `${baseUrl}/join?token=${inviteToken}&game=${id}`;

  const qrCodeSvg = await QRCode.toString(inviteLink, { type: 'svg' });

  const db = getDb();
  if (db) {
    const user = await db.user.findUnique({ where: { username: hostUsername } });
    if (!user) {
      throw new GameError(404, 'Host nicht gefunden.');
    }

    const game = await db.game.create({
      data: {
        id,
        hostId: user.id,
        inviteToken,
        players: {
          create: { userId: user.id }
        }
      },
      include: { players: { include: { user: true } } }
    });

    return {
      id: game.id,
      host: hostUsername,
      status: game.status,
      players: game.players.map(p => ({ username: p.user.username, joinedAt: p.joinedAt.toISOString() })),
      inviteLink,
      qrCodeSvg,
      createdAt: game.createdAt.toISOString()
    };
  }

  const game = {
    id,
    host: hostUsername,
    status: 'LOBBY',
    players: [{ username: hostUsername, joinedAt: new Date().toISOString() }],
    inviteToken,
    inviteLink,
    qrCodeSvg,
    createdAt: new Date().toISOString()
  };

  games.set(id, game);

  return {
    id: game.id,
    host: game.host,
    status: game.status,
    players: game.players,
    inviteLink: game.inviteLink,
    qrCodeSvg: game.qrCodeSvg,
    createdAt: game.createdAt
  };
}

async function getGame(gameId, username) {
  const db = getDb();
  if (db) {
    const game = await db.game.findUnique({
      where: { id: gameId },
      include: { host: true, players: { include: { user: true } } }
    });

    if (!game) {
      throw new GameError(404, 'Spielrunde nicht gefunden.');
    }

    const isPlayer = game.players.some(p => p.user.username === username);
    if (!isPlayer) {
      throw new GameError(403, 'Nur Teilnehmer können diese Runde einsehen.');
    }

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/join?token=${game.inviteToken}&game=${game.id}`;
    const qrCodeSvg = game.qrCodeSvg || await QRCode.toString(inviteLink, { type: 'svg' });

    return {
      id: game.id,
      host: game.host.username,
      status: game.status,
      players: game.players.map(p => ({ username: p.user.username, joinedAt: p.joinedAt.toISOString() })),
      inviteLink,
      qrCodeSvg,
      createdAt: game.createdAt.toISOString()
    };
  }

  const game = games.get(gameId);
  if (!game) {
    throw new GameError(404, 'Spielrunde nicht gefunden.');
  }

  const isPlayer = game.players.some(p => p.username === username);
  if (!isPlayer) {
    throw new GameError(403, 'Nur Teilnehmer können diese Runde einsehen.');
  }

  return {
    id: game.id,
    host: game.host,
    status: game.status,
    players: game.players,
    inviteLink: game.inviteLink,
    qrCodeSvg: game.qrCodeSvg,
    createdAt: game.createdAt
  };
}

async function joinGame({ gameId, inviteToken, username }) {
  const db = getDb();
  if (db) {
    const game = await db.game.findUnique({
      where: { id: gameId },
      include: { players: { include: { user: true } } }
    });

    if (!game) {
      throw new GameError(404, 'Spielrunde nicht gefunden.');
    }

    if (game.status !== 'LOBBY') {
      throw new GameError(400, 'Diese Runde hat bereits begonnen.');
    }

    if (game.inviteToken !== inviteToken) {
      throw new GameError(403, 'Ungültiger Einladungslink.');
    }

    if (game.players.some(p => p.user.username === username)) {
      throw new GameError(409, 'Du bist bereits in dieser Runde.');
    }

    if (game.players.length >= MAX_PLAYERS) {
      throw new GameError(409, 'Diese Runde ist bereits voll.');
    }

    const user = await db.user.findUnique({ where: { username } });
    if (!user) {
      throw new GameError(404, 'Benutzer nicht gefunden.');
    }

    if (!isAtLeast16(user.birthdate)) {
      throw new GameError(403, 'Mindestalter nicht erfüllt.');
    }

    await db.gamePlayer.create({
      data: { gameId, userId: user.id }
    });

    const updatedGame = await db.game.findUnique({
      where: { id: gameId },
      include: { host: true, players: { include: { user: true } } }
    });

    return {
      id: updatedGame.id,
      host: updatedGame.host.username,
      status: updatedGame.status,
      players: updatedGame.players.map(p => ({ username: p.user.username, joinedAt: p.joinedAt.toISOString() }))
    };
  }

  const game = games.get(gameId);
  if (!game) {
    throw new GameError(404, 'Spielrunde nicht gefunden.');
  }

  if (game.status !== 'LOBBY') {
    throw new GameError(400, 'Diese Runde hat bereits begonnen.');
  }

  if (game.inviteToken !== inviteToken) {
    throw new GameError(403, 'Ungültiger Einladungslink.');
  }

  if (game.players.some(p => p.username === username)) {
    throw new GameError(409, 'Du bist bereits in dieser Runde.');
  }

  if (game.players.length >= MAX_PLAYERS) {
    throw new GameError(409, 'Diese Runde ist bereits voll.');
  }

  const storedUser = await getStoredUser(username);
  if (!storedUser) {
    throw new GameError(404, 'Benutzer nicht gefunden.');
  }

  if (!isAtLeast16(new Date(storedUser.birthDate))) {
    throw new GameError(403, 'Mindestalter nicht erfüllt.');
  }

  game.players.push({ username, joinedAt: new Date().toISOString() });

  return {
    id: game.id,
    host: game.host,
    status: game.status,
    players: game.players
  };
}

async function startGame({ gameId, username }) {
  const db = getDb();
  if (db) {
    const game = await db.game.findUnique({
      where: { id: gameId },
      include: { host: true, players: { include: { user: true } } }
    });

    if (!game) {
      throw new GameError(404, 'Spielrunde nicht gefunden.');
    }

    if (game.host.username !== username) {
      throw new GameError(403, 'Nur der Host kann das Spiel starten.');
    }

    if (game.status !== 'LOBBY') {
      throw new GameError(400, 'Spielrunde hat bereits begonnen.');
    }

    if (game.players.length < MIN_PLAYERS) {
      throw new GameError(400, `Mindestens ${MIN_PLAYERS} Spieler erforderlich, um zu starten.`);
    }

    const now = new Date();
    const updated = await db.game.update({
      where: { id: gameId },
      data: { status: 'RUNNING', startedAt: now },
      include: { players: { include: { user: true } } }
    });

    const playerIds = game.players.map(p => p.userId);

    await db.gameState.create({
      data: {
        gameId,
        phase: 'STOCK_ROUND',
        currentRound: 1,
        stateJson: { playerOrder: playerIds, currentPlayerIndex: 0 }
      }
    });

    await db.playerAccount.createMany({
      data: playerIds.map(userId => ({ gameId, userId, balance: STARTING_CAPITAL }))
    });

    const finalGame = await db.game.findUnique({
      where: { id: gameId },
      include: { players: { include: { user: true } }, playerAccounts: true }
    });

    return {
      id: finalGame.id,
      host: username,
      status: finalGame.status,
      players: finalGame.players.map(p => ({ username: p.user.username, joinedAt: p.joinedAt.toISOString() })),
      startedAt: finalGame.startedAt.toISOString(),
      accounts: finalGame.playerAccounts.map(a => ({ userId: a.userId, balance: a.balance }))
    };
  }

  const game = games.get(gameId);
  if (!game) {
    throw new GameError(404, 'Spielrunde nicht gefunden.');
  }

  if (game.host !== username) {
    throw new GameError(403, 'Nur der Host kann das Spiel starten.');
  }

  if (game.status !== 'LOBBY') {
    throw new GameError(400, 'Spielrunde hat bereits begonnen.');
  }

  if (game.players.length < MIN_PLAYERS) {
    throw new GameError(400, `Mindestens ${MIN_PLAYERS} Spieler erforderlich, um zu starten.`);
  }

  game.status = 'RUNNING';
  game.startedAt = new Date().toISOString();
  game.gameState = { phase: 'STOCK_ROUND', currentRound: 1, stateJson: { playerOrder: game.players.map(p => p.username), currentPlayerIndex: 0 } };
  game.accounts = game.players.map(p => ({ username: p.username, balance: STARTING_CAPITAL }));

  return {
    id: game.id,
    host: game.host,
    status: game.status,
    players: game.players,
    startedAt: game.startedAt,
    accounts: game.accounts
  };
}

async function resetGames() {
  games.clear();
  const db = getDb();
  if (db) {
    try {
      await db.gamePlayer.deleteMany();
      await db.game.deleteMany();
    } catch {
      // ignore cleanup errors
    }
  }
}

module.exports = {
  GameError,
  createGame,
  getGame,
  joinGame,
  startGame,
  resetGames,
  MAX_PLAYERS,
  MIN_PLAYERS,
  STARTING_CAPITAL
};
