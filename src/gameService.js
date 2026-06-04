const crypto = require('node:crypto');
const QRCode = require('qrcode');

const games = new Map();
const MAX_PLAYERS = 7;

class GameError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'GameError';
    this.statusCode = statusCode;
  }
}

function getDb() {
  if (!process.env.DATABASE_URL) return null;
  try {
    return require('./lib/prisma');
  } catch {
    return null;
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
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
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
    createdAt: new Date().toISOString()
  };

  games.set(id, game);

  return {
    id: game.id,
    host: game.host,
    status: game.status,
    players: game.players,
    inviteLink: game.inviteLink,
    qrCodeSvg,
    createdAt: game.createdAt
  };
}

async function getGame(gameId, username) {
  const db = getDb();
  if (db) {
    const game = await db.game.findUnique({
      where: { id: gameId },
      include: { players: { include: { user: true } } }
    });

    if (!game) {
      throw new GameError(404, 'Spielrunde nicht gefunden.');
    }

    const isPlayer = game.players.some(p => p.user.username === username);
    if (!isPlayer) {
      throw new GameError(403, 'Nur Teilnehmer können diese Runde einsehen.');
    }

    return {
      id: game.id,
      host: (await db.user.findUnique({ where: { id: game.hostId } })).username,
      status: game.status,
      players: game.players.map(p => ({ username: p.user.username, joinedAt: p.joinedAt.toISOString() })),
      inviteLink: `${process.env.BASE_URL || 'http://localhost:3000'}/join?token=${game.inviteToken}&game=${game.id}`,
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
      throw new GameError(400, 'Spielrunde hat bereits begonnen.');
    }

    if (game.inviteToken !== inviteToken) {
      throw new GameError(403, 'Ungültiger Einladungslink.');
    }

    if (game.players.some(p => p.user.username === username)) {
      throw new GameError(409, 'Du bist bereits in dieser Runde.');
    }

    if (game.players.length >= MAX_PLAYERS) {
      throw new GameError(400, `Maximale Spieleranzahl (${MAX_PLAYERS}) erreicht.`);
    }

    const user = await db.user.findUnique({ where: { username } });
    if (!user) {
      throw new GameError(404, 'Benutzer nicht gefunden.');
    }

    await db.gamePlayer.create({
      data: { gameId, userId: user.id }
    });

    const updatedGame = await db.game.findUnique({
      where: { id: gameId },
      include: { players: { include: { user: true } } }
    });

    return {
      id: updatedGame.id,
      host: (await db.user.findUnique({ where: { id: updatedGame.hostId } })).username,
      status: updatedGame.status,
      players: updatedGame.players.map(p => ({ username: p.user.username, joinedAt: p.joinedAt.toISOString() }))
    };
  }

  const game = games.get(gameId);
  if (!game) {
    throw new GameError(404, 'Spielrunde nicht gefunden.');
  }

  if (game.status !== 'LOBBY') {
    throw new GameError(400, 'Spielrunde hat bereits begonnen.');
  }

  if (game.inviteToken !== inviteToken) {
    throw new GameError(403, 'Ungültiger Einladungslink.');
  }

  if (game.players.some(p => p.username === username)) {
    throw new GameError(409, 'Du bist bereits in dieser Runde.');
  }

  if (game.players.length >= MAX_PLAYERS) {
    throw new GameError(400, `Maximale Spieleranzahl (${MAX_PLAYERS}) erreicht.`);
  }

  game.players.push({ username, joinedAt: new Date().toISOString() });

  return {
    id: game.id,
    host: game.host,
    status: game.status,
    players: game.players
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
  resetGames,
  MAX_PLAYERS
};
