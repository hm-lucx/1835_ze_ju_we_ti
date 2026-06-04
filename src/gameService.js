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

function getGame(gameId, username) {
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

function joinGame({ gameId, inviteToken, username }) {
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

function resetGames() {
  games.clear();
}

module.exports = {
  GameError,
  createGame,
  getGame,
  joinGame,
  resetGames,
  MAX_PLAYERS
};
