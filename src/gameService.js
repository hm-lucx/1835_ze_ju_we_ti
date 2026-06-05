const crypto = require('node:crypto');
const QRCode = require('qrcode');
const { getDb } = require('./lib/db');
const { isAtLeast16 } = require('./authService');

const MAX_PLAYERS = 7;
const MIN_PLAYERS = 3;
const STARTING_CAPITAL = 1000;
const BANK_STARTING_BALANCE = 12000;

const STARTING_CAPITAL_MAP = {
  3: 600,
  4: 475,
  5: 390,
  6: 340,
  7: 310,
};

function getStartingCapital(playerCount) {
  return STARTING_CAPITAL_MAP[playerCount] ?? null;
}

class GameError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'GameError';
    this.statusCode = statusCode;
  }
}

function generateInviteToken() {
  return crypto.randomBytes(16).toString('hex');
}

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(chars.length)];
  }
  return code;
}

async function createGame({ hostUsername }) {
  const id = crypto.randomUUID();
  const inviteToken = generateInviteToken();
  const inviteCode = generateInviteCode();
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const inviteLink = `${baseUrl}/join?token=${inviteToken}&game=${id}`;
  const inviteLinkShort = `${baseUrl}/join/${inviteCode}`;

  const qrCodeSvg = await QRCode.toString(inviteLinkShort, { type: 'svg' });

  const db = getDb();
  const user = await db.user.findUnique({ where: { username: hostUsername } });
  if (!user) {
    throw new GameError(404, 'Host nicht gefunden.');
  }

  const game = await db.game.create({
    data: {
      id,
      hostId: user.id,
      inviteToken,
      inviteCode,
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
    inviteCode,
    inviteLink,
    inviteLinkShort,
    qrCodeSvg,
    createdAt: game.createdAt.toISOString()
  };
}

async function getGame(gameId, username) {
  const db = getDb();
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: { host: true, players: { include: { user: true } }, playerAccounts: { include: { user: true } }, bankAccount: true }
  });

  if (!game) {
    throw new GameError(404, 'Spielrunde nicht gefunden.');
  }

  const isPlayer = game.players.some(p => p.user.username === username);
  if (!isPlayer) {
    throw new GameError(403, 'Nur Teilnehmer können diese Runde einsehen.');
  }

  const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/join?token=${game.inviteToken}&game=${game.id}`;
  const inviteLinkShort = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/join/${game.inviteCode}`;
  const qrCodeSvg = game.qrCodeSvg || await QRCode.toString(inviteLinkShort, { type: 'svg' });

  return {
    id: game.id,
    host: game.host.username,
    status: game.status,
    players: game.players.map(p => ({ username: p.user.username, joinedAt: p.joinedAt.toISOString() })),
    inviteCode: game.inviteCode,
    inviteLink,
    inviteLinkShort,
    qrCodeSvg,
    createdAt: game.createdAt.toISOString(),
    accounts: game.playerAccounts.map(a => ({ userId: a.userId, username: a.user.username, balance: a.balance })),
    bank: game.bankAccount ? { balance: game.bankAccount.balance } : null,
  };
}

async function joinGame({ gameId, inviteToken, username }) {
  const db = getDb();
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      host: true,
      players: { include: { user: true } },
      playerAccounts: { include: { user: true } },
      bankAccount: true,
    }
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

async function joinRoundByCode({ inviteCode, username }) {
  const db = getDb();

  if (!inviteCode || typeof inviteCode !== 'string' || inviteCode.length !== 6) {
    throw new GameError(400, 'Ungültiger Code.');
  }

  const game = await db.game.findUnique({
    where: { inviteCode: inviteCode.toUpperCase() },
    include: { host: true, players: { include: { user: true } } }
  });

  if (!game) {
    throw new GameError(404, 'Code ungültig oder abgelaufen.');
  }

  if (game.status === 'RUNNING' || game.status === 'FINISHED' || game.status === 'PAUSED') {
    throw new GameError(409, 'Runde bereits gestartet.');
  }

  if (game.players.some(p => p.user.username === username)) {
    throw new GameError(409, 'Du bist bereits in dieser Runde.');
  }

  if (game.players.length >= MAX_PLAYERS) {
    throw new GameError(409, 'Runde ist voll.');
  }

  const user = await db.user.findUnique({ where: { username } });
  if (!user) {
    throw new GameError(404, 'Benutzer nicht gefunden.');
  }

  if (!isAtLeast16(user.birthdate)) {
    throw new GameError(403, 'Mindestalter nicht erfüllt.');
  }

  await db.gamePlayer.create({
    data: { gameId: game.id, userId: user.id }
  });

  const updatedGame = await db.game.findUnique({
    where: { id: game.id },
    include: { host: true, players: { include: { user: true } } }
  });

  return {
    roundId: updatedGame.id,
    roundName: `Runde von ${updatedGame.host.username}`,
    playerCount: updatedGame.players.length
  };
}

async function startGame({ gameId, username }) {
  const db = getDb();
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
  const playerCount = game.players.length;
  const perPlayerCapital = getStartingCapital(playerCount);
  if (perPlayerCapital === null) {
    throw new GameError(400, `Ungültige Spieleranzahl: ${playerCount}.`);
  }

  const totalStartingCapital = perPlayerCapital * playerCount;
  const bankBalanceAfter = BANK_STARTING_BALANCE - totalStartingCapital;

  await db.$transaction([
    db.game.update({
      where: { id: gameId },
      data: { status: 'RUNNING', startedAt: now },
    }),
    db.gameState.create({
      data: {
        gameId,
        phase: 'STOCK_ROUND',
        currentRound: 1,
        stateJson: {
          playerOrder: game.players.map(p => p.userId),
          currentPlayerIndex: 0,
          bankBalance: bankBalanceAfter,
        },
      },
    }),
    db.playerAccount.createMany({
      data: game.players.map(p => ({ gameId, userId: p.userId, balance: perPlayerCapital })),
    }),
    db.bankAccount.create({
      data: { gameId, balance: bankBalanceAfter },
    }),
    db.transaction.createMany({
      data: game.players.map(p => ({
        gameId,
        fromId: null,
        toId: p.userId,
        amount: perPlayerCapital,
        type: 'STARTING_CAPITAL',
      })),
    }),
  ]);

  const finalGame = await db.game.findUnique({
    where: { id: gameId },
    include: {
      players: { include: { user: true } },
      playerAccounts: { include: { user: true } },
      bankAccount: true,
    },
  });

  return {
    id: finalGame.id,
    host: username,
    status: finalGame.status,
    players: finalGame.players.map(p => ({ username: p.user.username, joinedAt: p.joinedAt.toISOString() })),
    startedAt: finalGame.startedAt.toISOString(),
    accounts: finalGame.playerAccounts.map(a => ({ userId: a.userId, username: a.user.username, balance: a.balance })),
    bank: finalGame.bankAccount ? { balance: finalGame.bankAccount.balance } : null,
  };
}

async function getMyGames(username) {
  const db = getDb();
  const user = await db.user.findUnique({ where: { username } });
  if (!user) return { games: [] };

  const gamePlayers = await db.gamePlayer.findMany({
    where: { userId: user.id },
    include: { game: { include: { host: true } } }
  });

  const games = gamePlayers
    .filter(gp => gp.game.status === 'LOBBY' || gp.game.status === 'RUNNING' || gp.game.status === 'PAUSED')
    .map(gp => ({
      id: gp.game.id,
      host: gp.game.host.username,
      status: gp.game.status,
      createdAt: gp.game.createdAt.toISOString(),
      startedAt: gp.game.startedAt ? gp.game.startedAt.toISOString() : null,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return { games };
}

async function leaveGame({ gameId, username }) {
  const db = getDb();

  const game = await db.game.findUnique({
    where: { id: gameId },
    include: { host: true, players: { include: { user: true } } }
  });

  if (!game) {
    throw new GameError(404, 'Spielrunde nicht gefunden.');
  }

  if (game.status !== 'LOBBY') {
    throw new GameError(400, 'Spiel läuft bereits – Austritt nicht möglich.');
  }

  if (!game.players.some(p => p.user.username === username)) {
    throw new GameError(403, 'Du bist nicht in dieser Runde.');
  }

  const user = await db.user.findUnique({ where: { username } });
  await db.gamePlayer.deleteMany({
    where: { gameId, userId: user.id }
  });

  if (game.host.username === username) {
    const remaining = await db.gamePlayer.findMany({
      where: { gameId },
      include: { user: true }
    });

    if (remaining.length > 0) {
      await db.game.update({
        where: { id: gameId },
        data: { hostId: remaining[0].userId }
      });
    } else {
      await db.game.delete({ where: { id: gameId } });
      return { deleted: true };
    }
  }

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

async function transferMoney({ gameId, username, toUsername, amount, memo }) {
  const db = getDb();

  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      players: { include: { user: true } },
      playerAccounts: { include: { user: true } },
      bankAccount: true,
    },
  });

  if (!game) {
    throw new GameError(404, 'Spielrunde nicht gefunden.');
  }

  if (game.status !== 'RUNNING') {
    throw new GameError(400, 'Überweisungen sind nur während des laufenden Spiels möglich.');
  }

  const sender = game.playerAccounts.find(pa => pa.user.username === username);
  if (!sender) {
    throw new GameError(403, 'Du bist nicht in diesem Spiel.');
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new GameError(400, 'Betrag muss eine positive ganze Zahl sein.');
  }

  if (typeof memo === 'string' && memo.length > 500) {
    throw new GameError(400, 'Verwendungszweck ist zu lang (max. 500 Zeichen).');
  }

  if (amount > sender.balance) {
    throw new GameError(400, 'Nicht genügend Guthaben.');
  }

  if (!toUsername || toUsername.trim() === '') {
    if (!game.bankAccount) {
      throw new GameError(500, 'Bankkonto nicht gefunden.');
    }

    await db.$transaction([
      db.playerAccount.update({
        where: { id: sender.id },
        data: { balance: { decrement: amount } },
      }),
      db.bankAccount.update({
        where: { id: game.bankAccount.id },
        data: { balance: { increment: amount } },
      }),
      db.transaction.create({
        data: {
          gameId,
          fromId: sender.userId,
          toId: null,
          amount,
          type: 'PLAYER_TRANSFER',
          memo: memo || null,
        },
      }),
    ]);
  } else {
    const receiver = game.playerAccounts.find(pa => pa.user.username === toUsername);
    if (!receiver) {
      throw new GameError(404, 'Empfänger nicht gefunden.');
    }

    if (receiver.userId === sender.userId) {
      throw new GameError(400, 'Du kannst kein Geld an dich selbst senden.');
    }

    await db.$transaction([
      db.playerAccount.update({
        where: { id: sender.id },
        data: { balance: { decrement: amount } },
      }),
      db.playerAccount.update({
        where: { id: receiver.id },
        data: { balance: { increment: amount } },
      }),
      db.transaction.create({
        data: {
          gameId,
          fromId: sender.userId,
          toId: receiver.userId,
          amount,
          type: 'PLAYER_TRANSFER',
          memo: memo || null,
        },
      }),
    ]);
  }

  const updatedGame = await db.game.findUnique({
    where: { id: gameId },
    include: {
      players: { include: { user: true } },
      playerAccounts: { include: { user: true } },
      bankAccount: true,
    },
  });

  return {
    accounts: updatedGame.playerAccounts.map(a => ({ userId: a.userId, username: a.user.username, balance: a.balance })),
    bank: updatedGame.bankAccount ? { balance: updatedGame.bankAccount.balance } : null,
  };
}

async function receiveFromBank({ gameId, username, amount, memo }) {
  const db = getDb();

  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      players: { include: { user: true } },
      playerAccounts: { include: { user: true } },
      bankAccount: true,
    },
  });

  if (!game) {
    throw new GameError(404, 'Spielrunde nicht gefunden.');
  }

  if (game.status !== 'RUNNING') {
    throw new GameError(400, 'Auszahlungen sind nur während des laufenden Spiels möglich.');
  }

  const player = game.playerAccounts.find(pa => pa.user.username === username);
  if (!player) {
    throw new GameError(403, 'Du bist nicht in diesem Spiel.');
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new GameError(400, 'Betrag muss eine positive ganze Zahl sein.');
  }

  if (typeof memo === 'string' && memo.length > 500) {
    throw new GameError(400, 'Verwendungszweck ist zu lang (max. 500 Zeichen).');
  }

  if (!game.bankAccount) {
    throw new GameError(500, 'Bankkonto nicht gefunden.');
  }

  await db.$transaction([
    db.bankAccount.update({
      where: { id: game.bankAccount.id },
      data: { balance: { decrement: amount } },
    }),
    db.playerAccount.update({
      where: { id: player.id },
      data: { balance: { increment: amount } },
    }),
    db.transaction.create({
      data: {
        gameId,
        fromId: null,
        toId: player.userId,
        amount,
        type: 'RECEIVE_FROM_BANK',
        memo: memo || null,
      },
    }),
  ]);

  const updatedGame = await db.game.findUnique({
    where: { id: gameId },
    include: {
      players: { include: { user: true } },
      playerAccounts: { include: { user: true } },
      bankAccount: true,
    },
  });

  return {
    accounts: updatedGame.playerAccounts.map(a => ({ userId: a.userId, username: a.user.username, balance: a.balance })),
    bank: updatedGame.bankAccount ? { balance: updatedGame.bankAccount.balance } : null,
  };
}

async function pauseGame({ gameId, username }) {
  const db = getDb();

  const game = await db.game.findUnique({
    where: { id: gameId },
    include: { players: { include: { user: true } } },
  });

  if (!game) {
    throw new GameError(404, 'Spielrunde nicht gefunden.');
  }

  if (game.status !== 'RUNNING') {
    throw new GameError(409, 'Nur laufende Spiele können pausiert werden.');
  }

  const player = game.players.find(p => p.user.username === username);
  if (!player) {
    throw new GameError(403, 'Du bist nicht in diesem Spiel.');
  }

  const updatedGame = await db.game.update({
    where: { id: gameId },
    data: { status: 'PAUSED' },
    include: {
      playerAccounts: { include: { user: true } },
      bankAccount: true,
    },
  });

  return {
    accounts: updatedGame.playerAccounts.map(a => ({ userId: a.userId, username: a.user.username, balance: a.balance })),
    bank: updatedGame.bankAccount ? { balance: updatedGame.bankAccount.balance } : null,
    status: updatedGame.status,
  };
}

async function getTransactions(gameId, username) {
  const db = getDb();

  const game = await db.game.findUnique({
    where: { id: gameId },
    include: { players: { include: { user: true } } },
  });

  if (!game) {
    throw new GameError(404, 'Spielrunde nicht gefunden.');
  }

  const player = game.players.find(p => p.user.username === username);
  if (!player) {
    throw new GameError(403, 'Du bist nicht in diesem Spiel.');
  }

  const playerUserId = player.user.id;

  const transactions = await db.transaction.findMany({
    where: { gameId },
    orderBy: { createdAt: 'asc' },
  });

  const userMap = {};
  game.players.forEach(p => { userMap[p.user.id] = p.user.username; });

  let runningBalance = 0;
  const result = transactions.map(t => {
    if (t.fromId === playerUserId) runningBalance -= t.amount;
    if (t.toId === playerUserId) runningBalance += t.amount;
    const involvesMe = t.fromId === playerUserId || t.toId === playerUserId;
    return {
      id: t.id,
      amount: t.amount,
      type: t.type,
      memo: t.memo,
      fromUsername: t.fromId ? (userMap[t.fromId] || null) : null,
      toUsername: t.toId ? (userMap[t.toId] || null) : null,
      createdAt: t.createdAt.toISOString(),
      runningBalance: involvesMe ? runningBalance : null,
    };
  });

  return result.reverse();
}

async function resetGames() {
  const db = getDb();
  try {
    await db.game.deleteMany();
  } catch {
    // ignore cleanup errors
  }
}

module.exports = {
  GameError,
  createGame,
  getGame,
  getMyGames,
  joinGame,
  joinRoundByCode,
  leaveGame,
  startGame,
  transferMoney,
  receiveFromBank,
  pauseGame,
  getTransactions,
  resetGames,
  MAX_PLAYERS,
  MIN_PLAYERS,
  STARTING_CAPITAL,
  BANK_STARTING_BALANCE,
  getStartingCapital,
};
